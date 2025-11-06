# Инструкция по отладке токена JWT

## Проблема
```
[AUTH] Decoded token: { id: undefined, telegram_id: undefined }
[AUTH] Token missing both id and telegram_id
```

Токен генерируется, но не содержит `id` и `telegram_id`.

---

## Что исправлено

### 1. **middleware.js** — Валидация в `generateToken`

```js
const generateToken = (user) => {
  console.log('[GENERATE TOKEN] Input user object:', user);
  
  // КРИТИЧНО: Проверяем что user.id существует
  if (!user.id && !user.telegram_id) {
    console.error('[GENERATE TOKEN] CRITICAL: user object missing both id and telegram_id!');
    throw new Error('Cannot generate token: user.id or user.telegram_id is required');
  }
  
  const payload = {
    id: user.id,
    telegram_id: user.telegram_id,
    username: user.username,
    role: user.is_admin ? 'admin' : 'user',
    is_admin: user.is_admin,
    iat: Math.floor(Date.now() / 1000)
  };
  
  console.log('[GENERATE TOKEN] Payload:', payload);
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
};
```

### 2. **server.js** — Исправлены оба auth endpoint

#### `/api/auth/telegram` (для Telegram Mini App)
- ✅ Добавлена проверка `user.id` перед `generateToken`
- ✅ Логирование объекта `user`

#### `/api/auth` (старый endpoint)
- ✅ Исправлены SQL запросы для PostgreSQL (`$1`, `$2`)
- ✅ Заменён `result.lastInsertRowid` на `result.id`
- ✅ Добавлен `async/await`
- ✅ Логирование перед `generateToken`

---

## Как проверить логи после деплоя

### 1. Запустить деплой
```bash
git add .
git commit -m "Fix JWT token generation with proper user.id"
git push
```

### 2. Открыть логи Railway
```bash
railway logs --follow
```

### 3. Открыть Mini App в Telegram

Должны появиться логи:

```
👤 [SERVER AUTH] Запрос авторизации через Telegram
👤 [SERVER AUTH] Данные пользователя: { id: 853232715, first_name: '...', ... }
🔐 [AUTH] Проверка админ прав: { userId: '853232715', adminIds: [...], isAdmin: true }
✅ [AUTH] Создан новый пользователь: { id: 123, telegram_id: '853232715', ... }
🔑 [AUTH] User object before generateToken: { id: 123, telegram_id: '853232715', ... }
[GENERATE TOKEN] Input user object: { id: 123, telegram_id: '853232715', ... }
[GENERATE TOKEN] Payload: { id: 123, telegram_id: '853232715', role: 'admin', is_admin: true, ... }
```

### 4. Попробовать создать заказ

```
[AUTH] Decoded token: { id: 123, telegram_id: '853232715' }
[AUTH] User authenticated by id: 123
📦 [ORDER] user_id from token: 123
✅ [SERVER] Заказ создан, result: { id: 456 }
```

---

## Если токен всё ещё пустой

### Проверка 1: Какой endpoint используется?

Посмотри в логах:
- `👤 [SERVER AUTH] Запрос авторизации через Telegram` → используется `/api/auth/telegram` ✅
- `🔐 [AUTH] Проверка админ прав` без `[SERVER AUTH]` → используется `/api/auth` ⚠️

### Проверка 2: Откуда берётся `id`?

В логах должно быть:
```
👤 [SERVER AUTH] Данные пользователя: { id: 853232715, ... }
```

Если `id: undefined` — проблема на фронте:

#### Фронт (Mini App JS)
```js
// ПРАВИЛЬНО
const user = window.Telegram.WebApp.initDataUnsafe.user;
console.log('User from Telegram:', user); // Должен быть { id: 853232715, ... }

fetch('/api/auth/telegram', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id: user.id,              // ← ОБЯЗАТЕЛЬНО
    first_name: user.first_name,
    last_name: user.last_name,
    username: user.username
  })
});
```

### Проверка 3: База данных вернула `id`?

В логах должно быть:
```
✅ [AUTH] Создан новый пользователь: { id: 123, telegram_id: '853232715', ... }
```

Если `id: undefined` — проблема в SQL:
- PostgreSQL требует `RETURNING id` в INSERT
- Используй `await insertUser.get(...)` вместо `.run(...)`

---

## Быстрый тест (без фронта)

### Curl запрос для проверки
```bash
curl -X POST https://your-railway-url.up.railway.app/api/auth/telegram \
  -H "Content-Type: application/json" \
  -d '{"id": 853232715, "first_name": "Test", "username": "testuser"}'
```

Ответ должен содержать:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 123,
    "telegram_id": "853232715",
    ...
  }
}
```

### Проверить токен
```bash
# Скопируй токен из ответа
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

curl -X POST https://your-railway-url.up.railway.app/api/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"product_id": 1}'
```

Должно вернуть:
```json
{
  "id": 456,
  "message": "Заказ создан успешно"
}
```

---

## Итог

| Что было | Что стало |
|----------|-----------|
| `generateToken(user)` без проверки | Проверка + логирование |
| SQLite синтаксис в `/api/auth` | PostgreSQL синтаксис |
| `result.lastInsertRowid` | `result.id` (PostgreSQL) |
| Нет логов перед `generateToken` | Полное логирование |

**Теперь в логах будет видно, где именно теряется `user.id`!** 🔍
