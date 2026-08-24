import express from 'express';
import pool from '../config/database.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Get user's bookings
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.*, e.name as event_name, s.date as show_date 
       FROM bookings b
       JOIN shows s ON b.show_id = s.id
       JOIN events e ON s.event_id = e.id
       WHERE b.user_id = $1
       ORDER BY b.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create booking
router.post('/', authMiddleware, async (req, res) => {
  const { show_id, seats } = req.body;
  
  try {
    const seatCheck = await pool.query(
      'SELECT * FROM seats WHERE show_id = $1 AND seat_number = ANY($2) AND status = $3',
      [show_id, seats, 'available']
    );
    
    if (seatCheck.rows.length !== seats.length) {
      return res.status(400).json({ message: 'Some seats are not available' });
    }
    
    const result = await pool.query(
      `INSERT INTO bookings (user_id, show_id, seats, total_price, status) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [req.user.id, show_id, seats, seats.length * 10, 'confirmed']
    );
    
    await pool.query(
      'UPDATE seats SET status = $1 WHERE show_id = $2 AND seat_number = ANY($3)',
      ['booked', show_id, seats]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Cancel booking
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE bookings SET status = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
      ['cancelled', req.params.id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    
    await pool.query(
      'UPDATE seats SET status = $1 WHERE show_id = $2 AND seat_number = ANY($3)',
      ['available', result.rows[0].show_id, result.rows[0].seats]
    );
    
    res.json({ message: 'Booking cancelled successfully' });
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
