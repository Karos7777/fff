#!/usr/bin/env node

/**
 * Скрипт проверки пользователей и их прав админа в базе данных
 */

require('dotenv').config();
const PostgresAdapter = require('./db-postgres');

console.log('🔍 ========== ПРОВЕРКА ПОЛЬЗОВАТЕЛЕЙ В БД ==========\n');

async function checkUsers() {
    try {
        const db = new PostgresAdapter(process.env.DATABASE_URL);
        console.log('✅ Подключено к базе данных\n');

        // Получаем всех пользователей
        const getUsersQuery = db.prepare(`
            SELECT 
                id,
                telegram_id,
                username,
                first_name,
                last_name,
                is_admin,
                created_at
            FROM users
            ORDER BY created_at DESC
        `);

        const users = await getUsersQuery.all();

        if (users.length === 0) {
            console.log('⚠️  В базе данных нет пользователей\n');
            return;
        }

        console.log(`📊 Всего пользователей: ${users.length}\n`);
        console.log('┌─────┬──────────────┬─────────────────┬─────────┬────────────────────┐');
        console.log('│ ID  │ Telegram ID  │ Username        │ Админ   │ Дата регистрации   │');
        console.log('├─────┼──────────────┼─────────────────┼─────────┼────────────────────┤');

        users.forEach(user => {
            const id = String(user.id).padEnd(3);
            const tgId = String(user.telegram_id || '').padEnd(12);
            const username = String(user.username || user.first_name || 'Без имени').substring(0, 15).padEnd(15);
            const isAdmin = user.is_admin ? '✅ ДА  ' : '❌ НЕТ ';
            const date = new Date(user.created_at).toLocaleDateString('ru-RU');
            
            console.log(`│ ${id} │ ${tgId} │ ${username} │ ${isAdmin} │ ${date.padEnd(18)} │`);
        });

        console.log('└─────┴──────────────┴─────────────────┴─────────┴────────────────────┘\n');

        // Проверка из .env
        const ADMIN_IDS_ENV = process.env.ADMIN_TELEGRAM_IDS;
        const adminIds = ADMIN_IDS_ENV ? 
            ADMIN_IDS_ENV.split(',').map(id => id.trim()) : 
            ['853232715'];

        console.log('📋 Админы по конфигурации (.env):');
        console.log('----------------------------------');
        adminIds.forEach((id, index) => {
            const userInDb = users.find(u => u.telegram_id === id);
            if (userInDb) {
                console.log(`${index + 1}. ${id} - ${userInDb.username || userInDb.first_name} (${userInDb.is_admin ? '✅ is_admin=true' : '⚠️ is_admin=false'})`);
            } else {
                console.log(`${index + 1}. ${id} - ⚠️ НЕ НАЙДЕН В БД`);
            }
        });

        // Несоответствия
        console.log('\n⚠️  Проблемы:');
        console.log('-------------');
        
        let hasIssues = false;
        
        // Пользователи которые админы в .env но не в БД
        adminIds.forEach(adminId => {
            const userInDb = users.find(u => u.telegram_id === adminId);
            if (userInDb && !userInDb.is_admin) {
                console.log(`❌ ID ${adminId} (${userInDb.username}) в списке админов, но is_admin=false в БД`);
                hasIssues = true;
            }
        });

        // Пользователи которые админы в БД но не в .env
        users.forEach(user => {
            if (user.is_admin && !adminIds.includes(user.telegram_id)) {
                console.log(`⚠️ ID ${user.telegram_id} (${user.username}) имеет is_admin=true, но не в списке ADMIN_TELEGRAM_IDS`);
                hasIssues = true;
            }
        });

        if (!hasIssues) {
            console.log('✅ Проблем не найдено');
        }

        console.log('\n💡 Рекомендации:');
        console.log('----------------');
        if (hasIssues) {
            console.log('1. Проверьте ADMIN_TELEGRAM_IDS в .env файле');
            console.log('2. Перезапустите сервер');
            console.log('3. Пользователь должен выйти и авторизоваться заново');
            console.log('4. Права админа обновятся автоматически при входе');
        } else {
            console.log('Конфигурация корректна!');
        }

        await db.close();
        console.log('\n====================================================\n');

    } catch (error) {
        console.error('❌ Ошибка:', error.message);
        console.error('\nВозможные причины:');
        console.log('1. База данных не запущена');
        console.log('2. Неверный DATABASE_URL в .env');
        console.log('3. Таблица users не создана');
    }
}

// Если передан Telegram ID - проверяем конкретного пользователя
if (process.argv[2]) {
    const telegramIdToCheck = process.argv[2];
    console.log(`\n🔍 Проверка пользователя с Telegram ID: ${telegramIdToCheck}\n`);
    
    (async () => {
        try {
            const db = new PostgresAdapter(process.env.DATABASE_URL);
            
            const getUserQuery = db.prepare('SELECT * FROM users WHERE telegram_id = $1');
            const user = await getUserQuery.get(telegramIdToCheck);
            
            if (user) {
                console.log('✅ Пользователь найден:');
                console.log('  ID:', user.id);
                console.log('  Telegram ID:', user.telegram_id);
                console.log('  Username:', user.username || 'не указан');
                console.log('  Имя:', user.first_name || 'не указано');
                console.log('  Админ:', user.is_admin ? '✅ ДА' : '❌ НЕТ');
                console.log('  Дата регистрации:', new Date(user.created_at).toLocaleString('ru-RU'));
                
                const ADMIN_IDS_ENV = process.env.ADMIN_TELEGRAM_IDS;
                const adminIds = ADMIN_IDS_ENV ? 
                    ADMIN_IDS_ENV.split(',').map(id => id.trim()) : 
                    ['853232715'];
                
                const shouldBeAdmin = adminIds.includes(telegramIdToCheck);
                
                console.log('\n📋 Статус:');
                console.log('  В списке ADMIN_TELEGRAM_IDS:', shouldBeAdmin ? '✅ ДА' : '❌ НЕТ');
                console.log('  Права в БД (is_admin):', user.is_admin ? '✅ ДА' : '❌ НЕТ');
                
                if (shouldBeAdmin && !user.is_admin) {
                    console.log('\n⚠️  НЕСООТВЕТСТВИЕ:');
                    console.log('   ID в списке админов, но is_admin=false в БД');
                    console.log('   Решение: пользователь должен выйти и зайти снова');
                } else if (!shouldBeAdmin && user.is_admin) {
                    console.log('\n⚠️  НЕСООТВЕТСТВИЕ:');
                    console.log('   is_admin=true в БД, но ID не в списке ADMIN_TELEGRAM_IDS');
                    console.log('   Решение: добавьте ID в ADMIN_TELEGRAM_IDS или обновите БД');
                } else {
                    console.log('\n✅ Права настроены корректно');
                }
            } else {
                console.log('❌ Пользователь с таким Telegram ID не найден в базе');
                console.log('   Пользователь должен авторизоваться в приложении');
            }
            
            await db.close();
        } catch (error) {
            console.error('❌ Ошибка:', error.message);
        }
    })();
} else {
    checkUsers();
}
