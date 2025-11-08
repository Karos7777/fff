const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware для аутентификации
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader ? authHeader.split(' ')[1] : null;
  
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
  const authHeader = req.headers.authorization;
  const token = authHeader ? authHeader.split(' ')[1] : null;
  
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

// Универсальная функция генерации токена с role и is_admin
const generateToken = (user) => {
  console.log('[GENERATE TOKEN] Input user object:', user);
  
  // КРИТИЧНО: Проверяем что user.id существует
  if (!user.id && !user.telegram_id) {
    console.error('[GENERATE TOKEN] CRITICAL: user object missing both id and telegram_id!');
    throw new Error('Cannot generate token: user.id or user.telegram_id is required');
  }
  
  const payload = {
    id: user.id,
    telegram_id: user.telegram_id,
    username: user.username,
    role: user.is_admin ? 'admin' : 'user', // Стандартизируем поле role
    is_admin: user.is_admin,
    iat: Math.floor(Date.now() / 1000)
  };
  
  console.log('[GENERATE TOKEN] Payload:', payload);
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
};

module.exports = {
  authMiddleware,
  authMiddlewareWithDB,
  generateToken,
  JWT_SECRET
};
