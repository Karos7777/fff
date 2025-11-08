const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddlewareWithDB } = require('../middleware/auth');

// Добавление отзыва
router.post('/', authMiddlewareWithDB, async (req, res) => {
  try {
    const { product_id, order_id, rating, comment } = req.body;
    const userId = req.user.id;
    
    console.log('⭐ [ADD-REVIEW] Добавление отзыва:', { userId, product_id, rating });
    
    if (!product_id || !rating) {
      return res.status(400).json({ error: 'Необходимы product_id и rating' });
    }
    
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Рейтинг должен быть от 1 до 5' });
    }
    
    // Проверяем, что пользователь купил этот товар
    if (order_id) {
      const orderResult = await db.query(
        'SELECT * FROM orders WHERE id = $1 AND user_id = $2 AND product_id = $3 AND status = $4',
        [order_id, userId, product_id, 'paid']
      );
      
      if (orderResult.rows.length === 0) {
        return res.status(403).json({ error: 'Вы можете оставить отзыв только на купленный товар' });
      }
    }
    
    // Проверяем, не оставлял ли пользователь уже отзыв на этот товар
    const existingReview = await db.query(
      'SELECT id FROM reviews WHERE user_id = $1 AND product_id = $2',
      [userId, product_id]
    );
    
    if (existingReview.rows.length > 0) {
      return res.status(400).json({ error: 'Вы уже оставили отзыв на этот товар' });
    }
    
    // Добавляем отзыв
    const result = await db.query(`
      INSERT INTO reviews (user_id, product_id, order_id, rating, comment, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *
    `, [userId, product_id, order_id, rating, comment]);
    
    console.log('✅ [ADD-REVIEW] Отзыв добавлен:', result.rows[0].id);
    res.json({ success: true, review: result.rows[0] });
  } catch (error) {
    console.error('❌ [ADD-REVIEW] Ошибка добавления отзыва:', error);
    res.status(500).json({ error: 'Ошибка добавления отзыва' });
  }
});

// Получение отзывов товара
router.get('/product/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    console.log('📖 [GET-REVIEWS] Получение отзывов товара:', productId);
    
    const result = await db.query(`
      SELECT 
        r.*,
        u.first_name,
        u.last_name,
        u.username,
        u.telegram_id
      FROM reviews r
      JOIN users u ON r.user_id = u.id
      WHERE r.product_id = $1
      ORDER BY r.created_at DESC
    `, [productId]);
    
    console.log('✅ [GET-REVIEWS] Найдено отзывов:', result.rows.length);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ [GET-REVIEWS] Ошибка получения отзывов:', error);
    res.status(500).json({ error: 'Ошибка получения отзывов' });
  }
});

// Получение статистики отзывов товара
router.get('/stats/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    console.log('📊 [REVIEW-STATS] Получение статистики отзывов:', productId);
    
    const result = await db.query(`
      SELECT 
        COUNT(*) as total_reviews,
        AVG(rating) as average_rating,
        COUNT(CASE WHEN rating = 5 THEN 1 END) as five_stars,
        COUNT(CASE WHEN rating = 4 THEN 1 END) as four_stars,
        COUNT(CASE WHEN rating = 3 THEN 1 END) as three_stars,
        COUNT(CASE WHEN rating = 2 THEN 1 END) as two_stars,
        COUNT(CASE WHEN rating = 1 THEN 1 END) as one_star
      FROM reviews 
      WHERE product_id = $1
    `, [productId]);
    
    const stats = {
      ...result.rows[0],
      total_reviews: parseInt(result.rows[0].total_reviews),
      average_rating: parseFloat(result.rows[0].average_rating) || 0,
      five_stars: parseInt(result.rows[0].five_stars),
      four_stars: parseInt(result.rows[0].four_stars),
      three_stars: parseInt(result.rows[0].three_stars),
      two_stars: parseInt(result.rows[0].two_stars),
      one_star: parseInt(result.rows[0].one_star)
    };
    
    console.log('✅ [REVIEW-STATS] Статистика получена');
    res.json(stats);
  } catch (error) {
    console.error('❌ [REVIEW-STATS] Ошибка получения статистики:', error);
    res.status(500).json({ error: 'Ошибка получения статистики отзывов' });
  }
});

module.exports = router;
