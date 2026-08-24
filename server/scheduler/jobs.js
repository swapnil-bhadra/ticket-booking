import cron from 'node-cron';
import pool from '../config/database.js';  // ← Add this import

// Function to release expired seats
async function releaseExpiredSeats() {
  try {
    const result = await pool.query(`
      UPDATE seats 
      SET status = 'available', hold_expires_at = NULL 
      WHERE status = 'held' AND hold_expires_at < NOW()
      RETURNING *
    `);
    console.log(`✅ Released ${result.rowCount} expired seats`);
    return result.rows;
  } catch (error) {
    console.error('Error in expired seat release job:', error);
    throw error;
  }
}

// Initialize scheduler
export function initializeScheduler() {
  // Run every minute to check for expired holds
  cron.schedule('* * * * *', async () => {
    try {
      await releaseExpiredSeats();
    } catch (error) {
      console.error('Scheduler error:', error);
    }
  });

  console.log('✅ Scheduler initialized - checking expired seats every minute');
}