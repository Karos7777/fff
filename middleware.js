const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production';

// Универсальный middleware для проверки прав администратора
const adminMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Токен не предоставлен' });
    }
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Проверяем админские права по Telegram ID из переменных окружения
    const adminIds = process.env.ADMIN_TELEGRAM_IDS ? process.env.ADMIN_TELEGRAM_IDS.split(',') : [];
    const userTelegramId = decoded.telegram_id?.toString();
    
    let isAdmin = false;
    
    // Проверка по Telegram ID (приоритет)
    if (adminIds.length > 0 && userTelegramId && adminIds.includes(userTelegramId)) {
      isAdmin = true;
    }
    // Fallback: проверка по старому формату
    else if (decoded.is_admin !== undefined) {
      isAdmin = decoded.is_admin === 1 || decoded.is_admin === true;
    } else if (decoded.role) {
      isAdmin = decoded.role === 'admin';
    }
    
    if (!isAdmin) {
      return res.status(403).json({ 
        error: 'Недостаточно прав доступа',
        telegram_id: userTelegramId,
        admin_ids: adminIds
      });
    }
    
    req.user = decoded;
    req.user.role = 'admin';
    req.user.is_admin = true;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Недействительный токен' });
  }
};

// Middleware для проверки авторизации (для всех пользователей)
const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Токен не предоставлен' });
    }
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Поддержка обоих форматов токена
    let isAdmin = false;
    let userRole = null;
    if (decoded.is_admin !== undefined) {
      isAdmin = decoded.is_admin === 1 || decoded.is_admin === true;
      userRole = isAdmin ? 'admin' : 'user';
    } else if (decoded.role) {
      userRole = decoded.role;
      isAdmin = decoded.role === 'admin';
    }
    
    req.user = decoded;
    req.user.role = userRole; // Нормализуем поле role
    req.user.is_admin = isAdmin;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Недействительный токен' });
  }
};

// Универсальная функция генерации токена с role и is_admin
const generateToken = (user) => {
  const payload = {
    id: user.id,
    telegram_id: user.telegram_id,
    username: user.username,
    role: user.is_admin ? 'admin' : 'user', // Стандартизируем поле role
    is_admin: user.is_admin,
    iat: Math.floor(Date.now() / 1000)
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
};

module.exports = { adminMiddleware, authMiddleware, generateToken };