# 🐘 Миграция на PostgreSQL - Полная инструкция

## ✅ Что уже сделано

1. ✅ Создан PostgreSQL адаптер (`db-postgres.js`)
2. ✅ Обновлен `server.js` для работы с PostgreSQL
3. ✅ Добавлен пакет `pg` в `package.json`
4. ✅ Создана функция `initDB()` для автоматического создания таблиц

## 📋 Что нужно сделать

### 1. Установить пакет `pg`

Откройте **CMD** (не PowerShell):

```bash
cd d:\projects\tg_magazin_bot
npm install pg@8.11.3
```

Это обновит `package-lock.json`.

### 2. Добавить DATABASE_URL в .env

Создайте или обновите файл `.env`:

```env
# PostgreSQL Connection
DATABASE_URL=postgresql://user:password@localhost:5432/shop_db

# Или для Railway (автоматически предоставляется):
# DATABASE_URL=${{Postgres.DATABASE_URL}}

# Остальные переменные
JWT_SECRET=your-secret-key
BOT_TOKEN=your-telegram-bot-token
ADMIN_TELEGRAM_IDS=853232715
```

### 3. Создать PostgreSQL базу данных

#### Локально (для разработки):

**Установите PostgreSQL:**
- Windows: https://www.postgresql.org/download/windows/
- Mac: `brew install postgresql`
- Linux: `sudo apt install postgresql`

**Создайте базу данных:**

```bash
# Войдите в PostgreSQL
psql -U postgres

# Создайте базу данных
CREATE DATABASE shop_db;

# Создайте пользователя (опционально)
CREATE USER shop_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE shop_db TO shop_user;

# Выйдите
\q
```

**Обновите DATABASE_URL в .env:**

```env
DATABASE_URL=postgresql://shop_user:your_password@localhost:5432/shop_db
```

#### На Railway (продакшн):

1. Откройте проект на Railway
2. Нажмите **"+ New"** → **"Database"** → **"Add PostgreSQL"**
3. Railway автоматически создаст базу и добавит `DATABASE_URL`
4. Скопируйте `DATABASE_URL` из Variables (если нужно локально)

### 4. Запустить сервер

```bash
npm start
```

Вы должны увидеть:

```
🔌 Подключение к PostgreSQL...
🔄 Инициализация базы данных PostgreSQL...
✅ База данных PostgreSQL инициализирована успешно
✅ Сервис платежей инициализирован
🚀 Сервер запущен на порту 10000
```

### 5. Проверить таблицы

Подключитесь к базе данных:

```bash
psql $DATABASE_URL
```

Проверьте таблицы:

```sql
\dt  -- Список таблиц

SELECT * FROM users;
SELECT * FROM products;
SELECT * FROM orders;
SELECT * FROM reviews;
SELECT * FROM invoices;
```

## 🔄 Миграция данных из SQLite

Если у вас есть данные в `shop.db`, их нужно перенести:

### Вариант 1: Экспорт/Импорт вручную

```bash
# Экспорт из SQLite
sqlite3 shop.db .dump > data.sql

# Отредактируйте data.sql:
# - Замените AUTOINCREMENT на SERIAL
# - Замените INTEGER PRIMARY KEY на SERIAL PRIMARY KEY
# - Замените DATETIME на TIMESTAMP

# Импорт в PostgreSQL
psql $DATABASE_URL < data.sql
```

### Вариант 2: Использовать скрипт миграции

Создайте файл `migrate.js`:

```javascript
const Database = require('better-sqlite3');
const { Pool } = require('pg');

const sqliteDb = new Database('shop.db');
const pgPool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
    // Пользователи
    const users = sqliteDb.prepare('SELECT * FROM users').all();
    for (const user of users) {
        await pgPool.query(
            'INSERT INTO users (telegram_id, username, is_admin) VALUES ($1, $2, $3)',
            [user.telegram_id, user.username, user.is_admin]
        );
    }
    
    // Товары
    const products = sqliteDb.prepare('SELECT * FROM products').all();
    for (const product of products) {
        await pgPool.query(
            'INSERT INTO products (name, description, price, category) VALUES ($1, $2, $3, $4)',
            [product.name, product.description, product.price, product.category]
        );
    }
    
    console.log('✅ Миграция завершена');
}

migrate().catch(console.error);
```

Запустите:

```bash
node migrate.js
```

## 🚀 Деплой на Railway

### 1. Закоммитьте изменения

```bash
git add .
git commit -m "Migrate to PostgreSQL"
git push
```

### 2. Добавьте PostgreSQL на Railway

1. Откройте ваш проект
2. **"+ New"** → **"Database"** → **"Add PostgreSQL"**
3. Railway автоматически добавит `DATABASE_URL`

### 3. Проверьте деплой

Railway автоматически:
- Установит зависимости (`npm ci`)
- Запустит сервер (`npm start`)
- Создаст таблицы (через `initDB()`)

Проверьте логи:

```
✅ База данных PostgreSQL инициализирована успешно
```

## 🐛 Решение проблем

### Ошибка: "Missing: pg@8.11.3 from lock file"

**Решение:**

```bash
# Удалите package-lock.json
rm package-lock.json

# Установите заново
npm install

# Закоммитьте
git add package-lock.json
git commit -m "Update package-lock.json"
git push
```

### Ошибка: "Connection refused"

**Проверьте:**

1. PostgreSQL запущен: `pg_ctl status`
2. DATABASE_URL правильный
3. Порт 5432 открыт

### Ошибка: "relation does not exist"

**Решение:**

Таблицы не созданы. Перезапустите сервер - `initDB()` создаст их автоматически.

## 📊 Сравнение SQLite vs PostgreSQL

| Функция | SQLite | PostgreSQL |
|---------|--------|------------|
| Тип | Файловая БД | Серверная БД |
| Многопользовательность | ❌ | ✅ |
| Масштабируемость | Ограничена | Высокая |
| Транзакции | ✅ | ✅ |
| Репликация | ❌ | ✅ |
| Подходит для | Разработка | Продакшн |

## ✅ Итог

После миграции:

- ✅ Данные хранятся в PostgreSQL
- ✅ Поддержка множества пользователей
- ✅ Готово к масштабированию
- ✅ Автоматическое создание таблиц
- ✅ Совместимость с Railway

## 📞 Поддержка

Если возникли проблемы:
1. Проверьте логи Railway
2. Проверьте DATABASE_URL
3. Убедитесь, что PostgreSQL запущен

---

**Версия:** 2.2.0  
**Дата:** 03.11.2025
