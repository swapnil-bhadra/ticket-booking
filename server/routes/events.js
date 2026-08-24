import express from 'express';
import pool from '../config/database.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Get all events
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM events ORDER BY date ASC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single event
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM events WHERE id = $1',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create event
router.post('/', authMiddleware, async (req, res) => {
  const { name, description, date, venue, total_seats } = req.body;
  
  try {
    const result = await pool.query(
      `INSERT INTO events (name, description, date, venue, total_seats, created_by) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [name, description, date, venue, total_seats, req.user.id]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update event
router.put('/:id', authMiddleware, async (req, res) => {
  const { name, description, date, venue, total_seats } = req.body;
  
  try {
    const result = await pool.query(
      `UPDATE events 
       SET name = $1, description = $2, date = $3, venue = $4, total_seats = $5
       WHERE id = $6
       RETURNING *`,
      [name, description, date, venue, total_seats, req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete event
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM events WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;