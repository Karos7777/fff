const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || '8dabb91a02c70f2a9016b7cebc4f151b4cad0ae7085b11d80793c0707ebdbd4f4e55114c52ce428a6800f3698c54f9d63ae62dd71d5e21423ad37fdcb9aa6913'; // Замените на свой уникальный ключ!

// Универсальный middleware для проверки прав администратора
const adminMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Токен не предоставлен' });
    }
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('=== ADMIN MIDDLEWARE DEBUG ===');
    console.log('URL:', req.originalUrl);
    console.log('Decoded token:', decoded);
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
    console.log('User role:', userRole);
    console.log('Is admin:', isAdmin);
    if (!isAdmin) {
      console.log('❌ Недостаточно прав');
      return res.status(403).json({ error: 'Недостаточно прав доступа' });
    }
    console.log('✅ Админ авторизован успешно');
    req.user = decoded;
    req.user.role = userRole; // Нормализуем поле role
    next();
  } catch (error) {
    console.log('❌ Ошибка проверки токена:', error.message);
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

module.exports = { adminMiddleware, generateToken }; 