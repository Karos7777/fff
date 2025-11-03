# ✅ Исправление типов данных для PostgreSQL v2.3.0

## 🐛 Проблема

После предыдущего исправления товар **создавался** (HTTP 200), но **не отображался** в списке.

### Логи показывали:
```
POST /api/admin/products → 200 OK ✅
GET /api/products → 200 OK ✅
[SERVER LOAD] Найдено товаров: 0 ❌
```

---

## 🔍 Причина

**Несоответствие типов данных** между INSERT и SELECT в PostgreSQL:

### В INSERT (создание товара):
```javascript
INSERT INTO products (..., is_active, infinite_stock)
VALUES (..., 1, 1)  // ❌ Integer вместо Boolean
```

### В SELECT (получение товаров):
```javascript
SELECT * FROM products 
WHERE is_active = true  // ✅ Boolean
```

### Схема таблицы (PostgreSQL):
```sql
CREATE TABLE products (
  is_active BOOLEAN DEFAULT true,      -- ✅ BOOLEAN
  infinite_stock BOOLEAN DEFAULT false -- ✅ BOOLEAN
)
```

**Проблема:** PostgreSQL строго типизирован. Когда мы вставляли `1` (integer), а искали `true` (boolean), товары не находились.

---

## ✅ Что исправлено

### 1. INSERT использует boolean вместо integer

**До (строки 983, 994-995):**
```javascript
const infiniteStock = req.body.infinite_stock === 'on' || req.body.infinite_stock === 'true' ? 1 : 0;

INSERT INTO products (..., is_active, infinite_stock)
VALUES (..., 1, infiniteStock)  // ❌ Integer
```

**После:**
```javascript
const infiniteStock = req.body.infinite_stock === 'on' || req.body.infinite_stock === 'true';

INSERT INTO products (..., is_active, infinite_stock)
VALUES (..., true, infiniteStock)  // ✅ Boolean
```

### 2. Добавлено `async/await` для PostgreSQL

**До (строка 959):**
```javascript
app.post('/api/admin/products', adminMiddleware, upload.single('image'), (req, res) => {
  const result = insertProduct.run(...);  // ❌ Синхронный вызов
});
```

**После:**
```javascript
app.post('/api/admin/products', adminMiddleware, upload.single('image'), async (req, res) => {
  const result = await insertProduct.run(...);  // ✅ Асинхронный вызов
});
```

### 3. Добавлена верификация созданного товара

**Строки 1010-1013:**
```javascript
// Проверяем что товар действительно в БД
const verifyProduct = db.prepare('SELECT * FROM products WHERE id = ?');
const createdProduct = await verifyProduct.get(result.lastInsertRowid);
console.log('✅ [SERVER CREATE] Проверка созданного товара:', createdProduct);
```

### 4. Исправлено также в UPDATE

**Строки 1043-1044:**
```javascript
// До:
const infiniteStock = req.body.infinite_stock === 'on' || req.body.infinite_stock === 'true' ? 1 : 0;
const isActiveValue = req.body.is_active === 'on' || req.body.is_active === 'true' ? 1 : 0;

// После:
const infiniteStock = req.body.infinite_stock === 'on' || req.body.infinite_stock === 'true';
const isActiveValue = req.body.is_active === 'on' || req.body.is_active === 'true';
```

---

## 🧪 Как проверить

### 1. Дождитесь завершения деплоя на Railway

### 2. Попробуйте создать товар

1. Откройте форму "➕ Добавить услугу"
2. Заполните:
   - **Название:** `Тест`
   - **Описание:** `Описание`
   - **Цена:** `100`
   - **Категория:** `Разработка`
   - **Остаток:** `10` или галочка "Бесконечный остаток"
3. Нажмите **"Сохранить"**

### 3. Проверьте логи на Railway

