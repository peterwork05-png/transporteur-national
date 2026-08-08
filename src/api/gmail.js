import Imap from 'imap';
import { simpleParser } from 'mailparser';
import pool from '../db/index.js';

// Parse EFT details from email body
function parseRemittance(text, html) {
  // Use HTML if available — strip tags for text extraction
  let cleanText = '';
  if (html) {
    cleanText = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&#\d+;/g, ' ');
  }
  cleanText += ' ' + (text || '');
  cleanText = cleanText.replace(/\s+/g, ' ').trim();

  // Extract EFT number — Staples format: "EFT No.: 5045761"
  let eftNumber = null;
  const eftPatterns = [
    /EFT\s*No\.?\s*:?\s*(\d{7,})/i,
    /Document\s+Number\s*[–-]\s*(\d{7,})/i,
    /EFT\s*#?\s*(\d{7,})/i,
  ];
  for (const pattern of eftPatterns) {
    const match = cleanText.match(pattern);
    if (match) { eftNumber = match[1]; break; }
  }

  // Extract total amount — last "Total : X,XXX.XX" in the email
  let amount = null;
  const totalMatches = [...cleanText.matchAll(/Total\s*:\s*([\d,]+\.\d{2})/gi)];
  if (totalMatches.length > 0) {
    const lastTotal = totalMatches[totalMatches.length - 1];
    const val = parseFloat(lastTotal[1].replace(/,/g, ''));
    if (val > 100) amount = val;
  }

  // Extract invoice numbers — Staples table format: "501 02/13/26 ... 4,311.51"
  const invoiceNumbers = [];
  // Match invoice number followed by date MM/DD/YY
  const tablePattern = /\b(\d{3,6})\s+\d{2}\/\d{2}\/\d{2}/g;
  let match;
  while ((match = tablePattern.exec(cleanText)) !== null) {
    const num = match[1];
    // Exclude vendor number (5177319) and keep reasonable invoice numbers
    if (parseInt(num) < 10000 && parseInt(num) > 400 && !invoiceNumbers.includes(num)) {
      invoiceNumbers.push(num);
    }
  }

  return { eftNumber, amount, invoiceNumbers };
}

// Check Gmail for remittance emails and auto-match invoices
export async function checkGmailRemittances() {
  return new Promise((resolve, reject) => {
    const results = { matched: [], unmatched: [], errors: [] };

    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      return resolve({ ...results, errors: ['Gmail credentials not configured'] });
    }

    const imap = new Imap({
      user:     process.env.GMAIL_USER,
      password: process.env.GMAIL_APP_PASSWORD,
      host:     'imap.gmail.com',
      port:     993,
      tls:      true,
      tlsOptions: { rejectUnauthorized: false },
      authTimeout: 10000,
    });

    imap.once('error', (err) => {
      console.error('IMAP error:', err);
      resolve({ ...results, errors: [err.message] });
    });

    imap.once('ready', () => {
      imap.openBox('INBOX', false, async (err, box) => {
        if (err) { imap.end(); return resolve({ ...results, errors: [err.message] }); }

        // Search specifically for StaplesAP remittance emails from last 90 days
        const since = new Date();
        since.setDate(since.getDate() - 90);

        const searchCriteria = [
          ['SINCE', since],
          ['FROM', 'StaplesAP@staples.com'],
          ['SUBJECT', 'Payment Remittance'],
        ];

        imap.search(searchCriteria, async (err, uids) => {
          if (err || !uids || uids.length === 0) {
            imap.end();
            return resolve({ ...results, message: 'No remittance emails found from StaplesAP@staples.com' });
          }

          console.log(`📧 Found ${uids.length} Staples remittance emails`);

          // Process last 20 emails
          const fetch = imap.fetch(uids.slice(-20), { bodies: '' });
          const emails = [];

          fetch.on('message', (msg) => {
            msg.on('body', (stream) => {
              simpleParser(stream, async (err, parsed) => {
                if (err) return;
                emails.push(parsed);
              });
            });
          });

          fetch.once('end', async () => {
            for (const email of emails) {
              try {
                const { eftNumber, amount, invoiceNumbers } = parseRemittance(email.text, email.html);

                console.log(`📧 Email: EFT=${eftNumber}, Amount=${amount}, Invoices=${invoiceNumbers}`);

                if (!eftNumber) {
                  results.unmatched.push({
                    eftNumber: 'unknown',
                    amount,
                    emailFrom: email.from?.text,
                    emailSubject: email.subject,
                    reason: 'Could not parse EFT number',
                  });
                  continue;
                }

                // Check if already processed
                const { rows: existing } = await pool.query(
                  `SELECT id FROM invoices WHERE eft_number = $1 LIMIT 1`,
                  [eftNumber]
                );
                if (existing.length > 0) {
                  results.matched.push({ eftNumber, status: 'already_processed' });
                  continue;
                }

                let matchedInvoices = [];

                // Match by specific invoice numbers first
                if (invoiceNumbers.length > 0) {
                  const { rows } = await pool.query(
                    `SELECT * FROM invoices WHERE id = ANY($1::int[]) AND status != 'paid'`,
                    [invoiceNumbers.map(Number).filter(n => !isNaN(n))]
                  );
                  matchedInvoices = rows;
                }

                // Fall back to amount matching
                if (matchedInvoices.length === 0 && amount) {
                  const { rows } = await pool.query(`
                    SELECT * FROM invoices 
                    WHERE status != 'paid'
                    AND ABS(COALESCE(total, amount) - $1) < 1.00
                    ORDER BY created_at DESC
                    LIMIT 5
                  `, [amount]);
                  matchedInvoices = rows;
                }

                if (matchedInvoices.length > 0) {
                  for (const inv of matchedInvoices) {
                    await pool.query(
                      `UPDATE invoices SET status = 'paid', eft_number = $1, paid_at = NOW() WHERE id = $2`,
                      [eftNumber, inv.id]
                    );
                  }
                  results.matched.push({
                    eftNumber,
                    amount,
                    invoicesMatched: matchedInvoices.map(i => i.id),
                    emailFrom: email.from?.text,
                    emailDate: email.date,
                  });
                  console.log(`✅ Matched EFT ${eftNumber} → invoices ${matchedInvoices.map(i=>i.id).join(', ')}`);
                } else {
                  results.unmatched.push({
                    eftNumber,
                    amount,
                    invoiceNumbers,
                    emailFrom: email.from?.text,
                    emailDate: email.date,
                    reason: invoiceNumbers.length > 0
                      ? `Invoices [${invoiceNumbers.join(', ')}] not found in app or already paid`
                      : 'No matching pending invoices found',
                  });
                  console.log(`⚠️ Could not match EFT ${eftNumber} — invoices: ${invoiceNumbers.join(', ')}`);
                }
              } catch (e) {
                console.error('Email processing error:', e);
                results.errors.push(e.message);
              }
            }

            imap.end();
            resolve(results);
          });

          fetch.once('error', (err) => {
            imap.end();
            resolve({ ...results, errors: [err.message] });
          });
        });
      });
    });

    imap.connect();
  });
}
