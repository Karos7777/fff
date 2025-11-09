const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../../db');
const { adminMiddleware } = require('../../middleware/auth');

const router = express.Router();

// Настройка multer для загрузки изображений
const uploadsDir = 'public/uploads';
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${file.originalname}`;
        cb(null, uniqueName);
    }
});

const upload = multer({ storage });

// Получение всех товаров для админа
router.get('/products', adminMiddleware, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                p.*,
                COUNT(o.id) as total_orders,
                SUM(CASE WHEN o.status = 'paid' THEN 1 ELSE 0 END) as paid_orders,
                SUM(CASE WHEN o.status = 'paid' THEN o.total_amount ELSE 0 END) as total_revenue
            FROM products p
            LEFT JOIN orders o ON p.id = o.product_id
            GROUP BY p.id
            ORDER BY p.created_at DESC
        `);
        
        const products = result.rows;
        
        res.json({ success: true, products });
    } catch (error) {
        console.error('Ошибка получения товаров:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Создание нового товара (только для админов)
router.post('/products', adminMiddleware, upload.single('image'), async (req, res) => {
    console.log('\n➕ [ADMIN] Создание нового товара');
    
    const {
        name,
        description = '',
        price = 0,
        price_ton = 0,
        price_usdt = 0,
        price_stars = 0,
        file_path,
        category = 'general',
        infinite_stock,  // 'on' или 'off'
        is_active,       // 'on' или 'off'
        stock
    } = req.body;

    console.log('📦 [ADMIN] Данные (raw):', { name, price_ton, infinite_stock, is_active, stock });

    // Обработка изображения
    let imageUrl = null;
    if (req.file) {
        imageUrl = `/uploads/${req.file.filename}`;
        console.log('🖼️ [ADMIN] Загружено изображение:', imageUrl);
    }

    // === КРИТИЧНО: ПРЕОБРАЗУЕМ ЧЕКБОКСЫ ===
    // 'on' = checked, 'off' = unchecked
    const infiniteStockBool = infinite_stock === 'on' || infinite_stock === true;
    const isActiveBool = is_active === 'on' || is_active === true;
    const stockValue = infiniteStockBool ? null : (parseInt(stock) || 0);

    console.log('✅ [ADMIN] Обработано:', { 
        infiniteStockBool, 
        isActiveBool, 
        stockValue,
        raw_infinite: infinite_stock,
        raw_active: is_active
    });

    // Если is_active не задан или пустой, устанавливаем true по умолчанию
    const finalIsActive = is_active === 'off' ? false : true;
    console.log(`🔄 [ADMIN] Финальный is_active: ${finalIsActive} (исходное значение: "${is_active}")`);

    try {
        const product = await db.run(
            `INSERT INTO products 
             (name, description, price, price_ton, price_usdt, price_stars, stock, infinite_stock, is_active, image_url, file_path, category)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             RETURNING id, name, price_ton, infinite_stock, is_active`,
            [
                name,
                description,
                parseFloat(price) || 0,
                parseFloat(price_ton) || 0,
                parseFloat(price_usdt) || 0,
                parseInt(price_stars) || 0,
                stockValue,
                infiniteStockBool,
                finalIsActive,
                imageUrl,
                file_path || null,
                category
            ]
        );

        console.log('✅ [ADMIN] Товар создан успешно:', {
            id: product.id,
            name: product.name,
            is_active: product.is_active,
            price_ton: product.price_ton
        });
        
        // Проверяем, что товар действительно активен
        if (product.is_active) {
            console.log('🟢 [ADMIN] Товар создан как АКТИВНЫЙ - будет отображаться в каталоге');
        } else {
            console.log('🔴 [ADMIN] ВНИМАНИЕ: Товар создан как НЕАКТИВНЫЙ - НЕ будет отображаться в каталоге');
        }
        
        res.json({ success: true, product });
    } catch (err) {
        console.error('❌ [ADMIN] Ошибка:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Обновление товара (только для админов)
router.put('/products/:id', adminMiddleware, upload.single('image'), async (req, res) => {
    console.log('\n✏️ [ADMIN] Обновление товара #' + req.params.id);
    
    const productId = parseInt(req.params.id);
    const {
        name,
        description = '',
        price = 0,
        price_ton = 0,
        price_usdt = 0,
        price_stars = 0,
        file_path,
        category = 'general',
        infinite_stock,  // 'on' или 'off'
        is_active,       // 'on' или 'off'
        stock
    } = req.body;

    console.log('📦 [ADMIN] Данные (raw):', { name, price_ton, infinite_stock, is_active, stock });

    try {
        // Получаем текущий товар
        const currentProduct = await db.get('SELECT * FROM products WHERE id = $1', [productId]);
        
        if (!currentProduct) {
            return res.status(404).json({ error: 'Товар не найден' });
        }
        
        // Обработка изображения
        let imageUrl = currentProduct.image_url;
        if (req.file) {
            imageUrl = `/uploads/${req.file.filename}`;
            console.log('🖼️ [ADMIN] Обновлено изображение:', imageUrl);
        }
        
        // === КРИТИЧНО: ПРЕОБРАЗУЕМ ЧЕКБОКСЫ ===
        const infiniteStockBool = infinite_stock === 'on' || infinite_stock === true;
        const isActiveBool = is_active === 'on' || is_active === true;
        const stockValue = infiniteStockBool ? null : (parseInt(stock) || 0);
        
        console.log('✅ [ADMIN] Обработано:', { 
            infiniteStockBool, 
            isActiveBool, 
            stockValue,
            raw_infinite: infinite_stock,
            raw_active: is_active
        });
        
        const product = await db.run(
            `UPDATE products 
             SET name = $1, description = $2, price = $3, price_ton = $4, price_usdt = $5, price_stars = $6, 
                 stock = $7, infinite_stock = $8, is_active = $9, image_url = $10, file_path = $11, category = $12
             WHERE id = $13
             RETURNING id, name, price_ton, infinite_stock, is_active`,
            [
                name,
                description,
                parseFloat(price) || 0,
                parseFloat(price_ton) || 0,
                parseFloat(price_usdt) || 0,
                parseInt(price_stars) || 0,
                stockValue,
                infiniteStockBool,
                isActiveBool,
                imageUrl,
                file_path || currentProduct.file_path,
                category,
                productId
            ]
        );
        
        console.log('✅ [ADMIN] Товар обновлён:', product);
        res.json({ success: true, product });
    } catch (err) {
        console.error('❌ [ADMIN] Ошибка:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Удаление товара (только для админов)
router.delete('/products/:id', adminMiddleware, async (req, res) => {
    console.log('\n🗑️ [SERVER DELETE] ========== НАЧАЛО УДАЛЕНИЯ ТОВАРА ==========');
    try {
        const productId = parseInt(req.params.id);
        console.log('🗑️ [SERVER DELETE] Product ID:', productId);
        console.log('🗑️ [SERVER DELETE] User:', req.user);
        
        // Проверяем, существует ли товар
        const productResult = await db.query('SELECT * FROM products WHERE id = $1', [productId]);
        const product = productResult.rows[0];
        console.log('🗑️ [SERVER DELETE] Найден товар:', product);
        
        if (!product) {
            console.error('❌ [SERVER DELETE] Товар не найден в БД');
            return res.status(404).json({ error: 'Товар не найден' });
        }
        
        // Проверяем, есть ли активные заказы у товара
        const activeOrdersResult = await db.query(`
            SELECT COUNT(*) as count FROM orders 
            WHERE product_id = $1 AND status IN ('pending', 'pending_crypto', 'paid')
        `, [productId]);
        const activeOrders = activeOrdersResult.rows[0];
        console.log('🗑️ [SERVER DELETE] Активных заказов:', activeOrders.count);
        
        console.log('🗑️ [SERVER DELETE] Начало удаления...');
        
        // Удаляем связанные данные в правильном порядке
        try {
            // Удаляем отзывы если таблица существует
            await db.run('DELETE FROM reviews WHERE product_id = $1', [productId]);
            console.log('🗑️ [SERVER DELETE] Удалены отзывы');
        } catch (e) {
            console.log('⚠️ [SERVER DELETE] Таблица reviews не существует или ошибка:', e.message);
        }
        
        // Удаляем заказы
        await db.run('DELETE FROM orders WHERE product_id = $1', [productId]);
        console.log('🗑️ [SERVER DELETE] Удалены заказы');
        
        // Удаляем товар
        await db.run('DELETE FROM products WHERE id = $1', [productId]);
        console.log('🗑️ [SERVER DELETE] Удален товар');
        
        console.log('✅ [SERVER DELETE] Удаление успешно завершено');
        
        // Проверяем, что товар действительно удален
        const verifyResult = await db.query('SELECT * FROM products WHERE id = $1', [productId]);
        const stillExists = verifyResult.rows[0];
        
        if (stillExists) {
            console.error('❌ [SERVER DELETE] ОШИБКА: Товар все еще существует в БД!');
            return res.status(500).json({ error: 'Ошибка удаления товара' });
        }
        
        console.log('✅ [SERVER DELETE] Товар успешно удален из БД');
        console.log('🗑️ [SERVER DELETE] ========== КОНЕЦ УДАЛЕНИЯ ТОВАРА ==========\n');
        
        res.json({ 
            success: true, 
            message: 'Товар успешно удален',
            deleted_product: product
        });
    } catch (error) {
        console.error('❌ [SERVER DELETE] КРИТИЧЕСКАЯ ОШИБКА:', error);
        console.error('❌ [SERVER DELETE] Stack trace:', error.stack);
        console.log('🗑️ [SERVER DELETE] ========== КОНЕЦ УДАЛЕНИЯ ТОВАРА (ОШИБКА) ==========\n');
        res.status(500).json({ error: 'Внутренняя ошибка сервера', details: error.message });
    }
});

// Получение статистики для дашборда
router.get('/stats', adminMiddleware, async (req, res) => {
    try {
        console.log('📊 [ADMIN STATS] Загрузка статистики...');
        
        // Получаем количество товаров
        const productsResult = await db.query('SELECT COUNT(*) as count FROM products WHERE is_active = true');
        const totalProducts = parseInt(productsResult.rows[0].count) || 0;
        
        // Получаем количество заказов
        const ordersResult = await db.query('SELECT COUNT(*) as count FROM orders');
        const totalOrders = parseInt(ordersResult.rows[0].count) || 0;
        
        // Получаем количество пользователей
        const usersResult = await db.query('SELECT COUNT(*) as count FROM users');
        const totalUsers = parseInt(usersResult.rows[0].count) || 0;
        
        // Получаем общий доход (только оплаченные заказы)
        const revenueResult = await db.query(`
            SELECT 
                SUM(CASE WHEN payment_method = 'ton' THEN total_amount ELSE 0 END) as ton_revenue,
                SUM(CASE WHEN payment_method = 'usdt' THEN total_amount ELSE 0 END) as usdt_revenue,
                SUM(CASE WHEN payment_method = 'stars' THEN total_amount ELSE 0 END) as stars_revenue
            FROM orders 
            WHERE status IN ('completed', 'paid')
        `);
        
        const tonRevenue = parseFloat(revenueResult.rows[0].ton_revenue) || 0;
        const usdtRevenue = parseFloat(revenueResult.rows[0].usdt_revenue) || 0;
        const starsRevenue = parseFloat(revenueResult.rows[0].stars_revenue) || 0;
        const totalRevenue = tonRevenue + usdtRevenue + starsRevenue;
        
        console.log('✅ [ADMIN STATS] Статистика загружена:', {
            totalProducts,
            totalOrders,
            totalUsers,
            totalRevenue
        });
        
        res.json({
            success: true,
            totalProducts,
            totalOrders,
            totalUsers,
            totalRevenue: totalRevenue.toFixed(2),
            tonRevenue: tonRevenue.toFixed(2),
            usdtRevenue: usdtRevenue.toFixed(2),
            starsRevenue: starsRevenue.toFixed(0)
        });
    } catch (error) {
        console.error('❌ [ADMIN STATS] Ошибка загрузки статистики:', error);
        res.status(500).json({ error: 'Ошибка загрузки статистики', details: error.message });
    }
});

module.exports = router;
