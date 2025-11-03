#!/usr/bin/env node

/**
 * Скрипт диагностики конфигурации админа
 * Проверяет настройки ADMIN_TELEGRAM_IDS
 */

require('dotenv').config();

console.log('🔍 ========== ДИАГНОСТИКА ADMIN КОНФИГУРАЦИИ ==========\n');

// Проверка переменных окружения
console.log('📋 Переменные окружения:');
console.log('-------------------------');

const JWT_SECRET = process.env.JWT_SECRET;
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_IDS_ENV = process.env.ADMIN_TELEGRAM_IDS;

console.log('✓ JWT_SECRET:', JWT_SECRET ? `✅ Задан (${JWT_SECRET.substring(0, 10)}...)` : '❌ НЕ ЗАДАН');
console.log('✓ BOT_TOKEN:', BOT_TOKEN ? `✅ Задан (${BOT_TOKEN.substring(0, 10)}...)` : '❌ НЕ ЗАДАН');
console.log('✓ ADMIN_TELEGRAM_IDS:', ADMIN_IDS_ENV ? `✅ Задан` : '⚠️ НЕ ЗАДАН (используется хардкод)');

console.log('\n📝 Список админ ID:');
console.log('-------------------');

// Хардкод из server.js
const ADMIN_TELEGRAM_IDS_HARDCODED = [
    '853232715',
];

if (ADMIN_IDS_ENV) {
    const adminIds = ADMIN_IDS_ENV.split(',').map(id => id.trim());
    console.log('Источник: .env файл');
    console.log('ID администраторов:');
    adminIds.forEach((id, index) => {
        console.log(`  ${index + 1}. ${id}`);
    });
    console.log(`\n✅ Всего админов: ${adminIds.length}`);
} else {
    console.log('Источник: хардкод в server.js');
    console.log('ID администраторов:');
    ADMIN_TELEGRAM_IDS_HARDCODED.forEach((id, index) => {
        console.log(`  ${index + 1}. ${id}`);
    });
    console.log(`\n⚠️  Всего админов: ${ADMIN_TELEGRAM_IDS_HARDCODED.length}`);
    console.log('\n⚠️  ВНИМАНИЕ: ADMIN_TELEGRAM_IDS не задан в .env');
    console.log('   Добавьте в .env файл:');
    console.log('   ADMIN_TELEGRAM_IDS=ВАШ_TELEGRAM_ID');
}

console.log('\n🔍 Как узнать свой Telegram ID:');
console.log('--------------------------------');
console.log('1. Откройте бота @userinfobot в Telegram');
console.log('2. Нажмите /start');
console.log('3. Бот отправит ваш ID');
console.log('4. Добавьте ID в .env файл:');
console.log('   ADMIN_TELEGRAM_IDS=853232715,ВАШ_ID');

console.log('\n💡 Тестирование прав доступа:');
console.log('-----------------------------');

function testAdminCheck(telegramId) {
    const adminIds = ADMIN_IDS_ENV ? 
        ADMIN_IDS_ENV.split(',').map(id => id.trim()) : 
        ADMIN_TELEGRAM_IDS_HARDCODED;
    
    const isAdmin = adminIds.includes(telegramId.toString());
    return { adminIds, isAdmin };
}

// Примеры проверки
const testIds = ['853232715', '123456789'];
testIds.forEach(testId => {
    const result = testAdminCheck(testId);
    console.log(`ID ${testId}: ${result.isAdmin ? '✅ АДМИН' : '❌ НЕ АДМИН'}`);
});

console.log('\n🧪 Проверка вашего ID:');
console.log('----------------------');
console.log('Введите команду для проверки конкретного ID:');
console.log('node check-admin-config.js YOUR_TELEGRAM_ID');

// Если передан аргумент - проверяем его
if (process.argv[2]) {
    const userIdToCheck = process.argv[2];
    console.log(`\nПроверка ID: ${userIdToCheck}`);
    const result = testAdminCheck(userIdToCheck);
    console.log(`Список админов: [${result.adminIds.join(', ')}]`);
    console.log(`Результат: ${result.isAdmin ? '✅ ЭТО АДМИН' : '❌ НЕ АДМИН'}`);
    
    if (!result.isAdmin) {
        console.log('\n⚠️  Чтобы дать права админа:');
        console.log('1. Откройте .env файл');
        console.log('2. Добавьте/обновите строку:');
        if (ADMIN_IDS_ENV) {
            console.log(`   ADMIN_TELEGRAM_IDS=${ADMIN_IDS_ENV},${userIdToCheck}`);
        } else {
            console.log(`   ADMIN_TELEGRAM_IDS=${userIdToCheck}`);
        }
        console.log('3. Перезапустите сервер');
    }
}

console.log('\n========================================================\n');
