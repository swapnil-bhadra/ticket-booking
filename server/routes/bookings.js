import pool from '../config/database.js';
import express from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../db/index.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { holdSeat, releaseSeat, bookSeat, updateShowStatus } from '../utils/seatManager.js';
import {
  addToWaitlist,
  handleBookingCancellation,
  getWaitlistPosition,
  completeWaitlistBooking,
} from '../utils/waitlistManager.js';
import { generateQRCode, sendBookingConfirmationEmail, sendCancellationEmail } from '../utils/emailService.js';

const router = express.Router();

/**
 * Hold a seat (temporary reservation)
 */
router.post(
  '/hold-seat',
  authMiddleware,
  [body('show_id').notEmpty(), body('seat_id').notEmpty()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { show_id, seat_id } = req.body;
      const ttl = parseInt(process.env.SEAT_HOLD_TTL || '10');

      const holdedSeat = await holdSeat(show_id, seat_id, req.user.userId, ttl);
      res.json({ success: true, seat: holdedSeat });
    } catch (error) {
      console.error('Hold seat error:', error);
      res.status(400).json({ error: error.message });
    }
  }
);

/**
 * Release a held seat
 */
router.post(
  '/release-seat',
  authMiddleware,
  [body('show_id').notEmpty(), body('seat_id').notEmpty()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { show_id, seat_id } = req.body;
      await releaseSeat(show_id, seat_id, req.user.userId);
      res.json({ success: true });
    } catch (error) {
      console.error('Release seat error:', error);
      res.status(400).json({ error: error.message });
    }
  }
);

/**
 * Create a booking from held seats
 */
