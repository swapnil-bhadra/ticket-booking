import { query } from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * SeatManager handles all seat-related operations with concurrency protection
 * and TTL enforcement for held seats.
 */

/**
 * Atomically hold a seat with TTL
 * Uses database transaction to prevent race conditions
 */
export async function holdSeat(showId, seatId, userId, ttlMinutes = 10) {
  const client = await query('BEGIN');
  
  try {
    // Lock the row to prevent concurrent updates
    const seatResult = await query(
      `SELECT id, status FROM show_seats 
       WHERE show_id = $1 AND seat_id = $2 
       FOR UPDATE`,
      [showId, seatId]
    );

    if (seatResult.rows.length === 0) {
      throw new Error('Seat not found for this show');
    }

    const seat = seatResult.rows[0];
    
    // Check if seat is available
    if (seat.status !== 'available') {
      throw new Error(`Seat is ${seat.status} and cannot be held`);
    }

    // Calculate hold expiry time
    const heldUntil = new Date(Date.now() + ttlMinutes * 60 * 1000);

    // Update seat status to held
    const updateResult = await query(
      `UPDATE show_seats 
       SET status = $1, held_by = $2, held_until = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      ['held', userId, heldUntil, seat.id]
    );

    // Log the action
    await query(
      `INSERT INTO audit_log (show_seat_id, action, user_id, previous_status, new_status)
       VALUES ($1, $2, $3, $4, $5)`,
      [seat.id, 'hold', userId, 'available', 'held']
    );

    await query('COMMIT');
    return updateResult.rows[0];

  } catch (error) {
    await query('ROLLBACK');
    throw error;
  }
}

/**
 * Release a held seat
 * Can only release if held by the same user or if TTL expired
 */
export async function releaseSeat(showId, seatId, userId) {
  try {
    const result = await query(
      `UPDATE show_seats 
       SET status = $1, held_by = NULL, held_until = NULL, updated_at = NOW()
       WHERE show_id = $2 AND seat_id = $3 
       AND (held_by = $4 OR held_until < NOW())
       AND status = 'held'
       RETURNING *`,
      ['available', showId, seatId, userId]
    );

    if (result.rows.length === 0) {
      throw new Error('Cannot release seat: not held by user or already expired');
    }

    // Log the action
    await query(
      `INSERT INTO audit_log (show_seat_id, action, user_id, previous_status, new_status)
       VALUES ($1, $2, $3, $4, $5)`,
      [result.rows[0].id, 'release', userId, 'held', 'available']
    );

    return result.rows[0];
  } catch (error) {
    throw error;
  }
}

/**
 * Book a seat - atomically transition from held to booked
 * Ensures only the user who held it can book it
 */
export async function bookSeat(showId, seatId, userId) {
  try {
    const result = await query(
      `UPDATE show_seats 
       SET status = $1, booked_by = $2, held_by = NULL, held_until = NULL, updated_at = NOW()
       WHERE show_id = $3 AND seat_id = $4 
       AND held_by = $5 AND status = 'held'
       RETURNING *`,
      ['booked', userId, showId, seatId, userId]
    );

    if (result.rows.length === 0) {
      throw new Error('Cannot book seat: not held by user or already taken');
    }

    // Log the action
    await query(
      `INSERT INTO audit_log (show_seat_id, action, user_id, previous_status, new_status)
       VALUES ($1, $2, $3, $4, $5)`,
      [result.rows[0].id, 'book', userId, 'held', 'booked']
    );

    return result.rows[0];
  } catch (error) {
    throw error;
  }
}

/**
 * Get seat status map for a show
 * Returns organized seat layout with status information
 */
export async function getShowSeatMap(showId) {
  try {
    const result = await query(
      `SELECT 
        ss.id,
        ss.status,
        s.seat_number,
        s.row_num,
        s.col_num,
        sc.name as category,
        sc.price
       FROM show_seats ss
       JOIN seats s ON ss.seat_id = s.id
       JOIN seat_categories sc ON s.category_id = sc.id
       WHERE ss.show_id = $1
       ORDER BY s.row_num, s.col_num`,
      [showId]
    );

    return result.rows;
  } catch (error) {
    throw error;
  }
}

/**
 * Clean up expired held seats (TTL enforcement)
 * Called periodically by scheduler
 */
export async function releaseExpiredSeats() {
  try {
    const result = await query(
      `UPDATE show_seats 
       SET status = $1, held_by = NULL, held_until = NULL, updated_at = NOW()
       WHERE status = 'held' AND held_until < NOW()
       RETURNING *`,
      ['available']
    );

    // Log all releases
    for (const seat of result.rows) {
      await query(
        `INSERT INTO audit_log (show_seat_id, action, previous_status, new_status)
         VALUES ($1, $2, $3, $4)`,
        [seat.id, 'auto_release', 'held', 'available']
      );
    }

    console.log(`Released ${result.rows.length} expired held seats`);
    return result.rows.length;
  } catch (error) {
    console.error('Error releasing expired seats:', error);
    throw error;
  }
}

/**
 * Check and update show status (set to sold_out if all seats booked)
 */
export async function updateShowStatus(showId) {
  try {
    // Count available and held seats
    const result = await query(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'booked' THEN 1 ELSE 0 END) as booked,
        SUM(CASE WHEN status IN ('available', 'held') THEN 1 ELSE 0 END) as available_or_held
       FROM show_seats
       WHERE show_id = $1`,
      [showId]
    );

    const { total, booked, available_or_held } = result.rows[0];
    
    if (available_or_held === 0) {
      // All seats are either booked or held - mark as sold out
      await query(
        `UPDATE shows SET status = $1, updated_at = NOW() WHERE id = $2`,
        ['sold_out', showId]
      );
      return 'sold_out';
    } else {
      // Seats still available
      await query(
        `UPDATE shows SET status = $1, updated_at = NOW() WHERE id = $2`,
        ['available', showId]
      );
      return 'available';
    }
  } catch (error) {
    console.error('Error updating show status:', error);
    throw error;
  }
}
