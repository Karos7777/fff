// db/index.js - Универсальный адаптер для PostgreSQL
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const db = {
  // Универсальный query - возвращает объект с rows
  async query(text, params) {
    const client = await pool.connect();
    try {
      const res = await client.query(text, params);
      return { rows: res.rows, rowCount: res.rowCount };
    } finally {
      client.release();
    }
  },

  // Получить одну строку
  async get(text, params) {
    const result = await this.query(text, params);
    return result.rows[0] || null;
  },

  // Выполнить запрос (INSERT/UPDATE/DELETE)
  async run(text, params) {
    const result = await this.query(text, params);
    return { 
      rowCount: result.rowCount,
      rows: result.rows 
    };
  },

  // Получить все строки
  async all(text, params) {
    const result = await this.query(text, params);
    return result.rows;
  },

  // Прямой доступ к pool для специальных случаев
  pool
};

console.log('✅ DB подключён через db/index.js');

module.exports = db;
