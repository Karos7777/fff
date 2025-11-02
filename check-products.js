const Database = require('better-sqlite3');

// Подключаемся к базе данных
const db = new Database('shop.db');

try {
  console.log('\n📦 Проверка всех товаров в базе данных:\n');
  
  // Получаем все товары
  const getAllProducts = db.prepare('SELECT * FROM products ORDER BY id');
  const allProducts = getAllProducts.all();
  
  console.log(`Всего товаров в БД: ${allProducts.length}\n`);
  
  // Выводим информацию о каждом товаре
  allProducts.forEach(product => {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`ID: ${product.id}`);
    console.log(`Название: ${product.name}`);
    console.log(`Описание: ${product.description || 'Нет'}`);
    console.log(`Цена: ${product.price} ₽`);
    console.log(`Категория: ${product.category}`);
    console.log(`Остаток: ${product.infinite_stock ? '∞' : product.stock}`);
    console.log(`Активен: ${product.is_active ? 'Да' : 'Нет'}`);
    console.log(`Создан: ${product.created_at}`);
  });
  
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  
  // Ищем товары с "Тест" в названии
  const getTestProducts = db.prepare("SELECT * FROM products WHERE name LIKE '%Тест%' OR name LIKE '%тест%'");
  const testProducts = getTestProducts.all();
  
  if (testProducts.length > 0) {
    console.log(`⚠️  Найдено ${testProducts.length} тестовых товаров:\n`);
    testProducts.forEach(product => {
      console.log(`  - ID ${product.id}: "${product.name}"`);
    });
    console.log('\n');
  }
  
  // Проверяем активные товары
  const getActiveProducts = db.prepare('SELECT COUNT(*) as count FROM products WHERE is_active = 1');
  const activeCount = getActiveProducts.get();
  console.log(`✅ Активных товаров: ${activeCount.count}`);
  
  const getInactiveProducts = db.prepare('SELECT COUNT(*) as count FROM products WHERE is_active = 0');
  const inactiveCount = getInactiveProducts.get();
  console.log(`❌ Неактивных товаров: ${inactiveCount.count}`);
  
} catch (error) {
  console.error('❌ Ошибка:', error);
} finally {
  db.close();
}
