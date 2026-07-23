import Imap from 'imap';
import { simpleParser } from 'mailparser';
import pool from '../db/index.js';

// Parse EFT details from email body
function parseRemittance(text) {
  // Clean up whitespace
  const cleanText = text.replace(/\s+/g, ' ').trim();

  // Extract EFT number — Staples format: "EFT No.: 5045761"
  let eftNumber = null;
  const eftPatterns = [
    /EFT\s*No\.?\s*:?\s*(\d+)/i,
    /EFT\s*#?\s*(\d+)/i,
    /reference\s*#?\s*(\d+)/i,
    /payment\s*(?:no|number|#)\.?\s*:?\s*(\d+)/i,
    /transaction\s*#?\s*(\d+)/i,
  ];
  for (const pattern of eftPatterns) {
    const match = cleanText.match(pattern);
    if (match) { eftNumber = match[1]; break; }
  }

  // Extract total amount — Staples format: "Total : 7,674.53"
  let amount = null;
  const amountPatterns = [
    /Total\s*:\s*([\d,]+\.?\d*)/i,
    /Pay\s*Amount\s*([\d,]+\.?\d*)/i,
    /total\s+amount\s*:?\s*\$?([\d,]+\.?\d*)/i,
  ];
  for (const pattern of amountPatterns) {
    const matches = [...cleanText.matchAll(new RegExp(pattern.source, 'gi'))];
    if (matches.length > 0) {
      // Take the last match (the grand total, not individual line items)
      const lastMatch = matches[matches.length - 1];
      const val = parseFloat(lastMatch[1].replace(/,/g, ''));
      if (val > 100) { amount = val; break; }
    }
  }

  // Extract invoice numbers — Staples lists them as plain numbers in table
  const invoiceNumbers = [];
  
  // First try explicit invoice patterns
  const explicitPatterns = [
    /invoice\s*(?:no\.?|#)?\s*:?\s*(\d{3,6})/gi,
    /inv\.?\s*#?\s*(\d{3,6})/gi,
  ];
  for (const pattern of explicitPatterns) {
    let match;
    while ((match = pattern.exec(cleanText)) !== null) {
      const num = match[1];
      if (!invoiceNumbers.includes(num)) invoiceNumbers.push(num);
    }
  }

  // If no explicit invoice patterns, look for Staples table format
  // Lines with: number, date (MM/DD/YY), amount pattern
  if (invoiceNumbers.length === 0) {
    const tablePattern = /\b(\d{3,6})\s+\d{2}\/\d{2}\/\d{2}/g;
    let match;
    while ((match = tablePattern.exec(cleanText)) !== null) {
      const num = match[1];
      // Filter out vendor numbers (5177319 is too long) and keep invoice-sized numbers
      if (parseInt(num) < 100000 && !invoiceNumbers.includes(num)) {
        invoiceNumbers.push(num);
      }
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

        // Search for remittance emails from last 30 days
        const since = new Date();
        since.setDate(since.getDate() - 30);
        const sinceStr = since.toISOString().split('T')[0];

        const searchCriteria = [
          ['SINCE', sinceStr],
          ['OR',
            ['FROM', 'staples'],
            ['OR',
              ['FROM', 'bureauengros'],
              ['OR',
                ['SUBJECT', 'remittance'],
                ['OR',
                  ['SUBJECT', 'payment'],
                  ['SUBJECT', 'EFT']
                ]
              ]
            ]
          ]
        ];

        imap.search(searchCriteria, async (err, uids) => {
          if (err || !uids || uids.length === 0) {
            imap.end();
            return resolve({ ...results, message: 'No remittance emails found' });
          }

          console.log(`📧 Found ${uids.length} potential remittance emails`);

          const fetch = imap.fetch(uids.slice(-10), { bodies: '' }); // Last 10 emails
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
            // Process each email
            for (const email of emails) {
              try {
                const text = (email.text || '') + ' ' + (email.html || '');
                const { eftNumber, amount, invoiceNumbers } = parseRemittance(text);

                if (!eftNumber && !amount) continue;

                console.log(`📧 Processing email: EFT=${eftNumber}, Amount=${amount}, Invoices=${invoiceNumbers}`);

                // Check if already processed
                if (eftNumber) {
                  const { rows: existing } = await pool.query(
                    'SELECT id FROM invoices WHERE eft_number = $1 LIMIT 1',
                    [eftNumber]
                  );
                  if (existing.length > 0) {
                    results.matched.push({ eftNumber, status: 'already_processed' });
                    continue;
                  }
                }

                // Find matching pending invoices by amount
                let matchedInvoices = [];

                // Try to match by specific invoice numbers first
                if (invoiceNumbers.length > 0) {
                  const { rows } = await pool.query(
                    `SELECT * FROM invoices WHERE id = ANY($1::int[]) AND status = 'pending'`,
                    [invoiceNumbers.map(Number).filter(n => !isNaN(n))]
                  );
                  matchedInvoices = rows;
                }

                // If no invoice number match, try to match by total amount
                if (matchedInvoices.length === 0 && amount) {
                  const { rows } = await pool.query(`
                    SELECT * FROM invoices 
                    WHERE status = 'pending' 
                    AND ABS(total - $1) < 1.00
                    ORDER BY created_at DESC
                    LIMIT 5
                  `, [amount]);
                  matchedInvoices = rows;
                }

                // Try sum matching — find combination of pending invoices that sum to amount
                if (matchedInvoices.length === 0 && amount) {
                  const { rows: pending } = await pool.query(
                    `SELECT * FROM invoices WHERE status = 'pending' ORDER BY total DESC`
                  );
                  
                  // Simple greedy sum match
                  let remaining = amount;
                  const sumMatched = [];
                  for (const inv of pending) {
                    if (Math.abs(parseFloat(inv.total) - remaining) < 1.00) {
                      sumMatched.push(inv);
                      remaining -= parseFloat(inv.total);
                      break;
                    } else if (parseFloat(inv.total) <= remaining + 1.00) {
                      sumMatched.push(inv);
                      remaining -= parseFloat(inv.total);
                    }
                    if (Math.abs(remaining) < 1.00) break;
                  }
                  if (Math.abs(remaining) < 1.00) matchedInvoices = sumMatched;
                }

                if (matchedInvoices.length > 0) {
                  // Mark invoices as paid
                  const eftRef = eftNumber || `AUTO-${Date.now()}`;
                  for (const inv of matchedInvoices) {
                    await pool.query(
                      `UPDATE invoices SET status = 'paid', eft_number = $1, paid_at = NOW() WHERE id = $2`,
                      [eftRef, inv.id]
                    );
                  }
                  
                  results.matched.push({
                    eftNumber: eftRef,
                    amount,
                    invoicesMatched: matchedInvoices.map(i => i.id),
                    emailFrom: email.from?.text,
                    emailDate: email.date,
                  });
                  
                  console.log(`✅ Auto-matched EFT ${eftRef} → invoices ${matchedInvoices.map(i=>i.id).join(', ')}`);
                } else {
                  results.unmatched.push({
                    eftNumber,
                    amount,
                    emailFrom: email.from?.text,
                    emailDate: email.date,
                    reason: 'No matching pending invoices found',
                  });
                  console.log(`⚠️ Could not match EFT ${eftNumber} amount $${amount}`);
                }
              } catch (e) {
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
