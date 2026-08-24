import pool from '../config/database.js';
import express from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../db/index.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';

const router = express.Router();

/**
 * Create a venue (admin only)
 */
router.post(
  '/',
  authMiddleware,
  requireRole('admin'),
  [
    body('name').notEmpty(),
    body('city').notEmpty(),
    body('capacity').isInt({ min: 1 }),
    body('seats').isArray(),
    body('categories').isArray(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, city, capacity, seats, categories } = req.body;

      // Start transaction
      await query('BEGIN');

      try {
        // Create venue
        const venueResult = await query(
          `INSERT INTO venues (name, city, capacity, created_by)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [name, city, capacity, req.user.userId]
        );

        const venue = venueResult.rows[0];

        // Create seat categories
        const categoryMap = {};
        for (const category of categories) {
          const catResult = await query(
            `INSERT INTO seat_categories (venue_id, name, price)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [venue.id, category.name, category.price]
          );
          categoryMap[category.name] = catResult.rows[0].id;
        }

        // Create seats
        for (const seat of seats) {
          const categoryId = categoryMap[seat.category];
          if (categoryId) {
            await query(
              `INSERT INTO seats (venue_id, seat_number, row_num, col_num, category_id)
               VALUES ($1, $2, $3, $4, $5)`,
              [venue.id, seat.number, seat.row, seat.col, categoryId]
            );
          }
        }

        await query('COMMIT');

        res.status(201).json({
          venue,
          categoryCount: categories.length,
          seatCount: seats.length,
        });
      } catch (error) {
        await query('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error('Venue creation error:', error);
      res.status(500).json({ error: 'Failed to create venue' });
    }
  }
);

/**
 * Get all venues
 */
router.get('/', async (req, res) => {
  try {
    const result = await query(`
      SELECT v.*, u.name as created_by_name, COUNT(s.id) as seat_count
      FROM venues v
      JOIN users u ON v.created_by = u.id
      LEFT JOIN seats s ON v.id = s.venue_id
      GROUP BY v.id, u.name
      ORDER BY v.name
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Venues fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch venues' });
  }
});

/**
 * Get venue details
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const venueResult = await query(
      `SELECT v.*, u.name as created_by_name
       FROM venues v
       JOIN users u ON v.created_by = u.id
       WHERE v.id = $1`,
      [id]
    );

    if (venueResult.rows.length === 0) {
      return res.status(404).json({ error: 'Venue not found' });
    }

    const venue = venueResult.rows[0];

    // Get categories
    const categoriesResult = await query(
      'SELECT * FROM seat_categories WHERE venue_id = $1 ORDER BY price DESC',
      [id]
    );

    // Get seats
    const seatsResult = await query(
      `SELECT s.*, sc.name as category
       FROM seats s
       JOIN seat_categories sc ON s.category_id = sc.id
       WHERE s.venue_id = $1
       ORDER BY s.row_num, s.col_num`,
      [id]
    );

    res.json({
      ...venue,
      categories: categoriesResult.rows,
      seats: seatsResult.rows,
    });
  } catch (error) {
    console.error('Venue fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch venue' });
  }
});

export default router;
