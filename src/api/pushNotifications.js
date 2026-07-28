// Web Push Notification helper
// Uses fetch to call web-push API directly without npm package

const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL   = process.env.VAPID_EMAIL || 'mailto:transporteurnationalmc@gmail.com';

import pool from '../db/index.js';
import webpush from 'web-push';

webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);

// Save subscription to DB
export async function saveSubscription(subscription, userType, userId) {
  try {
    await pool.query(`
      ALTER TABLE drivers ADD COLUMN IF NOT EXISTS push_subscription JSONB
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        user_type VARCHAR(20),
        user_id VARCHAR(100),
        subscription JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, user_type)
      )
    `);
    await pool.query(`
      INSERT INTO push_subscriptions (user_type, user_id, subscription)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, user_type) DO UPDATE SET subscription = EXCLUDED.subscription
    `, [userType, userId, JSON.stringify(subscription)]);
    return true;
  } catch(err) {
    console.error('Save subscription error:', err);
    return false;
  }
}

// Send notification to specific user
export async function sendNotification(userType, userId, title, body, data = {}) {
  try {
    const { rows } = await pool.query(
      `SELECT subscription FROM push_subscriptions WHERE user_type = $1 AND user_id = $2`,
      [userType, userId]
    );
    if (rows.length === 0) return false;

    const subscription = rows[0].subscription;
    const payload = JSON.stringify({ title, body, data, icon: '/icon-192.png' });

    await webpush.sendNotification(subscription, payload);
    return true;
  } catch(err) {
    console.error('Send notification error:', err.message);
    // Remove invalid subscription
    if (err.statusCode === 410) {
      await pool.query(
        `DELETE FROM push_subscriptions WHERE user_type = $1 AND user_id = $2`,
        [userType, userId]
      );
    }
    return false;
  }
}

// Send notification to all admins
export async function notifyAdmins(title, body, data = {}) {
  try {
    const { rows } = await pool.query(
      `SELECT subscription, user_id FROM push_subscriptions WHERE user_type = 'admin'`
    );
    for (const row of rows) {
      const payload = JSON.stringify({ title, body, data, icon: '/icon-192.png' });
      try {
        await webpush.sendNotification(row.subscription, payload);
      } catch(err) {
        if (err.statusCode === 410) {
          await pool.query(`DELETE FROM push_subscriptions WHERE user_id = $1`, [row.user_id]);
        }
      }
    }
  } catch(err) {
    console.error('Notify admins error:', err);
  }
}
