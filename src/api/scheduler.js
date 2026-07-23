import { checkGmailRemittances } from './gmail.js';

// Run Gmail scan every Thursday, every 2 hours from 11am to 3pm (ET)
export function startScheduler() {
  console.log('📅 Scheduler started');

  setInterval(async () => {
    const now = new Date();
    
    // Convert to Eastern Time (UTC-4 in summer, UTC-5 in winter)
    const etOffset = isDST(now) ? -4 : -5;
    const etHour   = (now.getUTCHours() + etOffset + 24) % 24;
    const etDay    = now.getUTCDay(); // 0=Sun, 4=Thu

    // Only run on Thursdays (4) between 11am and 3pm ET
    // Check every 2 hours: 11am, 1pm, 3pm
    const isThursday   = etDay === 4;
    const isValidHour  = [11, 13, 15].includes(etHour);
    const isTopOfHour  = now.getUTCMinutes() < 5; // within first 5 minutes of the hour

    if (isThursday && isValidHour && isTopOfHour) {
      console.log(`📧 Thursday auto-scan triggered at ${etHour}:00 ET`);
      try {
        const results = await checkGmailRemittances();
        console.log(`✅ Auto-scan complete: ${results.matched?.length || 0} matched, ${results.unmatched?.length || 0} unmatched`);
      } catch(err) {
        console.error('❌ Auto-scan error:', err.message);
      }
    }
  }, 5 * 60 * 1000); // Check every 5 minutes (lightweight check)
}

// Detect Daylight Saving Time for Eastern timezone
function isDST(date) {
  const jan = new Date(date.getFullYear(), 0, 1).getTimezoneOffset();
  const jul = new Date(date.getFullYear(), 6, 1).getTimezoneOffset();
  return Math.max(jan, jul) !== date.getTimezoneOffset();
}
