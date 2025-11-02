const Database = require('better-sqlite3');

// Подключаемся к базе данных
const db = new Database('shop.db');

try {
  console.log('\n🗑️  Удаление тестовых товаров...\n');
  
  // Список названий товаров для удаления
  const testProductNames = [
    'Тест TON - Консультация 15 мин',
    'Тест Stars - Мини-консультация',
    'Тест',
    'Test'
  ];
  
  // Ищем товары с этими названиями
  const findProducts = db.prepare(`
    SELECT * FROM products 
    WHERE name LIKE ? OR name LIKE ? OR name LIKE ? OR name LIKE ?
  `);
  
  const foundProducts = findProducts.all(
    '%Тест%',
    '%тест%',
    '%Test%',
    '%test%'
  );
  
  if (foundProducts.length === 0) {
    console.log('✅ Тестовых товаров не найдено');
    return;
  }
  
  console.log(`Найдено ${foundProducts.length} тестовых товаров:\n`);
  foundProducts.forEach(product => {
    console.log(`  - ID ${product.id}: "${product.name}"`);
  });
  
  console.log('\n🗑️  Начинаем удаление...\n');
  
  // Удаляем каждый товар в транзакции
  const deleteTransaction = db.transaction((products) => {
    const deleteOrders = db.prepare('DELETE FROM orders WHERE product_id = ?');
    const deleteProduct = db.prepare('DELETE FROM products WHERE id = ?');
    
    let deletedCount = 0;
    
    for (const product of products) {
      try {
        // Удаляем связанные заказы
        const ordersResult = deleteOrders.run(product.id);
        console.log(`  📦 Товар ID ${product.id}: удалено заказов: ${ordersResult.changes}`);
        
        // Удаляем товар
        const productResult = deleteProduct.run(product.id);
        if (productResult.changes > 0) {
          console.log(`  ✅ Товар ID ${product.id} "${product.name}" удален`);
          deletedCount++;
        }
      } catch (error) {
        console.error(`  ❌ Ошибка удаления товара ID ${product.id}:`, error.message);
      }
    }
    
    return deletedCount;
  });
  
  const deletedCount = deleteTransaction(foundProducts);
  
  console.log(`\n✅ Удалено товаров: ${deletedCount} из ${foundProducts.length}`);
  
  // Проверяем, что товары действительно удалены
  const verifyProducts = findProducts.all(
    '%Тест%',
    '%тест%',
    '%Test%',
    '%test%'
  );
  
  if (verifyProducts.length === 0) {
    console.log('✅ Все тестовые товары успешно удалены из БД');
  } else {
    console.log(`⚠️  Остались товары: ${verifyProducts.length}`);
    verifyProducts.forEach(product => {
      console.log(`  - ID ${product.id}: "${product.name}"`);
    });
  }
  
} catch (error) {
  console.error('❌ Критическая ошибка:', error);
} finally {
  db.close();
}
