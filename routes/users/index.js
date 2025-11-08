const express = require('express');
const { authMiddlewareWithDB } = require('../../middleware/auth');

const router = express.Router();

// Получение профиля пользователя
router.get('/profile', authMiddlewareWithDB, async (req, res) => {
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

// Проверка роли пользователя
router.get('/role', authMiddlewareWithDB, (req, res) => {
    try {
        // Проверяем админские права по Telegram ID
        const adminIds = process.env.ADMIN_TELEGRAM_IDS ? process.env.ADMIN_TELEGRAM_IDS.split(',') : [];
        const userTelegramId = req.user.telegram_id?.toString();
        
        let isAdmin = false;
        
        // Проверка по Telegram ID (приоритет)
        if (adminIds.length > 0 && userTelegramId && adminIds.includes(userTelegramId)) {
            isAdmin = true;
        }
        // Fallback: проверка по старому формату
        else if (req.user.is_admin !== undefined) {
            isAdmin = req.user.is_admin === 1 || req.user.is_admin === true;
        } else if (req.user.role) {
            isAdmin = req.user.role === 'admin';
        }
        
        res.json({ 
            role: isAdmin ? 'admin' : 'user',
            telegram_id: userTelegramId,
            is_admin: isAdmin
        });
    } catch (error) {
        console.error('Ошибка проверки роли:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

module.exports = router;
