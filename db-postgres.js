const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const db = {
  async query(text, params) {
    const client = await pool.connect();
    try {
      const res = await client.query(text, params);
      return { rows: res.rows, rowCount: res.rowCount };
    } finally {
      client.release();
    }
  },

  async get(text, params) {
    const result = await this.query(text, params);
    return result.rows[0] || null;
  },

  async run(text, params) {
    const client = await pool.connect();
    try {
      const res = await client.query(text, params);
      if (res.rows && res.rows.length > 0) {
        return res.rows[0];
      }
      return { rowCount: res.rowCount };
    } finally {
      client.release();
    }
  },

  async all(text, params) {
    const result = await this.query(text, params);
    return result.rows;
  },

  async exec(text) {
    const client = await pool.connect();
    try {
      await client.query(text);
    } finally {
      client.release();
    }
  },

  pool
};

console.log('✅ PostgreSQL подключён');

module.exports = db;
