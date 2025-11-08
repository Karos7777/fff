const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware для аутентификации
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Токен не предоставлен' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Недействительный токен' });
  }
};

// Middleware для аутентификации с доступом к базе данных
const authMiddlewareWithDB = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Токен не предоставлен' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Получаем полную информацию о пользователе из базы данных
    const userResult = await db.query(
      'SELECT * FROM users WHERE telegram_id = $1',
      [decoded.telegram_id]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Пользователь не найден' });
    }
    
    req.user = userResult.rows[0];
    next();
  } catch (error) {
    console.error('❌ [AUTH] Ошибка аутентификации:', error);
    return res.status(401).json({ error: 'Недействительный токен' });
  }
};

module.exports = {
  authMiddleware,
  authMiddlewareWithDB,
  JWT_SECRET
};
