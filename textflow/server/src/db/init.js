import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '../../data/textflow.db');

export function initDatabase() {
  const db = new sqlite3.Database(dbPath);
  
  db.serialize(() => {
    // Enable foreign keys
    db.run('PRAGMA foreign_keys = ON');
    
    // Create users table
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        external_customer_id TEXT UNIQUE NOT NULL,
        flexprice_customer_id TEXT,
        flexprice_subscription_id TEXT,
        plan TEXT NOT NULL DEFAULT 'free',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create operations table
    db.run(`
      CREATE TABLE IF NOT EXISTS operations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        operation_type TEXT NOT NULL,
        tone TEXT,
        input_chars INTEGER NOT NULL,
        input_preview TEXT,
        output_preview TEXT,
        flexprice_event_id TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create simulated_customers table
    db.run(`
      CREATE TABLE IF NOT EXISTS simulated_customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        external_customer_id TEXT UNIQUE NOT NULL,
        profile TEXT NOT NULL,
        flexprice_customer_id TEXT,
        flexprice_subscription_id TEXT
      )
    `, (err) => {
      if (err) {
        console.error('Error initializing database tables:', err);
      } else {
        console.log('✅ Database initialized successfully');
      }
    });
  });
  
  db.close();
}

export function getDatabase() {
  return new sqlite3.Database(dbPath);
}

// Helpers to work with sqlite3 asynchronously using Promises
export function runQuery(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

export function getQuery(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

export function allQuery(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}
