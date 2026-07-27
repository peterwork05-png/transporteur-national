import { checkGmailRemittances } from './gmail.js';
import { generateLocalInvoices, getInvoicePeriods } from './autoInvoice.js';

export function startScheduler() {
  console.log('📅 Scheduler started');

  setInterval(async () => {
    const now = new Date();
    const etOffset = isDST(now) ? -4 : -5;
    const etHour   = (now.getUTCHours() + etOffset + 24) % 24;
    const etDay    = now.getUTCDay();
    const etDate   = now.getUTCDate();
    const isTopOfHour = now.getUTCMinutes() < 5;

    // Gmail scan — Thursdays 11am, 1pm, 3pm ET
    if (etDay === 4 && [11, 13, 15].includes(etHour) && isTopOfHour) {
      console.log(`📧 Thursday auto-scan triggered at ${etHour}:00 ET`);
      try {
        const results = await checkGmailRemittances();
        console.log(`✅ Auto-scan complete: ${results.matched?.length || 0} matched`);
      } catch(err) { console.error('❌ Auto-scan error:', err.message); }
    }

    // Auto-invoice — 15th and last day of month at noon ET
    const lastDayOfMonth = new Date(now.getFullYear(), now.getUTCMonth() + 1, 0).getDate();
    if (etHour === 12 && isTopOfHour && (etDate === 15 || etDate === lastDayOfMonth)) {
      const { period1, period2 } = getInvoicePeriods(now);
      const period = etDate === 15 ? period1 : period2;
      console.log(`📄 Auto-invoice triggered for ${period.from} – ${period.to}`);
      try {
        const results = await generateLocalInvoices(period.from, period.to);
        console.log(`✅ Auto-invoice: ${results.invoices?.length || 0} invoices created`);
      } catch(err) { console.error('❌ Auto-invoice error:', err.message); }
    }

  }, 5 * 60 * 1000);
}

function isDST(date) {
  const jan = new Date(date.getFullYear(), 0, 1).getTimezoneOffset();
  const jul = new Date(date.getFullYear(), 6, 1).getTimezoneOffset();
  return Math.max(jan, jul) !== date.getTimezoneOffset();
}
