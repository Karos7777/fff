const fs = require('fs');
const path = require('path');

// Фиксированный JWT_SECRET для тестирования (тот же, что используется в middleware.js)
const JWT_SECRET = 'default-secret-change-in-production';

// Создаем .env файл с правильным JWT_SECRET
const envContent = `# Переменные окружения для реального тестирования
PORT=10000
JWT_SECRET=${JWT_SECRET}

# Telegram Bot (замените на ваш реальный токен)
BOT_TOKEN=your_telegram_bot_token_here

# TON Blockchain - РЕАЛЬНЫЕ ДАННЫЕ
TON_WALLET_ADDRESS=UQCm27jo_LGzzwx49_niSXqEz9ZRRTyxJxa-yD89Wnxb13fx
TON_API_KEY=AGJ4P6VJKPV7UCYAAAAP6S6CTAJGDRRKT3ZS5HMONITCA6MVVVK6XI6EUSHVWGPN3HYTQTA

# Настройки платежей
MIN_CONFIRMATIONS_TON=1
MIN_CONFIRMATIONS_USDT=2
INVOICE_EXPIRY_MINUTES=30
AUTO_COMPLETE_ORDERS=true
`;

const envPath = path.join(__dirname, '.env');

try {
  fs.writeFileSync(envPath, envContent);
  console.log('✅ Файл .env создан с правильным JWT_SECRET!');
  console.log('🔑 JWT_SECRET:', JWT_SECRET);
  console.log('');
  console.log('🔧 Что настроено:');
  console.log('- JWT_SECRET:', JWT_SECRET);
  console.log('- TON кошелек:', 'UQCm27jo_LGzzwx49_niSXqEz9ZRRTyxJxa-yD89Wnxb13fx');
  console.log('- TON API ключ:', 'AGJ4P6VJ...HYTQTA');
  console.log('');
  console.log('🚀 Теперь токены будут работать правильно!');
} catch (error) {
  console.error('❌ Ошибка создания .env файла:', error);
}
