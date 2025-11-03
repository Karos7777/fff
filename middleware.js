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
      
      // Если в токене есть id - используем его напрямую
      if (decoded.id) {
        // Получаем актуальные данные из БД для проверки
        const getUserQuery = db.prepare('SELECT * FROM users WHERE id = ?');
        const dbUser = await getUserQuery.get(decoded.id);
        
        if (!dbUser) {
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
      } 
      // Fallback: если в токене нет id, но есть telegram_id
      else if (decoded.telegram_id) {
        const getUserQuery = db.prepare('SELECT * FROM users WHERE telegram_id = ?');
        const dbUser = await getUserQuery.get(decoded.telegram_id.toString());
        
        if (!dbUser) {
          return res.status(401).json({ error: 'Пользователь не найден в базе данных' });
        }
        
        req.user = {
          id: dbUser.id,
          telegram_id: dbUser.telegram_id,
          username: dbUser.username,
          role: dbUser.is_admin ? 'admin' : 'user',
          is_admin: dbUser.is_admin
        };
      }
      // Если нет ни id, ни telegram_id - используем старый формат (только для обратной совместимости)
      else {
        req.user = decoded;
        req.user.role = decoded.role || (decoded.is_admin ? 'admin' : 'user');
        req.user.is_admin = decoded.is_admin;
        console.warn('⚠️ [AUTH] Токен не содержит id или telegram_id. Используется устаревший формат.');
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