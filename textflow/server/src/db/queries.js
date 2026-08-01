import { getDatabase, runQuery, getQuery } from './init.js';

/**
 * Creates a new user record in the SQLite database.
 * @param {object} userData - { email, password_hash, external_customer_id, flexprice_customer_id, flexprice_subscription_id, plan }
 * @returns {Promise<object>} The created user record
 */
export async function createUser(userData) {
  const db = getDatabase();
  try {
    const sql = `
      INSERT INTO users (email, password_hash, external_customer_id, flexprice_customer_id, flexprice_subscription_id, plan)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const params = [
      userData.email.toLowerCase().trim(),
      userData.password_hash,
      userData.external_customer_id,
      userData.flexprice_customer_id || null,
      userData.flexprice_subscription_id || null,
      userData.plan || 'free'
    ];
    
    const result = await runQuery(db, sql, params);
    
    // Fetch and return the newly created user
    const userSql = 'SELECT id, email, external_customer_id, flexprice_customer_id, flexprice_subscription_id, plan, created_at FROM users WHERE id = ?';
    const newUser = await getQuery(db, userSql, [result.id]);
    return newUser;
  } finally {
    db.close();
  }
}

/**
 * Finds a user by their email address.
 * @param {string} email - Email address
 * @returns {Promise<object|null>} User record (with password_hash) or null
 */
export async function getUserByEmail(email) {
  const db = getDatabase();
  try {
    const sql = 'SELECT * FROM users WHERE LOWER(email) = ?';
    const row = await getQuery(db, sql, [email.toLowerCase().trim()]);
    return row || null;
  } finally {
    db.close();
  }
}

/**
 * Finds a user by their internal database ID.
 * @param {number} id - User database ID
 * @returns {Promise<object|null>} User record (without password_hash) or null
 */
export async function getUserById(id) {
  const db = getDatabase();
  try {
    const sql = 'SELECT id, email, external_customer_id, flexprice_customer_id, flexprice_subscription_id, plan, created_at FROM users WHERE id = ?';
    const row = await getQuery(db, sql, [id]);
    return row || null;
  } finally {
    db.close();
  }
}

/**
 * Updates a user's Flexprice customer and subscription IDs.
 * @param {number} userId - Local user database ID
 * @param {string} customerId - Flexprice internal customer ID
 * @param {string} subscriptionId - Flexprice internal subscription ID
 * @returns {Promise<boolean>} Success indication
 */
export async function updateUserFlexpriceIds(userId, customerId, subscriptionId) {
  const db = getDatabase();
  try {
    const sql = `
      UPDATE users 
      SET flexprice_customer_id = ?, flexprice_subscription_id = ?
      WHERE id = ?
    `;
    const result = await runQuery(db, sql, [customerId, subscriptionId, userId]);
    return result.changes > 0;
  } finally {
    db.close();
  }
}

/**
 * Updates a user's plan.
 * @param {number} userId - Local user database ID
 * @param {string} plan - The new plan name ('free', 'pro')
 * @returns {Promise<boolean>} Success indication
 */
export async function updateUserPlan(userId, plan) {
  const db = getDatabase();
  try {
    const sql = `
      UPDATE users 
      SET plan = ?
      WHERE id = ?
    `;
    const result = await runQuery(db, sql, [plan.toLowerCase().trim(), userId]);
    return result.changes > 0;
  } finally {
    db.close();
  }
}
