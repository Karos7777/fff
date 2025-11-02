const Database = require('better-sqlite3');

// Подключаемся к базе данных
const db = new Database('shop.db');

try {
  // Создаем тестовый товар
  const insertProduct = db.prepare(`
    INSERT INTO products (name, description, price, category, stock, infinite_stock, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  const result = insertProduct.run(
    'Тестовый товар',
    'Описание тестового товара для проверки системы платежей',
    1000,
    'development',
    10,
    0,
    1
  );
  
  console.log('✅ Тестовый товар создан с ID:', result.lastInsertRowid);
  
  // Проверяем, что товар создался
  const getProduct = db.prepare('SELECT * FROM products WHERE id = ?');
  const product = getProduct.get(result.lastInsertRowid);
  
  console.log('📦 Товар:', product);
  
} catch (error) {
  console.error('❌ Ошибка создания тестового товара:', error);
} finally {
  db.close();
}
