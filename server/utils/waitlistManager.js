import { query } from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';
import { sendWaitlistOfferEmail } from './emailService.js';

/**
 * WaitlistManager handles waitlist operations with auto-assignment
 * and time-limited offer flow for cancelled bookings
 */

/**
 * Add customer to waitlist for a specific seat category
 */
export async function addToWaitlist(showId, customerId, seatCategoryId) {
  try {
    // Get current position in waitlist
    const posResult = await query(
      `SELECT MAX(position) as max_position 
       FROM waitlist 
       WHERE show_id = $1 AND seat_category_id = $2`,
      [showId, seatCategoryId]
    );

    const nextPosition = (posResult.rows[0]?.max_position || 0) + 1;

    // Check if customer already on waitlist
    const existing = await query(
      `SELECT id FROM waitlist 
       WHERE show_id = $1 AND customer_id = $2 AND seat_category_id = $3`,
      [showId, customerId, seatCategoryId]
    );

    if (existing.rows.length > 0) {
      throw new Error('Customer already on waitlist for this category');
    }

    // Add to waitlist
    const result = await query(
      `INSERT INTO waitlist (show_id, customer_id, seat_category_id, position, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [showId, customerId, seatCategoryId, nextPosition, 'waiting']
    );

    return result.rows[0];
  } catch (error) {
    throw error;
  }
}

/**
 * When a booking is cancelled, offer the seat to the next customer on waitlist
 */
export async function assignFromWaitlist(showId, seatCategoryId) {
  try {
    // Get the first waiting customer
    const result = await query(
      `SELECT id, customer_id FROM waitlist 
       WHERE show_id = $1 AND seat_category_id = $2 AND status = 'waiting'
       ORDER BY position ASC LIMIT 1`,
      [showId, seatCategoryId]
    );

    if (result.rows.length === 0) {
      return null; // No one on waitlist
    }

    const { id: waitlistId, customer_id: customerId } = result.rows[0];

    // Generate time-limited offer token (valid for 1 hour)
    const offerToken = uuidv4();
    const offerExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Update waitlist entry with offer
    const updateResult = await query(
      `UPDATE waitlist 
       SET status = $1, offer_token = $2, offer_expires_at = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      ['offered', offerToken, offerExpiresAt, waitlistId]
    );

    // Get customer email
    const userResult = await query(
      'SELECT email, name FROM users WHERE id = $1',
      [customerId]
    );

    if (userResult.rows.length > 0) {
      const { email, name } = userResult.rows[0];

      // Get event details for email
      const eventResult = await query(
        `SELECT e.title, e.event_date, s.show_time
         FROM events e
         JOIN shows s ON e.id = s.event_id
         WHERE s.id = $1`,
        [showId]
      );

      if (eventResult.rows.length > 0) {
        const { title, event_date, show_time } = eventResult.rows[0];

        // Send email with time-limited link
        const bookingLink = `${process.env.CLIENT_URL}/waitlist-offer/${offerToken}`;
        
        await sendWaitlistOfferEmail({
          email,
          name,
          eventTitle: title,
          eventDate: event_date,
          eventTime: show_time,
          bookingLink,
          expiresAt: offerExpiresAt,
        });
      }
    }

    return updateResult.rows[0];
  } catch (error) {
    console.error('Error assigning from waitlist:', error);
    throw error;
  }
}

/**
 * Complete a booking from a waitlist offer
 * Verifies token is still valid and assigns available seat
 */