router.post(
  '/',
  authMiddleware,
  requireRole('customer'),
  [body('show_id').notEmpty(), body('seat_ids').isArray({ min: 1 })],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { show_id, seat_ids } = req.body;
      const customerId = req.user.userId;

      // Start transaction
      await query('BEGIN');

      try {
        // Book all seats
        let totalPrice = 0;
        const bookingItems = [];

        for (const seatId of seat_ids) {
          // Book the seat
          const bookedSeat = await bookSeat(show_id, seatId, customerId);

          // Get seat details for booking item
          const seatResult = await query(
            `SELECT s.seat_number, sc.name as category, sc.price
             FROM seats s
             JOIN seat_categories sc ON s.category_id = sc.id
             WHERE s.id = $1`,
            [seatId]
          );

          const { seat_number, category, price } = seatResult.rows[0];
          totalPrice += parseFloat(price);

          bookingItems.push({
            showSeatId: bookedSeat.id,
            seatId,
            seatNumber: seat_number,
            category,
            price,
          });
        }

        // Create booking
        const bookingReference = `BK${Date.now()}`;
        const bookingResult = await query(
          `INSERT INTO bookings (booking_reference, customer_id, show_id, total_price, status)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [bookingReference, customerId, show_id, totalPrice, 'confirmed']
        );

        const booking = bookingResult.rows[0];

        // Create booking items
        for (const item of bookingItems) {
          await query(
            `INSERT INTO booking_items (booking_id, show_seat_id, seat_id, price)
             VALUES ($1, $2, $3, $4)`,
            [booking.id, item.showSeatId, item.seatId, item.price]
          );
        }

        // Generate QR code
        const qrCodeDataUrl = await generateQRCode(bookingReference);

        // Update booking with QR code URL
        await query(
          'UPDATE bookings SET qr_code_url = $1 WHERE id = $2',
          [qrCodeDataUrl, booking.id]
        );

        // Get user details for email
        const userResult = await query('SELECT email, name FROM users WHERE id = $1', [customerId]);
        const { email, name } = userResult.rows[0];

        // Get show details for email
        const showResult = await query(
          `SELECT e.title, e.event_date, s.show_time
           FROM events e
           JOIN shows s ON e.id = s.event_id
           WHERE s.id = $1`,
          [show_id]
        );

        const { title, event_date, show_time } = showResult.rows[0];

        // Send confirmation email
        await sendBookingConfirmationEmail({
          email,
          name,
          eventTitle: title,
          eventDate: event_date,
          eventTime: show_time,
          seats: bookingItems,
          totalPrice,
          bookingReference,
          qrCodeDataUrl,
        });

        // Update show status
        await updateShowStatus(show_id);

        await query('COMMIT');

        res.status(201).json({
          booking: {
            ...booking,
            qrCodeUrl: qrCodeDataUrl,
          },
          bookingItems,
        });
      } catch (error) {
        await query('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error('Booking error:', error);
      res.status(500).json({ error: 'Failed to create booking' });
    }
  }
);

/**
 * Get customer bookings
 */
router.get('/my-bookings', authMiddleware, requireRole('customer'), async (req, res) => {
  try {
    const result = await query(
      `SELECT b.*, e.title as event_title, e.event_date, s.show_time
       FROM bookings b
       JOIN shows s ON b.show_id = s.id
       JOIN events e ON s.event_id = e.id
       WHERE b.customer_id = $1
       ORDER BY b.created_at DESC`,
      [req.user.userId]
    );

    // Get booking items for each booking
    const bookingsWithItems = await Promise.all(
      result.rows.map(async (booking) => {
        const itemsResult = await query(
          `SELECT bi.*, s.seat_number
           FROM booking_items bi
           JOIN seats s ON bi.seat_id = s.id
           WHERE bi.booking_id = $1`,
          [booking.id]
        );
        return {
          ...booking,
          items: itemsResult.rows,
        };
      })
    );

    res.json(bookingsWithItems);
  } catch (error) {
    console.error('Bookings fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

/**
 * Cancel a booking
 */
router.post('/:bookingId/cancel', authMiddleware, requireRole('customer'), async (req, res) => {
  try {
    const { bookingId } = req.params;

    // Verify booking belongs to user
    const bookingResult = await query(
      'SELECT * FROM bookings WHERE id = $1 AND customer_id = $2',
      [bookingId, req.user.userId]
    );

    if (bookingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = bookingResult.rows[0];

    if (booking.status === 'cancelled') {
      return res.status(400).json({ error: 'Booking already cancelled' });
    }

    // Handle cancellation
    await handleBookingCancellation(bookingId);

    // Get user details for email
    const userResult = await query('SELECT email, name FROM users WHERE id = $1', [
      req.user.userId,
    ]);
    const { email, name } = userResult.rows[0];

    // Get event details
    const eventResult = await query(
      `SELECT e.title FROM events e
       JOIN shows s ON e.id = s.event_id
       WHERE s.id = $1`,
      [booking.show_id]
    );

    if (eventResult.rows.length > 0) {
      await sendCancellationEmail({
        email,
        name,
        eventTitle: eventResult.rows[0].title,
        bookingReference: booking.booking_reference,
        refundAmount: booking.total_price,
      });
    }

    res.json({ success: true, message: 'Booking cancelled successfully' });
  } catch (error) {
    console.error('Cancellation error:', error);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

/**
 * Join waitlist
 */
router.post(
  '/waitlist/join',
  authMiddleware,
  requireRole('customer'),
  [body('show_id').notEmpty(), body('seat_category_id').notEmpty()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { show_id, seat_category_id } = req.body;
      const customerId = req.user.userId;

      const waitlistEntry = await addToWaitlist(show_id, customerId, seat_category_id);
      res.status(201).json(waitlistEntry);
    } catch (error) {
      console.error('Waitlist join error:', error);
      res.status(400).json({ error: error.message });
    }
  }
);

/**
 * Get waitlist position
 */
router.get(
  '/waitlist/position/:show_id/:category_id',
  authMiddleware,
  requireRole('customer'),
  async (req, res) => {
    try {
      const { show_id, category_id } = req.params;
      const position = await getWaitlistPosition(show_id, req.user.userId, category_id);

      if (!position) {
        return res.status(404).json({ error: 'Not on waitlist' });
      }

      res.json(position);
    } catch (error) {
      console.error('Waitlist position error:', error);
      res.status(500).json({ error: 'Failed to fetch position' });
    }
  }
);

/**
 * Complete waitlist booking with token
 */
router.post(
  '/waitlist/complete/:offerToken',
  [body('offerToken').notEmpty()],
  async (req, res) => {
    try {
      const { offerToken } = req.params;
      const result = await completeWaitlistBooking(offerToken);
      res.json({ success: true, result });
    } catch (error) {
      console.error('Waitlist booking error:', error);
      res.status(400).json({ error: error.message });
    }
  }
);

export default router;
