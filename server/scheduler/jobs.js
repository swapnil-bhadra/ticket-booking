import cron from 'node-cron';
import { releaseExpiredSeats } from '../utils/seatManager.js';
import { processExpiredOffers } from '../utils/waitlistManager.js';

/**
 * Schedule background jobs for seat hold TTL and waitlist offer expiry
 */

// Release expired held seats every minute
export function scheduleExpiredSeatRelease() {
  cron.schedule('* * * * *', async () => {
    try {
      await releaseExpiredSeats();
    } catch (error) {
      console.error('Error in expired seat release job:', error);
    }
  });
  console.log('Scheduled: Expired seat release job (every minute)');
}

// Process expired waitlist offers every minute
export function scheduleExpiredOfferProcessing() {
  cron.schedule('* * * * *', async () => {
    try {
      await processExpiredOffers();
    } catch (error) {
      console.error('Error in expired offer processing job:', error);
    }
  });
  console.log('Scheduled: Expired offer processing job (every minute)');
}

/**
 * Initialize all scheduled jobs
 */
export function initializeScheduler() {
  scheduleExpiredSeatRelease();
  scheduleExpiredOfferProcessing();
  console.log('Scheduler initialized');
}
