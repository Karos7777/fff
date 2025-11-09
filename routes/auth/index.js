const express = require('express');
const { generateToken } = require('../../middleware/auth');
const db = require('../../db');
const PostgresAdapter = require('../../db-postgres');

const router = express.Router();
const dbLegacy = new PostgresAdapter(process.env.DATABASE_URL);

// Список ID администраторов из Telegram
const ADMIN_TELEGRAM_IDS = [
    '853232715', // Замените на ваш реальный ID
    // Можете добавить еще админов
];

// Функция для парсинга initData из строки в объект
function parseInitData(initDataString) {
    if (typeof initDataString !== 'string') {
        return initDataString; // Уже объект
    }
    
    const params = new URLSearchParams(initDataString);
    const result = {};
    
    for (const [key, value] of params.entries()) {
        if (key === 'user') {
            try {
                result.user = JSON.parse(decodeURIComponent(value));
            } catch (e) {
                result.user = JSON.parse(value);
            }
        } else {
            result[key] = value;
        }
    }
    
    return result;
}

// Роут для авторизации через Telegram
router.post('/telegram', async (req, res) => {
    console.log('\n👤 [SERVER AUTH] Запрос авторизации через Telegram');
    try {
        const { initData: initDataRaw } = req.body;
        console.log('👤 [SERVER AUTH] Получены initData (raw):', initDataRaw);
        
        // Парсим initData из строки в объект
        const initData = parseInitData(initDataRaw);
        console.log('👤 [SERVER AUTH] Распарсенные initData:', initData);
        
        if (!initData || !initData.user) {
            console.error('❌ [SERVER AUTH] Данные пользователя не предоставлены');
            return res.status(400).json({ error: 'Данные пользователя не предоставлены' });
        }
        
        const { id, first_name, last_name, username } = initData.user;
        console.log('👤 [SERVER AUTH] Данные пользователя:', { id, first_name, last_name, username });
        
        if (!id) {
            console.error('❌ [SERVER AUTH] ID пользователя не предоставлен');
            return res.status(400).json({ error: 'ID пользователя не предоставлен' });
        }
        
        // Проверяем, является ли пользователь админом
        const adminIds = process.env.ADMIN_TELEGRAM_IDS ? 
            process.env.ADMIN_TELEGRAM_IDS.split(',').map(id => id.trim()) : 
            ADMIN_TELEGRAM_IDS;
        const isAdmin = adminIds.includes(id.toString());
        
        console.log('🔐 [AUTH] Проверка админ прав:', { 
            userId: id.toString(), 
            adminIds, 
            isAdmin 
        });
        
        // Проверяем, есть ли пользователь в базе (async)
        let getUser = dbLegacy.prepare('SELECT * FROM users WHERE telegram_id = $1');
        let user = await getUser.get(id.toString());
        
        // Если пользователя нет, создаем его
        if (!user) {
            const insertUser = dbLegacy.prepare(`
                INSERT INTO users (telegram_id, username, is_admin, first_name, last_name) 
                VALUES ($1, $2, $3, $4, $5) RETURNING id
            `);
            const result = await insertUser.get(
                id.toString(), 
                username || '', 
                isAdmin,
                first_name || '',
                last_name || ''
            );
            
            user = {
                id: result.id,  // ← PostgreSQL возвращает id через RETURNING
                telegram_id: id.toString(),
                username: username || '',
                first_name: first_name || '',
                last_name: last_name || '',
                is_admin: isAdmin
            };
            
            console.log('✅ [AUTH] Создан новый пользователь:', user);
        } else {
            // Обновляем данные пользователя из Telegram
            let needsUpdate = false;
            const updates = {};
            
            if (user.username !== (username || '')) {
                updates.username = username || '';
                needsUpdate = true;
            }
            
            if (user.first_name !== (first_name || '')) {
                updates.first_name = first_name || '';
                needsUpdate = true;
            }
            
            if (user.last_name !== (last_name || '')) {
                updates.last_name = last_name || '';
                needsUpdate = true;
            }
            
            if (user.is_admin !== isAdmin) {
                updates.is_admin = isAdmin;
                needsUpdate = true;
            }
            
            if (needsUpdate) {
                const updateFields = Object.keys(updates).map((key, index) => `${key} = $${index + 1}`).join(', ');
                const updateValues = Object.values(updates);
                updateValues.push(user.id);
                
                const updateQuery = `UPDATE users SET ${updateFields} WHERE id = $${updateValues.length}`;
                const updateUser = dbLegacy.prepare(updateQuery);
                await updateUser.run(...updateValues);
                
                // Обновляем объект user
                Object.assign(user, updates);
                
                console.log('✅ [AUTH] Обновлены данные пользователя:', updates);
            }
        }
        
        // КРИТИЧНО: Проверяем user перед генерацией токена
        console.log('🔑 [AUTH] User object before generateToken:', user);
        if (!user.id) {
            console.error('❌ [AUTH] CRITICAL: user.id is undefined!');
            return res.status(500).json({ error: 'Failed to create user in database' });
        }
        
        // Создаем JWT токен
        const token = generateToken(user);
        
        res.json({
            success: true,
            token: token,
            user: {
                id: user.id,
                telegram_id: user.telegram_id,
                first_name: user.first_name || first_name,
                last_name: user.last_name || last_name,
                username: user.username,
                is_admin: user.is_admin
            }
        });
    } catch (error) {
        console.error('Error in Telegram auth:', error);
        res.status(500).json({ error: 'Ошибка авторизации' });
    }
});

