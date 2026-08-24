import express from 'express';
import pool from '../config/database.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Get all venues
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM venues ORDER BY name ASC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get venues error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single venue
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM venues WHERE id = $1',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Venue not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get venue error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create venue
router.post('/', authMiddleware, async (req, res) => {
  const { name, address, capacity, description } = req.body;
  
  try {
    const result = await pool.query(
      `INSERT INTO venues (name, address, capacity, description, created_by) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [name, address, capacity, description, req.user.id]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create venue error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update venue
router.put('/:id', authMiddleware, async (req, res) => {
  const { name, address, capacity, description } = req.body;
  
  try {
    const result = await pool.query(
      `UPDATE venues 
       SET name = $1, address = $2, capacity = $3, description = $4
       WHERE id = $5
       RETURNING *`,
      [name, address, capacity, description, req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Venue not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update venue error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete venue
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM venues WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Venue not found' });
    }
    
    res.json({ message: 'Venue deleted successfully' });
  } catch (error) {
    console.error('Delete venue error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
