const express = require('express');
const db = require('../../db');

const router = express.Router();

// Получение списка товаров
router.get('/', async (req, res) => {
    console.log('\n📦 [SERVER LOAD] Запрос на получение списка товаров');
    console.log('📦 [SERVER LOAD] Query params:', req.query);
    
    // Отключаем кеширование для актуальных данных
    res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    });
    try {
        // Сначала проверим все товары в базе
        const allProductsResult = await db.query('SELECT id, name, is_active, created_at FROM products ORDER BY created_at DESC');
        const allProducts = allProductsResult.rows;
        console.log(`🛍️ [PRODUCTS API] Всего товаров в базе: ${allProducts.length}`);
        allProducts.forEach(product => {
            console.log(`   - ${product.name} (ID: ${product.id}) - активен: ${product.is_active}`);
        });
        
        // Получаем все активные товары (PostgreSQL async)
        const productsResult = await db.query('SELECT * FROM products WHERE is_active = true ORDER BY created_at DESC');
        const products = productsResult.rows;
        console.log(`📦 [SERVER LOAD] Найдено активных товаров: ${products.length}`);
        
        if (products.length === 0) {
            console.log('⚠️ [SERVER LOAD] Нет активных товаров для отображения');
            return res.json(products);
        }
        
        // Для каждого товара считаем рейтинг и количество отзывов
        const productIds = products.map(p => p.id);
        const placeholders = productIds.map((_, i) => `$${i + 1}`).join(',');
        const ratingsResult = await db.query(`SELECT product_id, AVG(rating) as avg_rating, COUNT(*) as reviews_count FROM reviews WHERE product_id IN (${placeholders}) GROUP BY product_id`, productIds);
        const ratings = ratingsResult.rows;
        
        // Создаем карту рейтингов
        const ratingMap = {};
        ratings.forEach(r => { 
            ratingMap[r.product_id] = r; 
        });
        
        // Добавляем рейтинги к товарам и конвертируем типы для клиента
        const result = products.map(p => ({
            ...p,
            price: parseFloat(p.price), // Конвертируем DECIMAL в number
            price_ton: p.price_ton ? parseFloat(p.price_ton) : null,
            price_usdt: p.price_usdt ? parseFloat(p.price_usdt) : null,
            price_stars: p.price_stars ? parseInt(p.price_stars) : null,
            rating: parseFloat(ratingMap[p.id]?.avg_rating) || 0,
            reviewsCount: parseInt(ratingMap[p.id]?.reviews_count) || 0
        }));
        
        console.log('✅ [SERVER LOAD] Отправка списка товаров:', result.length, 'шт.');
        console.log('📦 [SERVER LOAD] Первые 3 ID:', result.slice(0, 3).map(p => p.id));
        res.json(result);
    } catch (error) {
        console.error('❌ [SERVER LOAD] Ошибка получения товаров:', error);
        res.status(500).json({ error: 'Ошибка получения товаров', details: error.message });
    }
});

// Получение товара по ID
router.get('/:id', async (req, res) => {
    try {
        const productResult = await db.query('SELECT * FROM products WHERE id = $1 AND is_active = true', [req.params.id]);
        const product = productResult.rows[0];
        
        if (!product) {
            return res.status(404).json({ error: 'Товар не найден' });
        }
        
        const ratingResult = await db.query('SELECT AVG(rating) as avg_rating, COUNT(*) as reviews_count FROM reviews WHERE product_id = $1', [product.id]);
        const rating = ratingResult.rows[0];
        
        res.json({
            ...product,
            price: parseFloat(product.price),
            price_ton: product.price_ton ? parseFloat(product.price_ton) : null,
            price_usdt: product.price_usdt ? parseFloat(product.price_usdt) : null,
            price_stars: product.price_stars ? parseInt(product.price_stars) : null,
            rating: parseFloat(rating?.avg_rating) || 0,
            reviewsCount: parseInt(rating?.reviews_count) || 0
        });
    } catch (error) {
        console.error('Error getting product:', error);
        res.status(500).json({ error: 'Ошибка получения товара' });
    }
});

module.exports = router;