// Регистрация/авторизация пользователя (старый метод)
router.post('/', async (req, res) => {
    try {
        const { telegram_id, username, first_name, last_name, ref } = req.body;
        let referrer_id = null;
        if (ref) {
            referrer_id = parseInt(ref, 10);
        }
        
        // Проверяем, является ли пользователь админом
        const adminIds = process.env.ADMIN_TELEGRAM_IDS ? 
            process.env.ADMIN_TELEGRAM_IDS.split(',').map(id => id.trim()) : 
            ADMIN_TELEGRAM_IDS;
        const isAdmin = adminIds.includes(telegram_id.toString());
        
        console.log('🔐 [AUTH] Проверка админ прав:', { 
            userId: telegram_id.toString(), 
            adminIds, 
            isAdmin 
        });
        
        // Ищем существующего пользователя
        const getUser = dbLegacy.prepare('SELECT * FROM users WHERE telegram_id = $1');
        const user = await getUser.get(telegram_id);
        
        if (user) {
            // Пользователь существует - обновляем данные если нужно
            if (first_name || last_name) {
                const updateUser = dbLegacy.prepare('UPDATE users SET first_name = $1, last_name = $2 WHERE id = $3');
                await updateUser.run(first_name || user.first_name, last_name || user.last_name, user.id);
                user.first_name = first_name || user.first_name;
                user.last_name = last_name || user.last_name;
            }
            
            // Обновляем is_admin если изменился
            if (user.is_admin !== isAdmin) {
                const updateAdminStatus = dbLegacy.prepare('UPDATE users SET is_admin = $1 WHERE id = $2');
                await updateAdminStatus.run(isAdmin, user.id);
                user.is_admin = isAdmin;
                console.log('✅ [AUTH] Обновлены права админа:', isAdmin);
            }
            
            console.log('🔑 [AUTH /api/auth] User object before generateToken:', user);
            const token = generateToken(user);
            res.json({ 
                token, 
                user: { 
                    id: user.id, 
                    telegram_id: user.telegram_id, 
                    username: user.username,
                    first_name: user.first_name,
                    last_name: user.last_name,
                    is_admin: user.is_admin,
                    isAdmin: user.is_admin,  // Добавляем camelCase для совместимости
                    role: user.is_admin ? 'admin' : 'user',
                    referrer_id: user.referrer_id 
                } 
            });
        } else {
            // Создаем нового пользователя
            const insertUser = dbLegacy.prepare('INSERT INTO users (telegram_id, username, first_name, last_name, referrer_id, is_admin) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id');
            const result = await insertUser.get(telegram_id, username, first_name, last_name, referrer_id, isAdmin);
            
            const newUser = {
                id: result.id,  // PostgreSQL возвращает id через RETURNING
                telegram_id,
                username,
                first_name,
                last_name,
                is_admin: isAdmin
            };
            
            console.log('✅ [AUTH] Создан новый пользователь с is_admin:', isAdmin);
            console.log('🔑 [AUTH /api/auth] New user object before generateToken:', newUser);
            
            const token = generateToken(newUser);
            res.json({ 
                token, 
                user: { 
                    id: result.id, 
                    telegram_id, 
                    username,
                    first_name,
                    last_name,
                    is_admin: isAdmin,
                    isAdmin: isAdmin,  // Добавляем camelCase для совместимости
                    role: isAdmin ? 'admin' : 'user',
                    referrer_id 
                } 
            });
        }
    } catch (error) {
        console.error('DB error:', error);
        res.status(500).json({ error: 'Ошибка базы данных', details: error.message });
    }
});

// Получение профиля пользователя (требует middleware)
router.get('/profile', (req, res, next) => {
    // Middleware будет добавлен при подключении роута
    next();
}, async (req, res) => {
    try {
        console.log('👤 [PROFILE] Получение профиля пользователя:', req.user.telegram_id);
        
        res.json({
            success: true,
            user: {
                id: req.user.id,
                telegram_id: req.user.telegram_id,
                first_name: req.user.first_name,
                last_name: req.user.last_name,
                username: req.user.username,
                is_admin: req.user.is_admin,
                created_at: req.user.created_at
            }
        });
    } catch (error) {
        console.error('❌ [PROFILE] Ошибка получения профиля:', error);
        res.status(500).json({ error: 'Ошибка получения профиля' });
    }
});

// Эндпоинт для проверки токена
router.get('/verify', (req, res, next) => {
    // Middleware будет добавлен при подключении роута
    next();
}, async (req, res) => {
    try {
        console.log('🔍 [VERIFY] Проверка токена для пользователя:', req.user.telegram_id);
        
        res.json({
            success: true,
            user: {
                id: req.user.id,
                telegram_id: req.user.telegram_id,
                first_name: req.user.first_name,
                last_name: req.user.last_name,
                username: req.user.username,
                is_admin: req.user.is_admin,
                created_at: req.user.created_at
            }
        });
    } catch (error) {
        console.error('❌ [VERIFY] Ошибка проверки токена:', error);
        res.status(500).json({ error: 'Ошибка проверки токена' });
    }
});

module.exports = router;
