const express = require('express');
const db = require('../../db');
const { authMiddlewareWithDB } = require('../../middleware/auth');

const router = express.Router();

// Эндпоинт для добавления отзыва
router.post('/', authMiddlewareWithDB, async (req, res) => {
    try {
        const { product_id, order_id, rating, comment } = req.body;
        const userId = req.user.id;
        
        console.log('⭐ [REVIEW] Добавление отзыва:', { userId, product_id, order_id, rating, comment });
        
        if (!product_id || !rating || rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Необходимы product_id и rating (1-5)' });
        }
        
        // Проверяем, что пользователь покупал этот товар
        if (order_id) {
            const orderResult = await db.query(
                'SELECT * FROM orders WHERE id = $1 AND user_id = $2 AND product_id = $3 AND status = $4', 
                [order_id, userId, product_id, 'paid']
            );
            
            if (orderResult.rows.length === 0) {
                return res.status(403).json({ error: 'Вы можете оставлять отзывы только на купленные товары' });
            }
        }
        
        // Проверяем, не оставлял ли пользователь уже отзыв на этот товар
        const existingReviewResult = await db.query(
            'SELECT * FROM reviews WHERE user_id = $1 AND product_id = $2', 
            [userId, product_id]
        );
        
        if (existingReviewResult.rows.length > 0) {
            return res.status(400).json({ error: 'Вы уже оставляли отзыв на этот товар' });
        }
        
        // Добавляем отзыв
        const reviewResult = await db.query(
            'INSERT INTO reviews (user_id, product_id, rating, comment) VALUES ($1, $2, $3, $4) RETURNING *',
            [userId, product_id, rating, comment || '']
        );
        
        const review = reviewResult.rows[0];
        console.log('✅ [REVIEW] Отзыв добавлен:', review.id);
        
        res.json({
            success: true,
            review: {
                id: review.id,
                rating: review.rating,
                comment: review.comment,
                created_at: review.created_at
            }
        });
        
    } catch (error) {
        console.error('❌ [REVIEW] Ошибка добавления отзыва:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Эндпоинт для получения отзывов товара
router.get('/product/:id', async (req, res) => {
    try {
        const productId = parseInt(req.params.id);
        
        if (!productId) {
            return res.status(400).json({ error: 'Неверный ID товара' });
        }
        
        // Получаем отзывы с информацией о пользователях
        const reviewsResult = await db.query(`
            SELECT r.*, u.first_name, u.last_name, u.username, u.telegram_id
            FROM reviews r
            JOIN users u ON r.user_id = u.id
            WHERE r.product_id = $1
            ORDER BY r.created_at DESC
        `, [productId]);
        
        const reviews = reviewsResult.rows.map(review => ({
            id: review.id,
            rating: review.rating,
            comment: review.comment,
            created_at: review.created_at,
            author: {
                first_name: review.first_name,
                last_name: review.last_name,
                username: review.username,
                telegram_id: review.telegram_id
            }
        }));
        
        res.json({
            success: true,
            reviews: reviews
        });
        
    } catch (error) {
        console.error('❌ [REVIEWS] Ошибка получения отзывов:', error);
        res.status(500).json({ error: 'Ошибка загрузки отзывов' });
    }
});

module.exports = router;
