const Database = require('better-sqlite3');

// Подключаемся к базе данных
const db = new Database('shop.db');

try {
  // Создаем товар за 0.01 TON
  const insertProduct1 = db.prepare(`
    INSERT INTO products (name, description, price, category, stock, infinite_stock, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  const result1 = insertProduct1.run(
    'Тест TON - Консультация 15 мин',
    'Быстрая консультация по разработке (тест за 0.01 TON)',
    1, // 1 рубль = примерно 0.01 TON по текущему курсу
    'consultation',
    100,
    0,
    1
  );
  
  console.log('✅ Товар за 0.01 TON создан с ID:', result1.lastInsertRowid);

  // Создаем товар за 1 звезду
  const insertProduct2 = db.prepare(`
    INSERT INTO products (name, description, price, category, stock, infinite_stock, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  const result2 = insertProduct2.run(
    'Тест Stars - Мини-консультация',
    'Короткая консультация через Telegram (тест за 1 звезду)',
    1, // 1 рубль = 1 звезда
    'consultation', 
    100,
    0,
    1
  );
  
  console.log('✅ Товар за 1 звезду создан с ID:', result2.lastInsertRowid);

  // Проверяем созданные товары
  const getProducts = db.prepare('SELECT * FROM products WHERE id IN (?, ?)');
  const products = getProducts.all(result1.lastInsertRowid, result2.lastInsertRowid);
  
  console.log('\n📦 Созданные тестовые товары:');
  products.forEach(product => {
    console.log(`- ID: ${product.id}, Название: ${product.name}, Цена: ${product.price} ₽`);
  });
  
} catch (error) {
  console.error('❌ Ошибка создания тестовых товаров:', error);
} finally {
  db.close();
}
