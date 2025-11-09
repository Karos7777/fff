const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production';

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
    console.log('🔍 [AUTH] Проверка токена, JWT_SECRET length:', JWT_SECRET.length);
    console.log('🔍 [AUTH] Token preview:', token.substring(0, 50) + '...');
    
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('✅ [AUTH] Токен декодирован:', decoded);
    
    // Получаем полную информацию о пользователе из базы данных
    const userResult = await db.query(
      'SELECT * FROM users WHERE telegram_id = $1',
      [decoded.telegram_id]
    );
    
    if (userResult.rows.length === 0) {
      console.log('❌ [AUTH] Пользователь не найден в БД:', decoded.telegram_id);
      return res.status(401).json({ error: 'Пользователь не найден' });
    }
    
    req.user = userResult.rows[0];
    console.log('✅ [AUTH] Пользователь найден:', req.user.username);
    next();
  } catch (error) {
    console.error('❌ [AUTH] Ошибка аутентификации:', error);
    console.error('❌ [AUTH] Token that failed:', token.substring(0, 100) + '...');
    return res.status(401).json({ error: 'Недействительный токен' });
  }
};

// Универсальная функция генерации токена с role и is_admin
const generateToken = (user) => {
  console.log('[GENERATE TOKEN] Input user object:', user);
  console.log('[GENERATE TOKEN] JWT_SECRET length:', JWT_SECRET.length);
  
  // КРИТИЧНО: Проверяем что user.id существует
  if (!user.id && !user.telegram_id) {
    console.error('[GENERATE TOKEN] CRITICAL: user object missing both id and telegram_id!');
    throw new Error('Cannot generate token: user.id or user.telegram_id is required');
  }
  
  const payload = {
    id: user.id,
    telegram_id: user.telegram_id,
    username: user.username,
    first_name: user.first_name,
    role: user.is_admin ? 'admin' : 'user', // Стандартизируем поле role
    is_admin: user.is_admin,
    iat: Math.floor(Date.now() / 1000)
  };
  
  console.log('[GENERATE TOKEN] Payload:', payload);
  
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
  console.log('[GENERATE TOKEN] Token created, length:', token.length);
  
  return token;
};

// Middleware для проверки админских прав
const adminMiddleware = async (req, res, next) => {
  try {
    // Получаем токен
    const authHeader = req.headers.authorization;
    const token = authHeader ? authHeader.split(' ')[1] : null;
    
    if (!token) {
      console.log('❌ [ADMIN] Токен не предоставлен');
      return res.status(401).json({ error: 'Токен не предоставлен' });
    }
    
    // Проверяем токен
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('✅ [ADMIN] Токен декодирован:', decoded);
    
    // Получаем полную информацию о пользователе из базы данных
    const db = require('../db');
    const userResult = await db.query(
      'SELECT * FROM users WHERE telegram_id = $1',
      [decoded.telegram_id]
    );
    
    if (userResult.rows.length === 0) {
      console.log('❌ [ADMIN] Пользователь не найден в БД:', decoded.telegram_id);
      return res.status(401).json({ error: 'Пользователь не найден' });
    }
    
    req.user = userResult.rows[0];
    
    // Проверяем админские права
    if (!req.user.is_admin) {
      console.log('❌ [ADMIN] Пользователь не является администратором:', req.user.telegram_id);
      return res.status(403).json({ error: 'Доступ запрещен. Требуются права администратора.' });
    }
    
    console.log('✅ [ADMIN] Права администратора подтверждены для:', req.user.username || req.user.telegram_id);
    next();
  } catch (error) {
    console.error('❌ [ADMIN] Ошибка в adminMiddleware:', error);
    return res.status(401).json({ error: 'Ошибка авторизации' });
  }
};

module.exports = {
  authMiddleware,
  authMiddlewareWithDB,
  adminMiddleware,
  generateToken,
  JWT_SECRET
};
