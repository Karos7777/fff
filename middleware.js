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
// Принимает db как параметр для доступа к базе данных
const authMiddleware = (db) => {
  return async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Токен не предоставлен' });
      }
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, JWT_SECRET);
      
      console.log('[AUTH] Decoded token:', { id: decoded.id, telegram_id: decoded.telegram_id });
      
      // Если в токене есть id - используем его напрямую
      if (decoded.id) {
        // Получаем актуальные данные из БД для проверки
        const getUserQuery = db.prepare('SELECT * FROM users WHERE id = $1');
        const dbUser = await getUserQuery.get(decoded.id);
        
        if (!dbUser) {
          console.error('[AUTH] User not found by id:', decoded.id);
          return res.status(401).json({ error: 'Пользователь не найден в базе данных' });
        }
        
        // Используем данные из БД + данные из токена
        req.user = {
          id: dbUser.id,
          telegram_id: dbUser.telegram_id,
          username: dbUser.username,
          role: dbUser.is_admin ? 'admin' : 'user',
          is_admin: dbUser.is_admin
        };
        
        console.log('[AUTH] User authenticated by id:', req.user.id);
      } 
      // Fallback: если в токене нет id, но есть telegram_id
      else if (decoded.telegram_id) {
        const getUserQuery = db.prepare('SELECT * FROM users WHERE telegram_id = $1');
        const dbUser = await getUserQuery.get(decoded.telegram_id.toString());
        
        if (!dbUser) {
          console.error('[AUTH] User not found by telegram_id:', decoded.telegram_id);
          return res.status(401).json({ error: 'Пользователь не найден в базе данных' });
        }
        
        req.user = {
          id: dbUser.id,
          telegram_id: dbUser.telegram_id,
          username: dbUser.username,
          role: dbUser.is_admin ? 'admin' : 'user',
          is_admin: dbUser.is_admin
        };
        
        console.log('[AUTH] User authenticated by telegram_id:', req.user.id);
      }
      // Если нет ни id, ни telegram_id - ошибка
      else {
        console.error('[AUTH] Token missing both id and telegram_id');
        return res.status(400).json({ error: 'Invalid token: missing user id' });
      }
      
      // КРИТИЧНО: Проверяем что req.user.id установлен
      if (!req.user.id) {
        console.error('[AUTH] CRITICAL: req.user.id is undefined after authentication');
        return res.status(500).json({ error: 'Authentication failed: user id not set' });
      }
      
      next();
    } catch (error) {
      console.error('❌ [AUTH] Ошибка аутентификации:', error.message);
      return res.status(401).json({ error: 'Недействительный токен' });
    }
  };
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