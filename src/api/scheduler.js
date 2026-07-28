import { checkGmailRemittances } from './gmail.js';
import { generateLocalInvoices, getInvoicePeriods } from './autoInvoice.js';
import { generateContractInvoices, getPreviousWeekDates } from './contractInvoice.js';

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

    // Local invoices — 15th and last day of month at noon ET
    const lastDayOfMonth = new Date(now.getFullYear(), now.getUTCMonth() + 1, 0).getDate();
    if (etHour === 12 && isTopOfHour && (etDate === 15 || etDate === lastDayOfMonth)) {
      const { period1, period2 } = getInvoicePeriods(now);
      const period = etDate === 15 ? period1 : period2;
      console.log(`📄 Auto local invoice triggered for ${period.from} – ${period.to}`);
      try {
        const results = await generateLocalInvoices(period.from, period.to);
        console.log(`✅ Local invoices: ${results.invoices?.length || 0} created`);
      } catch(err) { console.error('❌ Local invoice error:', err.message); }
    }

    // Contract invoices — every Sunday at noon ET
    if (etDay === 0 && etHour === 12 && isTopOfHour) {
      const { from, to } = getPreviousWeekDates(now);
      console.log(`📄 Auto contract invoice triggered for ${from} – ${to}`);
      try {
        const results = await generateContractInvoices(from, to, 5);
        console.log(`✅ Contract invoices: ${results.invoices?.length || 0} created`);
      } catch(err) { console.error('❌ Contract invoice error:', err.message); }
    }

  }, 5 * 60 * 1000);
}

function isDST(date) {
  const jan = new Date(date.getFullYear(), 0, 1).getTimezoneOffset();
  const jul = new Date(date.getFullYear(), 6, 1).getTimezoneOffset();
  return Math.max(jan, jul) !== date.getTimezoneOffset();
}
