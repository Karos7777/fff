# ✅ FIX: db.run ВОЗВРАЩАЕТ ID С RETURNING — ГОТОВО!

## 🎯 Проблема

**`db.run` не возвращал ID созданного товара**

```js
const result = await db.run(`INSERT INTO products (...) VALUES (...)`, [...]);
console.log(result.id); // ❌ undefined
```

**Причина:** 
- `db.run` возвращал `{ rowCount, rows }` вместо первой строки
- PostgreSQL требует `RETURNING id` для получения ID
- Endpoints использовали SQLite синтаксис (`dbLegacy`)

---

## ✅ Решение

### 1. Исправлен `db.run` в `db/index.js`

**БЫЛО:**
```js
async run(text, params) {
  const result = await this.query(text, params);
  return { 
    rowCount: result.rowCount,
    rows: result.rows 
  };
}
```

**СТАЛО:**
```js
async run(text, params) {
  const client = await pool.connect();
  try {
    const res = await client.query(text, params);
    // Если есть RETURNING - возвращаем первую строку
    if (res.rows && res.rows.length > 0) {
      return res.rows[0];
    }
    // Иначе возвращаем количество затронутых строк
    return { rowCount: res.rowCount };
  } finally {
    client.release();
  }
}
```

**Теперь:**
- ✅ Возвращает первую строку если есть `RETURNING`
- ✅ Возвращает `{ rowCount }` для UPDATE/DELETE без RETURNING
- ✅ Совместимо с обоими случаями

### 2. Переписан POST endpoint на PostgreSQL

**БЫЛО (SQLite):**
```js
const insertProduct = dbLegacy.prepare(`
  INSERT INTO products (name, ...) VALUES (?, ?, ...)
`);
const result = insertProduct.run(name, ...);
console.log(result.lastInsertRowid); // SQLite
```

**СТАЛО (PostgreSQL):**
```js
const product = await db.run(
  `INSERT INTO products 
   (name, description, price, price_ton, price_usdt, price_stars, stock, infinite_stock, is_active, image_url, file_path)
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
   RETURNING id, name, price_ton, infinite_stock, is_active`,
  [name, description, price, price_ton, price_usdt, price_stars, stockValue, infiniteStockBool, isActiveBool, imageUrl, file_path]
);

console.log('✅ Товар создан:', product);
// { id: 15, name: 'Консультация', price_ton: 0.5, ... }

res.json({ 
  success: true, 
  productId: product.id,  // ✅ ЧИСЛО!
  product: product
});
```

### 3. Переписан PUT endpoint на PostgreSQL

**БЫЛО (SQLite):**
```js
const updateProduct = dbLegacy.prepare(`UPDATE products SET ... WHERE id = ?`);
updateProduct.run(name, ..., productId);
```

**СТАЛО (PostgreSQL):**
```js
const currentProduct = await db.get('SELECT * FROM products WHERE id = $1', [productId]);

const product = await db.run(
  `UPDATE products 
   SET name = $1, description = $2, price = $3, price_ton = $4, price_usdt = $5, price_stars = $6, 
       stock = $7, infinite_stock = $8, is_active = $9, image_url = $10, file_path = $11
   WHERE id = $12
   RETURNING id, name, price_ton, infinite_stock, is_active`,
  [name, description, price, price_ton, price_usdt, price_stars, stockValue, infiniteStockBool, isActiveBool, imageUrl, file_path, productId]
);

res.json({ 
  success: true, 
  product: product  // ✅ Обновлённый товар
});
```

---

## 🎉 ИТОГ

**Исправлено:**
- ✅ `db.run` возвращает первую строку с RETURNING
- ✅ `db.run` возвращает `{ rowCount }` без RETURNING
- ✅ POST endpoint использует PostgreSQL синтаксис
- ✅ PUT endpoint использует PostgreSQL синтаксис
- ✅ Возвращается полный объект товара
- ✅ `product.id` теперь число, а не undefined

**Результат:**
- ✅ Создание товара возвращает ID
- ✅ Обновление товара возвращает данные
- ✅ Совместимость с PostgreSQL
- ✅ Нет зависимости от SQLite (`dbLegacy`)
- ✅ Современный синтаксис с `$1, $2, ...`

**ГОТОВО К ДЕПЛОЮ!** 🚀💎

---

## 📝 Примеры использования

### Создание товара:

**Запрос:**
```bash
curl -X POST http://localhost:8080/api/admin/products \
  -H "Authorization: Bearer <token>" \
  -F "name=Консультация" \
  -F "description=Часовая консультация" \
  -F "price=1000" \
  -F "price_ton=0.5" \
  -F "price_usdt=10" \
  -F "price_stars=100" \
  -F "stock=10" \
  -F "is_active=true"
```

**Ответ:**
```json
{
  "success": true,
  "message": "Товар успешно создан",
  "productId": 15,
  "product": {
    "id": 15,
    "name": "Консультация",
    "price_ton": 0.5,
    "infinite_stock": false,
    "is_active": true
  }
}
```

**Логи:**
```
➕ [ADMIN] Создание нового товара
📦 [ADMIN] Данные товара: { name: 'Консультация', price: 1000, ... }
✅ [ADMIN] Обработанные значения: { infiniteStockBool: false, isActiveBool: true, stockValue: 10 }
✅ [ADMIN] Товар создан: { id: 15, name: 'Консультация', ... }
```

### Обновление товара:

**Запрос:**
```bash
curl -X PUT http://localhost:8080/api/admin/products/15 \
  -H "Authorization: Bearer <token>" \
  -F "name=Консультация PRO" \
  -F "price_ton=1.0"
```

**Ответ:**
```json
{
  "success": true,
  "message": "Товар успешно обновлён",
  "product": {
    "id": 15,
    "name": "Консультация PRO",
    "price_ton": 1.0,
    "infinite_stock": false,
    "is_active": true
  }
}
```

**Логи:**
```
✏️ [ADMIN] Обновление товара #15
📦 [ADMIN] Данные для обновления: { name: 'Консультация PRO', price_ton: 1.0, ... }
✅ [ADMIN] Товар обновлён: { id: 15, name: 'Консультация PRO', ... }
```

---

## 🔧 Технические детали

**PostgreSQL RETURNING:**
```sql
INSERT INTO products (...) VALUES (...) RETURNING id, name, price_ton;
-- Возвращает: { id: 15, name: 'Консультация', price_ton: 0.5 }

UPDATE products SET ... WHERE id = 15 RETURNING id, name;
-- Возвращает: { id: 15, name: 'Консультация PRO' }
```

**db.run поведение:**
```js
// С RETURNING
const product = await db.run(`INSERT ... RETURNING id`, [...]);
console.log(product); // { id: 15, name: '...' }

// Без RETURNING
const result = await db.run(`UPDATE ... WHERE id = 15`, [...]);
console.log(result); // { rowCount: 1 }
```

**Параметры PostgreSQL:**
```js
// ❌ SQLite: ?, ?, ?
// ✅ PostgreSQL: $1, $2, $3
```

**ПРОВЕРЬ В PRODUCTION — ДОЛЖНО РАБОТАТЬ!**
