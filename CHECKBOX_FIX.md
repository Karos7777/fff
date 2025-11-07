# ✅ FIX: ЧЕКБОКСЫ is_active И infinite_stock — ГОТОВО!

## 🎯 Проблема

**Товар создаётся, но не появляется в каталоге**

```
[ADMIN] Товар создан: {
  id: 13,
  name: 'Сделаю телеграмм магазин',
  price_ton: '25.0000',
  infinite_stock: false,
  is_active: false   ← ВОТ ОШИБКА!
}
```

**Причина:**
- Чекбоксы в HTML отправляют `'on'` когда отмечены
- Код проверял только `'true'` и `true`
- `is_active: 'on'` → преобразовывалось в `false`
- Товар создавался неактивным и не показывался

---

## ✅ Решение

### 1. Исправлена обработка в `admin.js`

**БЫЛО:**
```js
const formData = new FormData(e.target);
// Чекбоксы не обрабатывались правильно
if (!formData.has('infinite_stock')) {
    formData.append('infinite_stock', 'false');
}
```

**СТАЛО:**
```js
const formData = new FormData(e.target);

// === ПРАВИЛЬНАЯ ОБРАБОТКА ЧЕКБОКСОВ ===
// Чекбоксы отправляют 'on' когда отмечены, undefined когда нет
const infiniteStockBool = formData.get('infinite_stock') === 'on';
const isActiveBool = formData.get('is_active') === 'on';

console.log('📦 [ADMIN FORM] Чекбоксы:', { 
    infinite_stock_raw: formData.get('infinite_stock'),  // 'on' или null
    is_active_raw: formData.get('is_active'),            // 'on' или null
    infiniteStockBool,  // true или false
    isActiveBool        // true или false
});

// Заменяем значения чекбоксов на boolean строки
formData.set('infinite_stock', infiniteStockBool ? 'true' : 'false');
formData.set('is_active', isActiveBool ? 'true' : 'false');
```

### 2. Исправлена обработка в `server.js` (POST)

**БЫЛО:**
```js
const infiniteStockBool = infinite_stock === 'true' || infinite_stock === true;
const isActiveBool = is_active === 'true' || is_active === true || is_active === '1';
// ❌ Не обрабатывал 'on'
```

**СТАЛО:**
```js
// === ПРАВИЛЬНАЯ ОБРАБОТКА ЧЕКБОКСОВ ===
// Принимаем 'true'/'false' строки или 'on' от формы
const infiniteStockBool = infinite_stock === 'true' || infinite_stock === true || infinite_stock === 'on';
const isActiveBool = is_active === 'true' || is_active === true || is_active === 'on';
const stockValue = infiniteStockBool ? 0 : (parseInt(stock) || 0);

console.log('✅ [ADMIN] Обработанные значения:', { 
  infiniteStockBool,     // true или false
  isActiveBool,          // true или false
  stockValue,            // 0 или число
  infinite_stock_raw: infinite_stock,  // 'on', 'true', 'false'
  is_active_raw: is_active             // 'on', 'true', 'false'
});
```

### 3. Исправлена обработка в `server.js` (PUT)

**Аналогично POST endpoint** - добавлена поддержка `'on'`

---

## 🎉 ИТОГ

**Исправлено:**
- ✅ `admin.js` преобразует `'on'` → `'true'/'false'`
- ✅ `server.js` принимает `'on'`, `'true'`, `true`
- ✅ Детальное логирование raw и обработанных значений
- ✅ Работает для POST и PUT endpoints

**Результат:**
- ✅ Чекбокс "Активен" → `is_active: true`
- ✅ Чекбокс "Бесконечный сток" → `infinite_stock: true`
- ✅ Товар появляется в каталоге
- ✅ Товар виден пользователям

**ГОТОВО К ИСПОЛЬЗОВАНИЮ!** 🚀💎

---

## 📝 Как работает

### Поток данных:

**1. HTML форма:**
```html
<input type="checkbox" name="is_active" checked>
<!-- Когда отмечен: отправляет 'on' -->
<!-- Когда не отмечен: не отправляет ничего -->
```

**2. JavaScript (admin.js):**
```js
formData.get('is_active')  // 'on' или null
↓
const isActiveBool = formData.get('is_active') === 'on'  // true или false
↓
formData.set('is_active', isActiveBool ? 'true' : 'false')  // 'true' или 'false'
```

**3. Server (server.js):**
```js
req.body.is_active  // 'true' или 'false' (строка)
↓
const isActiveBool = is_active === 'true' || is_active === 'on'  // true или false
↓
INSERT ... VALUES (..., $9, ...)  // boolean в PostgreSQL
```

**4. PostgreSQL:**
```sql
is_active: true  -- boolean тип
```

**5. Результат:**
```js
{
  id: 13,
  name: 'Сделаю телеграмм магазин',
  is_active: true,  ✅ АКТИВЕН!
  infinite_stock: false
}
```

---

## 🔧 Тестирование

### 1. Создай товар с отмеченными чекбоксами

**Форма:**
- ✅ Активен (checked)
- ✅ Бесконечный сток (checked)

**Ожидаемые логи (клиент):**
```
📦 [ADMIN FORM] Чекбоксы: {
  infinite_stock_raw: 'on',
  is_active_raw: 'on',
  infiniteStockBool: true,
  isActiveBool: true
}
📤 [ADMIN FORM] Отправка: {
  infinite_stock: 'true',
  is_active: 'true'
}
```

**Ожидаемые логи (сервер):**
```
➕ [ADMIN] Создание нового товара
📦 [ADMIN] Данные товара (raw): {
  infinite_stock: 'true',
  is_active: 'true'
}
✅ [ADMIN] Обработанные значения: {
  infiniteStockBool: true,
  isActiveBool: true,
  stockValue: 0,
  infinite_stock_raw: 'true',
  is_active_raw: 'true'
}
✅ [ADMIN] Товар создан: {
  id: 14,
  name: 'Консультация',
  is_active: true,  ✅
  infinite_stock: true  ✅
}
```

### 2. Создай товар без чекбоксов

**Форма:**
- ❌ Активен (unchecked)
- ❌ Бесконечный сток (unchecked)

**Ожидаемые логи (клиент):**
```
📦 [ADMIN FORM] Чекбоксы: {
  infinite_stock_raw: null,
  is_active_raw: null,
  infiniteStockBool: false,
  isActiveBool: false
}
📤 [ADMIN FORM] Отправка: {
  infinite_stock: 'false',
  is_active: 'false'
}
```

**Ожидаемые логи (сервер):**
```
✅ [ADMIN] Обработанные значения: {
  infiniteStockBool: false,
  isActiveBool: false,
  stockValue: 10
}
✅ [ADMIN] Товар создан: {
  id: 15,
  is_active: false,  ✅
  infinite_stock: false  ✅
}
```

---

## 🚀 Деплой

```bash
git add .
git commit -m "Fix: checkbox handling for is_active and infinite_stock"
git push
```

**После деплоя:**
1. Открой админ-панель
2. Нажми "Добавить товар"
3. Заполни форму
4. ✅ Отметь "Активен"
5. Нажми "Сохранить"
6. Проверь каталог - товар должен появиться!

**ПРОВЕРЬ В PRODUCTION — ДОЛЖНО РАБОТАТЬ!** ✅