**Должно появиться:**
```
➕ [SERVER CREATE] ========== СОЗДАНИЕ ТОВАРА ==========
➕ [SERVER CREATE] Параметры товара: {
  name: 'Тест',
  price: 100,
  stock: 10,
  infiniteStock: false,  // ✅ Boolean, не 0
  category: 'development'
}
✅ [SERVER CREATE] Товар создан, ID: 1
✅ [SERVER CREATE] Проверка созданного товара: {
  id: 1,
  name: 'Тест',
  is_active: true,        // ✅ Boolean
  infinite_stock: false,  // ✅ Boolean
  ...
}
```

**Затем при загрузке товаров:**
```
📦 [SERVER LOAD] Запрос на получение списка товаров
📦 [SERVER LOAD] Найдено товаров: 1  // ✅ Теперь находит!
```

### 4. Товар должен появиться в каталоге

После создания страница автоматически обновится и товар появится в списке! ✅

---

## 📋 Изменённые файлы

1. **`server.js`** (строка 959)
   - Добавлено `async` в обработчик `POST /api/admin/products`

2. **`server.js`** (строка 983)
   - `infiniteStock`: `? 1 : 0` → boolean

3. **`server.js`** (строка 995)
   - `VALUES (..., 1)` → `VALUES (..., true)`

4. **`server.js`** (строка 998)
   - Добавлено `await` перед `insertProduct.run()`

5. **`server.js`** (строки 1010-1013)
   - Добавлена верификация созданного товара

6. **`server.js`** (строки 1043-1044)
   - Исправлены типы в UPDATE endpoint

7. **`package.json`** (строка 3)
   - Версия: `2.2.9` → `2.3.0`

---

## 🔄 Деплой

```bash
git add .
git commit -m "Fix PostgreSQL boolean types for is_active and infinite_stock v2.3.0"
git push
```

Railway автоматически передеплоит приложение.

---

## 📊 Разница между SQLite и PostgreSQL

### SQLite (было раньше):
```javascript
// SQLite принимает и 0/1, и true/false
is_active = 1  ✅ Работает
is_active = true  ✅ Работает

WHERE is_active = true  // Находит товары с is_active = 1
```

### PostgreSQL (теперь):
```javascript
// PostgreSQL строго типизирован
is_active = 1  ❌ Integer, не Boolean
is_active = true  ✅ Boolean

WHERE is_active = true  // НЕ находит товары с is_active = 1 (integer)
```

---

## 📝 Почему товары не находились

1. **Создание товара:**
   ```sql
   INSERT INTO products (..., is_active) VALUES (..., 1)
   -- В БД: is_active = 1 (integer)
   ```

2. **Поиск товаров:**
   ```sql
   SELECT * FROM products WHERE is_active = true
   -- Ищет: is_active = true (boolean)
   -- НЕ находит: is_active = 1 (integer)
   ```

3. **Результат:**
   ```
   Найдено товаров: 0
   ```

### После исправления:

1. **Создание товара:**
   ```sql
   INSERT INTO products (..., is_active) VALUES (..., true)
   -- В БД: is_active = true (boolean)
   ```

2. **Поиск товаров:**
   ```sql
   SELECT * FROM products WHERE is_active = true
   -- Ищет: is_active = true (boolean)
   -- Находит: is_active = true (boolean) ✅
   ```

3. **Результат:**
   ```
   Найдено товаров: 1 ✅
   ```

---

## ⚠️ Важно

После деплоя **НЕ нужно** очищать localStorage - это исправление только на сервере.

Если вы создавали тестовые товары с `is_active = 1`, они **не будут отображаться**. Нужно либо:

1. Удалить их из БД вручную через Railway SQL Console
2. Или обновить их:
   ```sql
   UPDATE products SET is_active = true WHERE is_active IS NULL OR is_active::text = '1';
   ```

---

**Версия:** 2.3.0  
**Дата:** 3 ноября 2025  
**Статус:** ✅ Исправлено

**Теперь товары должны создаваться и отображаться корректно!** 🎉
