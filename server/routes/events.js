import pool from '../config/database.js';
import express from 'express';
import { body, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/index.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { getShowSeatMap, updateShowStatus } from '../utils/seatManager.js';

const router = express.Router();

/**
 * Create a new event (organiser only)
 */
router.post(
  '/',
  authMiddleware,
  requireRole('organiser', 'admin'),
  [
    body('title').notEmpty(),
    body('description').optional(),
    body('type').isIn(['movie', 'concert']),
    body('venue_id').notEmpty(),
    body('event_date').isISO8601(),
    body('event_time').notEmpty(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { title, description, type, venue_id, event_date, event_time, poster_url } =
        req.body;

      const result = await query(
        `INSERT INTO events (title, description, type, venue_id, organiser_id, event_date, event_time, poster_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [title, description, type, venue_id, req.user.userId, event_date, event_time, poster_url]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Event creation error:', error);
      res.status(500).json({ error: 'Failed to create event' });
    }
  }
);

/**
 * Get all events with filtering
 */
router.get('/', async (req, res) => {
  try {
    const { type, date, city } = req.query;

    let queryStr = `
      SELECT e.*, v.name as venue_name, v.city, u.name as organiser_name
      FROM events e
      JOIN venues v ON e.venue_id = v.id
      JOIN users u ON e.organiser_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (type) {
      queryStr += ` AND e.type = $${paramCount++}`;
      params.push(type);
    }

    if (date) {
      queryStr += ` AND e.event_date = $${paramCount++}`;
      params.push(date);
    }

    if (city) {
      queryStr += ` AND v.city ILIKE $${paramCount++}`;
      params.push(`%${city}%`);
    }

    queryStr += ' ORDER BY e.event_date ASC';

    const result = await query(queryStr, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Events fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

/**
 * Get event details
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT e.*, v.name as venue_name, v.city, u.name as organiser_name
       FROM events e
       JOIN venues v ON e.venue_id = v.id
       JOIN users u ON e.organiser_id = u.id
       WHERE e.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Event fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

/**
 * Create a show (performance of event)
 */
router.post(
  '/:eventId/shows',
  authMiddleware,
  requireRole('organiser', 'admin'),
  [body('show_time').isISO8601()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { eventId } = req.params;
      const { show_time } = req.body;

      // Get event details
      const eventResult = await query('SELECT venue_id FROM events WHERE id = $1', [eventId]);

      if (eventResult.rows.length === 0) {
        return res.status(404).json({ error: 'Event not found' });
      }

      const { venue_id } = eventResult.rows[0];

      // Create show
      const showResult = await query(
        `INSERT INTO shows (event_id, venue_id, show_time, status)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [eventId, venue_id, show_time, 'available']
      );

      const show = showResult.rows[0];

      // Get all seats for the venue and create show_seats entries
      const seatsResult = await query('SELECT id FROM seats WHERE venue_id = $1', [venue_id]);

      for (const seat of seatsResult.rows) {
        await query(
          `INSERT INTO show_seats (show_id, seat_id, status)
           VALUES ($1, $2, $3)`,
          [show.id, seat.id, 'available']
        );
      }

      res.status(201).json(show);
    } catch (error) {
      console.error('Show creation error:', error);
      res.status(500).json({ error: 'Failed to create show' });
    }
  }
);

/**
 * Get show details with seat map
 */
router.get('/:eventId/shows/:showId', async (req, res) => {
  try {
    const { eventId, showId } = req.params;

    // Get show details
    const showResult = await query(
      `SELECT s.*, e.title, e.type FROM shows s
       JOIN events e ON s.event_id = e.id
       WHERE s.id = $1 AND s.event_id = $2`,
      [showId, eventId]
    );

    if (showResult.rows.length === 0) {
      return res.status(404).json({ error: 'Show not found' });
    }

    const show = showResult.rows[0];

    // Get seat map
    const seatMap = await getShowSeatMap(showId);

    res.json({
      show,
      seats: seatMap,
    });
  } catch (error) {
    console.error('Show fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch show' });
  }
});

/**
 * Get all shows for an event
 */
router.get('/:eventId/shows', async (req, res) => {
  try {
    const { eventId } = req.params;

    const result = await query(
      `SELECT * FROM shows
       WHERE event_id = $1
       ORDER BY show_time ASC`,
      [eventId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Shows fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch shows' });
  }
});

export default router;
