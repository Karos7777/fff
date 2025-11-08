const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware, authMiddlewareWithDB } = require('../middleware/auth');

// Получение всех товаров
router.get('/', async (req, res) => {
  try {
    console.log('📦 [PRODUCTS] Загрузка товаров...');
    
    const result = await db.query(`
      SELECT 
        p.*,
        COALESCE(AVG(r.rating), 0) as average_rating,
        COUNT(r.id) as review_count
      FROM products p
      LEFT JOIN reviews r ON p.id = r.product_id
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `);
    
    const products = result.rows.map(product => ({
      ...product,
      average_rating: parseFloat(product.average_rating) || 0,
      review_count: parseInt(product.review_count) || 0
    }));
    
    console.log(`✅ [PRODUCTS] Загружено товаров: ${products.length}`);
    res.json(products);
  } catch (error) {
    console.error('❌ [PRODUCTS] Ошибка загрузки товаров:', error);
    res.status(500).json({ error: 'Ошибка загрузки товаров' });
  }
});

// Получение товара по ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('📦 [PRODUCT] Загрузка товара ID:', id);
    
    const result = await db.query(`
      SELECT 
        p.*,
        COALESCE(AVG(r.rating), 0) as average_rating,
        COUNT(r.id) as review_count
      FROM products p
      LEFT JOIN reviews r ON p.id = r.product_id
      WHERE p.id = $1
      GROUP BY p.id
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Товар не найден' });
    }
    
    const product = {
      ...result.rows[0],
      average_rating: parseFloat(result.rows[0].average_rating) || 0,
      review_count: parseInt(result.rows[0].review_count) || 0
    };
    
    console.log('✅ [PRODUCT] Товар загружен:', product.name);
    res.json(product);
  } catch (error) {
    console.error('❌ [PRODUCT] Ошибка загрузки товара:', error);
    res.status(500).json({ error: 'Ошибка загрузки товара' });
  }
});

// Создание нового товара (только для админов)
router.post('/', authMiddlewareWithDB, async (req, res) => {
  try {
    // Проверяем права администратора
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }
    
    const { 
      name, 
      description, 
      price, 
      price_ton, 
      price_usdt, 
      price_stars, 
      category, 
      image_url, 
      file_path, 
      stock_quantity 
    } = req.body;
    
    console.log('📦 [CREATE-PRODUCT] Создание товара:', name);
    
    const result = await db.query(`
      INSERT INTO products (
        name, description, price, price_ton, price_usdt, price_stars, 
        category, image_url, file_path, stock_quantity, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      RETURNING *
    `, [
      name, description, price, price_ton, price_usdt, price_stars,
      category, image_url, file_path, stock_quantity
    ]);
    
    console.log('✅ [CREATE-PRODUCT] Товар создан:', result.rows[0].id);
    res.json({ success: true, product: result.rows[0] });
  } catch (error) {
    console.error('❌ [CREATE-PRODUCT] Ошибка создания товара:', error);
    res.status(500).json({ error: 'Ошибка создания товара' });
  }
});

// Обновление товара (только для админов)
router.put('/:id', authMiddlewareWithDB, async (req, res) => {
  try {
    // Проверяем права администратора
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }
    
    const { id } = req.params;
    const updates = req.body;
    
    console.log('📦 [UPDATE-PRODUCT] Обновление товара ID:', id);
    
    // Строим динамический запрос обновления
    const setClause = Object.keys(updates)
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');
    
    const values = [id, ...Object.values(updates)];
    
    const result = await db.query(`
      UPDATE products 
      SET ${setClause}, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Товар не найден' });
    }
    
    console.log('✅ [UPDATE-PRODUCT] Товар обновлен:', result.rows[0].name);
    res.json({ success: true, product: result.rows[0] });
  } catch (error) {
    console.error('❌ [UPDATE-PRODUCT] Ошибка обновления товара:', error);
    res.status(500).json({ error: 'Ошибка обновления товара' });
  }
});

// Удаление товара (только для админов)
router.delete('/:id', authMiddlewareWithDB, async (req, res) => {
  try {
    // Проверяем права администратора
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }
    
    const { id } = req.params;
    console.log('📦 [DELETE-PRODUCT] Удаление товара ID:', id);
    
    const result = await db.query('DELETE FROM products WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Товар не найден' });
    }
    
    console.log('✅ [DELETE-PRODUCT] Товар удален:', result.rows[0].name);
    res.json({ success: true, message: 'Товар удален' });
  } catch (error) {
    console.error('❌ [DELETE-PRODUCT] Ошибка удаления товара:', error);
    res.status(500).json({ error: 'Ошибка удаления товара' });
  }
});

module.exports = router;
