// PostgreSQL адаптер с совместимым API как у better-sqlite3
const { Pool } = require('pg');

class PostgresAdapter {
    constructor(connectionString) {
        this.pool = new Pool({
            connectionString: connectionString || process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? {
                rejectUnauthorized: false
            } : false
        });
        
        console.log('🔌 Подключение к PostgreSQL...');
    }

    // Выполнение SQL без возврата данных (CREATE, INSERT, UPDATE, DELETE)
    exec(sql) {
        return this.pool.query(sql);
    }

    // Подготовка запроса (возвращает объект с методами run, get, all)
    prepare(sql) {
        const pool = this.pool;
        
        // Автоматически добавляем RETURNING id для INSERT запросов
        let modifiedSql = sql;
        if (sql.trim().toUpperCase().startsWith('INSERT') && !sql.toUpperCase().includes('RETURNING')) {
            modifiedSql = sql.trim() + ' RETURNING id';
        }
        
        return {
            // Выполнение INSERT/UPDATE/DELETE с параметрами
            run: async function(...params) {
                try {
                    // Заменяем ? на $1, $2, $3... для PostgreSQL
                    let pgSql = modifiedSql;
                    let paramIndex = 1;
                    pgSql = pgSql.replace(/\?/g, () => `$${paramIndex++}`);
                    
                    const result = await pool.query(pgSql, params);
                    return {
                        changes: result.rowCount,
                        lastInsertRowid: result.rows[0]?.id || null
                    };
                } catch (error) {
                    console.error('❌ [DB RUN] Ошибка:', error.message);
                    console.error('SQL:', modifiedSql);
                    console.error('Params:', params);
                    throw error;
                }
            },

            // Получение одной строки
            get: async function(...params) {
                try {
                    // Заменяем ? на $1, $2, $3... для PostgreSQL
                    let pgSql = sql;
                    let paramIndex = 1;
                    pgSql = pgSql.replace(/\?/g, () => `$${paramIndex++}`);
                    
                    const result = await pool.query(pgSql, params);
                    return result.rows[0] || null;
                } catch (error) {
                    console.error('❌ [DB GET] Ошибка:', error.message);
                    console.error('SQL:', sql);
                    console.error('Params:', params);
                    throw error;
                }
            },

            // Получение всех строк
            all: async function(...params) {
                try {
                    // Заменяем ? на $1, $2, $3... для PostgreSQL
                    let pgSql = sql;
                    let paramIndex = 1;
                    pgSql = pgSql.replace(/\?/g, () => `$${paramIndex++}`);
                    
                    const result = await pool.query(pgSql, params);
                    return result.rows;
                } catch (error) {
                    console.error('❌ [DB ALL] Ошибка:', error.message);
                    console.error('SQL:', sql);
                    console.error('Params:', params);
                    throw error;
                }
            }
        };
    }

    // Транзакция
    transaction(fn) {
        return async () => {
            const client = await this.pool.connect();
            try {
                await client.query('BEGIN');
                const result = await fn();
                await client.query('COMMIT');
                return result;
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
        };
    }

    // Закрытие соединения
    async close() {
        await this.pool.end();
    }
}

module.exports = PostgresAdapter;
