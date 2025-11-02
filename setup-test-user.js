const Database = require('better-sqlite3');
const { generateToken } = require('./middleware');

// Подключаемся к базе данных
const db = new Database('shop.db');

try {
  // Создаем тестового пользователя
  const insertUser = db.prepare(`
    INSERT OR REPLACE INTO users (id, telegram_id, username, is_admin) 
    VALUES (1, '123456789', 'testuser', 0)
  `);
  
  insertUser.run();
  
  // Получаем пользователя
  const getUser = db.prepare('SELECT * FROM users WHERE id = 1');
  const user = getUser.get();
  
  // Генерируем токен
  const token = generateToken(user);
  
  console.log('✅ Тестовый пользователь создан:');
  console.log('ID:', user.id);
  console.log('Telegram ID:', user.telegram_id);
  console.log('Username:', user.username);
  console.log('\n🔑 JWT Token для тестирования:');
  console.log(token);
  console.log('\n📋 Сохраните этот токен для тестирования API!');
  
} catch (error) {
  console.error('❌ Ошибка создания тестового пользователя:', error);
} finally {
  db.close();
}