export async function completeWaitlistBooking(offerToken) {
  try {
    // Verify token and check expiry
    const waitlistResult = await query(
      `SELECT id, show_id, customer_id, seat_category_id 
       FROM waitlist 
       WHERE offer_token = $1 AND status = 'offered' AND offer_expires_at > NOW()`,
      [offerToken]
    );

    if (waitlistResult.rows.length === 0) {
      throw new Error('Invalid or expired offer token');
    }

    const { id: waitlistId, show_id: showId, customer_id: customerId, seat_category_id: seatCategoryId } = waitlistResult.rows[0];

    // Find an available seat in the category
    const seatResult = await query(
      `SELECT ss.id, ss.seat_id
       FROM show_seats ss
       JOIN seats s ON ss.seat_id = s.id
       WHERE ss.show_id = $1 AND s.category_id = $2 AND ss.status = 'available'
       LIMIT 1`,
      [showId, seatCategoryId]
    );

    if (seatResult.rows.length === 0) {
      // No seats available, keep in waitlist
      throw new Error('No available seats in this category');
    }

    const { id: showSeatId, seat_id: seatId } = seatResult.rows[0];

    // Book the seat
    const bookResult = await query(
      `UPDATE show_seats 
       SET status = $1, booked_by = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      ['booked', customerId, showSeatId]
    );

    // Update waitlist status
    await query(
      `UPDATE waitlist SET status = $1, updated_at = NOW() WHERE id = $2`,
      ['booked', waitlistId]
    );

    // Assign next customer if available
    await assignFromWaitlist(showId, seatCategoryId);

    return {
      showSeatId,
      waitlistId,
      status: 'booked'
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Expire old offers and reassign to next in line
 */
export async function processExpiredOffers() {
  try {
    // Get expired offers
    const expiredResult = await query(
      `SELECT id, show_id, seat_category_id FROM waitlist 
       WHERE status = 'offered' AND offer_expires_at < NOW()`
    );

    // Mark as expired and assign next
    for (const { id, show_id, seat_category_id } of expiredResult.rows) {
      await query(
        `UPDATE waitlist SET status = $1 WHERE id = $2`,
        ['expired', id]
      );

      // Reassign to next customer
      await assignFromWaitlist(show_id, seat_category_id);
    }

    console.log(`Processed ${expiredResult.rows.length} expired offers`);
    return expiredResult.rows.length;
  } catch (error) {
    console.error('Error processing expired offers:', error);
    throw error;
  }
}

/**
 * Handle booking cancellation - refund and offer seat to waitlist
 */
export async function handleBookingCancellation(bookingId) {
  try {
    // Get booking details
    const bookingResult = await query(
      `SELECT b.id, b.show_id, b.customer_id, bi.seat_id
       FROM bookings b
       JOIN booking_items bi ON b.id = bi.booking_id
       WHERE b.id = $1`,
      [bookingId]
    );

    if (bookingResult.rows.length === 0) {
      throw new Error('Booking not found');
    }

    const bookings = bookingResult.rows;
    const showId = bookings[0].show_id;

    // Release all seats in booking
    for (const { id: seatId } of bookings) {
      const categoryResult = await query(
        `SELECT category_id FROM seats WHERE id = $1`,
        [seatId]
      );

      if (categoryResult.rows.length > 0) {
        const { category_id } = categoryResult.rows[0];

        // Release the seat
        await query(
          `UPDATE show_seats SET status = $1, booked_by = NULL WHERE show_id = $2 AND seat_id = $3`,
          ['available', showId, seatId]
        );

        // Offer to next waitlist customer
        await assignFromWaitlist(showId, category_id);
      }
    }

    // Mark booking as cancelled
    await query(
      `UPDATE bookings SET status = $1, cancelled_at = NOW() WHERE id = $2`,
      ['cancelled', bookingId]
    );

    return { success: true, message: 'Booking cancelled and seats offered to waitlist' };
  } catch (error) {
    throw error;
  }
}

/**
 * Get waitlist position for a customer
 */
export async function getWaitlistPosition(showId, customerId, seatCategoryId) {
  try {
    const result = await query(
      `SELECT position, status FROM waitlist 
       WHERE show_id = $1 AND customer_id = $2 AND seat_category_id = $3`,
      [showId, customerId, seatCategoryId]
    );

    return result.rows[0] || null;
  } catch (error) {
    throw error;
  }
}
