# 🔧 Установка PostgreSQL пакета

## Проблема
Railway требует обновленный `package-lock.json` с пакетом `pg`.

## Решение

### Шаг 1: Установите пакет локально

Откройте **CMD** (не PowerShell) и выполните:

```bash
cd d:\projects\tg_magazin_bot
npm install pg@8.11.3
```

Или через Git Bash:
```bash
npm install pg@8.11.3
```

### Шаг 2: Проверьте package-lock.json

Убедитесь, что в `package-lock.json` появился пакет `pg` и все его зависимости.

### Шаг 3: Закоммитьте изменения

```bash
git add package.json package-lock.json
git commit -m "Add PostgreSQL support"
git push
```

### Шаг 4: Добавьте DATABASE_URL в Railway

В настройках Railway добавьте переменную окружения:

```
DATABASE_URL=postgresql://user:password@host:5432/database
```

Railway автоматически предоставляет PostgreSQL базу данных. Найдите её в разделе **Variables**.

## Альтернатива: Удалите package-lock.json

Если не получается установить, можно удалить `package-lock.json` и Railway создаст новый:

```bash
rm package-lock.json
git add package-lock.json
git commit -m "Remove package-lock.json"
git push
```

Railway автоматически выполнит `npm install` и создаст новый lock файл.
