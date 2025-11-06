const crypto = require('crypto');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

class PaymentService {
  constructor(db, botToken) {
    this.db = db;
    this.botToken = botToken;
    this.tonApiKey = process.env.TON_API_KEY || '';
    this.tonWalletAddress = process.env.TON_WALLET_ADDRESS || '';
    this.starsProviderToken = process.env.STARS_PROVIDER_TOKEN || '';
    
    console.log('🔍 TON настройки:');
    console.log('- Кошелек:', this.tonWalletAddress ? `настроен (${this.tonWalletAddress})` : 'не настроен');
    console.log('- API ключ:', this.tonApiKey ? `настроен (${this.tonApiKey.substring(0, 20)}...)` : 'не настроен');
    
    if (!this.tonWalletAddress || !this.tonApiKey) {
      console.warn('⚠️  ВНИМАНИЕ: TON настройки не полные - криптоплатежи работать не будут!');
    }
    
    // Таблицы будут инициализированы через вызов initPaymentTables() в server.js
  }

  async initPaymentTables() {
    try {
      console.log('🔄 Инициализация таблиц платежей...');
      
      // Создаем таблицу invoices БЕЗ invoice_payload (добавим позже)
      await this.db.exec(`
        CREATE TABLE IF NOT EXISTS invoices (
          id SERIAL PRIMARY KEY,
          order_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          product_id INTEGER NOT NULL,
          
          amount DECIMAL(10,2) NOT NULL,
          currency TEXT NOT NULL,
          status TEXT DEFAULT 'pending',
          
          telegram_payment_charge_id TEXT,
          telegram_provider_payment_charge_id TEXT,
          
          crypto_address TEXT,
          crypto_memo TEXT,
          crypto_tx_hash TEXT,
          crypto_confirmations INTEGER DEFAULT 0,
          
          created_at TIMESTAMP DEFAULT NOW(),
          paid_at TIMESTAMP,
          expires_at TIMESTAMP,
          
          FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
          FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
        )
      `);
      
      // Проверяем и добавляем колонку invoice_payload если её нет
      try {
        await this.db.exec(`
          ALTER TABLE invoices 
          ADD COLUMN IF NOT EXISTS invoice_payload TEXT UNIQUE
        `);
        console.log('✅ Колонка invoice_payload проверена/добавлена');
      } catch (e) {
        console.log('⚠️ Колонка invoice_payload уже существует или ошибка:', e.message);
      }

      await this.db.exec(`
        CREATE TABLE IF NOT EXISTS transactions (
          id SERIAL PRIMARY KEY,
          invoice_id INTEGER NOT NULL,
          
          type TEXT NOT NULL,
          status TEXT NOT NULL,
          
          tx_hash TEXT,
          from_address TEXT,
          to_address TEXT,
          amount DECIMAL(10,2) NOT NULL,
          fee DECIMAL(10,2) DEFAULT 0,
          
          block_number INTEGER,
          confirmations INTEGER DEFAULT 0,
          
          telegram_payment_id TEXT,
          
          created_at TIMESTAMP DEFAULT NOW(),
          confirmed_at TIMESTAMP,
          
          metadata TEXT,
          
          FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE CASCADE
        )
      `);

      await this.db.exec(`
        CREATE TABLE IF NOT EXISTS payment_settings (
          id SERIAL PRIMARY KEY,
          key TEXT UNIQUE NOT NULL,
          value TEXT NOT NULL,
          description TEXT,
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // Добавляем колонки в orders если их нет (PostgreSQL синтаксис)
      console.log('🔄 Проверка колонок в таблице orders...');
      try {
        await this.db.exec('ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT');
        console.log('✅ Колонка payment_method проверена');
      } catch (e) { 
        console.log('⚠️ payment_method:', e.message);
      }
      
      try {
        await this.db.exec('ALTER TABLE orders ADD COLUMN IF NOT EXISTS transaction_hash TEXT');
        console.log('✅ Колонка transaction_hash проверена');
      } catch (e) { 
        console.log('⚠️ transaction_hash:', e.message);
      }
      
      try {
        await this.db.exec('ALTER TABLE orders ADD COLUMN IF NOT EXISTS price DECIMAL(10,2)');
        console.log('✅ Колонка price проверена');
      } catch (e) { 
        console.log('⚠️ price:', e.message);
      }

      // Создаем индексы (только после того, как убедились что колонки существуют)
      console.log('🔄 Создание индексов...');
      try {
        await this.db.exec('CREATE INDEX IF NOT EXISTS idx_invoices_payload ON invoices(invoice_payload)');
        console.log('✅ Индекс idx_invoices_payload создан');
      } catch (e) {
        console.log('⚠️ Индекс idx_invoices_payload:', e.message);
      }
      
      try {
        await this.db.exec('CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status)');
        console.log('✅ Индекс idx_invoices_status создан');
      } catch (e) {
        console.log('⚠️ Индекс idx_invoices_status:', e.message);
      }
      
      try {
        await this.db.exec('CREATE INDEX IF NOT EXISTS idx_transactions_hash ON transactions(tx_hash)');
        console.log('✅ Индекс idx_transactions_hash создан');
      } catch (e) {
        console.log('⚠️ Индекс idx_transactions_hash:', e.message);
      }

      console.log('✅ Таблицы платежей инициализированы успешно');
    } catch (error) {
      console.error('❌ Ошибка инициализации таблиц платежей:', error);
      throw error;
    }
  }

  // Генерация уникального payload для инвойса
  generateInvoicePayload() {
    return crypto.randomBytes(16).toString('hex');
  }

  // Создание инвойса для Telegram Stars
  async createStarsInvoice(orderId, userId, productId, amount, description) {
    try {
      const payload = this.generateInvoicePayload();
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 минут

      // Создаем запись в БД
      const insertInvoice = this.db.prepare(`
        INSERT INTO invoices (order_id, user_id, product_id, amount, currency, invoice_payload, expires_at)
        VALUES (?, ?, ?, ?, 'XTR', ?, ?)
      `);
      const result = insertInvoice.run(orderId, userId, productId, amount, payload, expiresAt.toISOString());

      // Создаем инвойс в Telegram
      const telegramInvoice = {
        title: description,
        description: `Оплата заказа #${orderId}`,
        payload: payload,
        provider_token: '', // Пустой для Stars
        currency: 'XTR',
        prices: [{ label: description, amount: amount }],
        max_tip_amount: 0,
        suggested_tip_amounts: [],
        need_name: false,
        need_phone_number: false,
        need_email: false,
        need_shipping_address: false,
        send_phone_number_to_provider: false,
        send_email_to_provider: false,
        is_flexible: false
      };

      return {
        invoiceId: result.lastInsertRowid,
        payload: payload,
        telegramInvoice: telegramInvoice,
        expiresAt: expiresAt
      };
    } catch (error) {
      console.error('Ошибка создания Stars инвойса:', error);
      throw error;
    }
  }

  // Создание криптоинвойса для TON
  async createCryptoInvoice(orderId, userId, productId, amount, currency) {
    try {
      console.log('[TON INVOICE] Создание инвойса:', { orderId, userId, productId, amount, currency });
      
      // TON платежи
      if (currency === 'TON') {
        const amountParsed = parseFloat(amount);
        const amountNano = Math.round(amountParsed * 1_000_000_000);
        const payload = `order_${orderId}`;
        const address = process.env.TON_WALLET_ADDRESS?.trim();

        // ПРОВЕРКА ВСЕГО
        if (!orderId || !userId || !amountParsed || !address) {
          throw new Error('TON: missing orderId, userId, amount, or TON_WALLET_ADDRESS');
        }

        const tonDeepLink = `ton://transfer/${address}?amount=${amountNano}&text=${payload}`;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(tonDeepLink)}`;

        console.log('[TON INVOICE] Параметры:', { orderId, userId, amount: amountParsed, amountNano, payload });
        console.log('[TON INVOICE] Deep link:', tonDeepLink);
        console.log('[TON INVOICE] QR URL:', qrUrl);

        // 100% СОВМЕСТИМО с схемой invoices
        const sql = `
          INSERT INTO invoices 
            (order_id, user_id, product_id, amount, currency, status, invoice_payload, crypto_address)
          VALUES 
            ($1, $2, $3, $4, $5, 'pending', $6, $7)
          RETURNING id, invoice_payload
        `;

        const insertInvoice = this.db.prepare(sql);
        const result = await insertInvoice.get(
          orderId,
          userId,
          productId,
          amountParsed,
          currency,
          payload,
          address
        );

        console.log('[TON INVOICE] УСПЕШНО:', {
          id: result.id,
          orderId,
          userId,
          amount: amountParsed,
          payload,
          url: tonDeepLink,
          qr: qrUrl
        });

        return {
          id: result.id,
          invoiceId: result.id,
          orderId,
          userId,
          amount: amountParsed,
          amountNano,
          currency,
          payload,
          address,
          url: tonDeepLink,
          qr: qrUrl
        };
      }
      
      // USDT или другие криптовалюты
      throw new Error('Неподдерживаемая валюта');
    } catch (error) {
      console.error('❌ Ошибка создания крипто инвойса:', error);
      console.error('❌ Детали:', error.message);
      throw error;
    }
  }

  // Валидация pre_checkout_query для Stars
  async validatePreCheckout(preCheckoutQuery) {
    try {
      const { id, from, currency, total_amount, invoice_payload } = preCheckoutQuery;

      // Проверяем инвойс в БД
      const getInvoice = this.db.prepare('SELECT * FROM invoices WHERE invoice_payload = ? AND status = "pending"');
      const invoice = getInvoice.get(invoice_payload);

      if (!invoice) {
        return { ok: false, error_message: 'Инвойс не найден или уже оплачен' };
      }

      // Проверяем срок действия
      if (new Date() > new Date(invoice.expires_at)) {
        // Обновляем статус на expired
        const updateInvoice = this.db.prepare('UPDATE invoices SET status = "expired" WHERE id = ?');
        updateInvoice.run(invoice.id);
        return { ok: false, error_message: 'Срок действия инвойса истек' };
      }

      // Проверяем сумму и валюту
      if (currency !== 'XTR' || total_amount !== invoice.amount) {
        return { ok: false, error_message: 'Неверная сумма или валюта' };
      }

      // Проверяем пользователя
      if (from.id.toString() !== invoice.user_id.toString()) {
        return { ok: false, error_message: 'Неверный пользователь' };
      }

      return { ok: true };
    } catch (error) {
      console.error('Ошибка валидации pre_checkout:', error);
      return { ok: false, error_message: 'Внутренняя ошибка сервера' };
    }
  }

  // Обработка успешного платежа Stars
  async processStarsPayment(successfulPayment) {
    try {
      const { telegram_payment_charge_id, provider_payment_charge_id, invoice_payload, total_amount, currency } = successfulPayment;

      // Находим инвойс
      const getInvoice = this.db.prepare('SELECT * FROM invoices WHERE invoice_payload = ?');
      const invoice = getInvoice.get(invoice_payload);

      if (!invoice) {
        throw new Error('Инвойс не найден');
      }

      // Проверяем, не был ли уже обработан
      if (invoice.status === 'paid') {
        console.log('Платеж уже был обработан:', invoice_payload);
        return invoice;
      }

      // Обновляем инвойс
      const updateInvoice = this.db.prepare(`
        UPDATE invoices SET 
          status = 'paid',
          telegram_payment_charge_id = ?,
          telegram_provider_payment_charge_id = ?,
          paid_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      updateInvoice.run(telegram_payment_charge_id, provider_payment_charge_id, invoice.id);

      // Создаем транзакцию
      const insertTransaction = this.db.prepare(`
        INSERT INTO transactions (invoice_id, type, status, amount, telegram_payment_id, confirmed_at, metadata)
        VALUES (?, 'stars', 'confirmed', ?, ?, CURRENT_TIMESTAMP, ?)
      `);
      const metadata = JSON.stringify({
        telegram_payment_charge_id,
        provider_payment_charge_id,
        currency,
        total_amount
      });
      insertTransaction.run(invoice.id, total_amount, telegram_payment_charge_id, metadata);

      // Обновляем заказ
      const updateOrder = this.db.prepare(`
        UPDATE orders SET 
          payment_method = 'stars',
          payment_status = 'paid',
          status = 'paid',
          total_amount = ?,
          currency = 'XTR'
        WHERE id = ?
      `);
      updateOrder.run(total_amount, invoice.order_id);

      // Отправляем уведомление пользователю
      await this.sendPaymentNotification(invoice, 'stars');

      console.log('✅ Stars платеж обработан:', invoice_payload);
      return invoice;
    } catch (error) {
      console.error('Ошибка обработки Stars платежа:', error);
      throw error;
    }
  }

  // Проверка криптоплатежей (упрощенная версия без комментариев)
  async checkCryptoPayments() {
    try {
      if (!this.tonApiKey || !this.tonWalletAddress) {
        console.log('TON API или адрес кошелька не настроены');
        return;
      }

      // Получаем все ожидающие крипто инвойсы
      const getPendingInvoices = this.db.prepare(`
        SELECT * FROM invoices 
        WHERE status = 'pending' 
        AND currency IN ('TON', 'USDT')
        AND expires_at > datetime('now')
        ORDER BY created_at DESC
      `);
      const pendingInvoices = getPendingInvoices.all();

      if (pendingInvoices.length === 0) {
        return;
      }

      console.log(`🔍 Проверяем ${pendingInvoices.length} ожидающих крипто платежей`);
      
      // Выводим информацию о ожидающих инвойсах
      pendingInvoices.forEach(invoice => {
        console.log(`📋 Инвойс #${invoice.id}: ${invoice.amount} ${invoice.currency}, создан ${invoice.created_at}`);
      });

      // Получаем последние транзакции кошелька
      // TonAPI v2 требует "сырой" формат адреса (0:hex)
      let walletAddress = this.tonWalletAddress;
      
      // Конвертируем user-friendly адрес в raw формат
      if (walletAddress.startsWith('UQ') || walletAddress.startsWith('EQ')) {
        // Убираем префикс UQ/EQ и конвертируем в 0:hex формат
        const base64Part = walletAddress.substring(2);
        try {
          // Декодируем base64 в hex
          const buffer = Buffer.from(base64Part, 'base64');
          const hex = buffer.toString('hex');
          walletAddress = `0:${hex}`;
        } catch (e) {
          console.warn('⚠️ Не удалось конвертировать адрес, используем исходный');
        }
      }
      
      const apiUrl = `https://tonapi.io/v2/accounts/${walletAddress}/events?limit=20`;
      console.log('🌐 Запрос к TonAPI:', apiUrl);
      console.log('🔑 Исходный адрес:', this.tonWalletAddress);
      console.log('🔑 Используемый адрес:', walletAddress);
      
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${this.tonApiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.log('❌ Первая попытка неудачна, пробуем исходный адрес...');
        
        // Пробуем другие варианты API
        console.log('🔄 Пробуем альтернативные endpoints...');
        
        // Вариант 1: Без Bearer токена
        const noAuthUrl = `https://tonapi.io/v2/accounts/${this.tonWalletAddress}/events?limit=20`;
        console.log('🌐 Попытка без авторизации:', noAuthUrl);
        
        const noAuthResponse = await fetch(noAuthUrl);
        if (noAuthResponse.ok) {
          console.log('✅ Запрос без авторизации успешен!');
          var data = await noAuthResponse.json();
        } else {
          // Вариант 2: Проверяем, существует ли аккаунт
          const accountUrl = `https://tonapi.io/v2/accounts/${this.tonWalletAddress}`;
          console.log('🌐 Проверяем существование аккаунта:', accountUrl);
          
          const accountResponse = await fetch(accountUrl, {
            headers: { 'Authorization': `Bearer ${this.tonApiKey}` }
          });
          
          if (accountResponse.ok) {
            console.log('✅ Аккаунт найден, но транзакции недоступны');
            const accountData = await accountResponse.json();
            console.log('📊 Данные аккаунта:', JSON.stringify(accountData, null, 2));
            throw new Error('Аккаунт найден, но транзакции недоступны');
          } else {
            const errorText = await accountResponse.text();
            console.error('❌ Аккаунт не найден:', errorText);
            throw new Error(`Аккаунт не найден: ${accountResponse.status} - ${errorText}`);
          }
        }
      } else {
        var data = await response.json();
        console.log('✅ Основной запрос успешен!');
      }
      const events = data.events || [];
      console.log(`📊 Получено ${events.length} событий`);

      // Анализируем каждое событие
      for (let i = 0; i < events.length; i++) {
        const event = events[i];
        console.log(`\n🔍 === СОБЫТИЕ ${i + 1}/${events.length} ===`);
        console.log('📋 Структура события:', JSON.stringify(event, null, 2));
        
        // Проверяем действия в событии
        if (!event.actions || event.actions.length === 0) {
          console.log('⏭️ Пропускаем: нет действий');
          continue;
        }
        
        // Ищем TonTransfer действие
        for (const action of event.actions) {
          if (action.type === 'TonTransfer' && action.TonTransfer) {
            const transfer = action.TonTransfer;
            const amount = parseFloat(transfer.amount) / 1e9; // Конвертируем из nanotons
            const comment = transfer.comment || '';
            const eventTime = new Date(event.timestamp * 1000);
            
            console.log(`📊 TON Transfer: ${amount} TON, комментарий: "${comment}", время: ${eventTime.toLocaleString()}`);
            
            // Если нет комментария, пропускаем
            if (!comment) {
              console.log('⏭️ Пропускаем: нет комментария');
              continue;
            }
            
            // Проверяем каждый ожидающий инвойс
            for (const invoice of pendingInvoices) {
              console.log(`\n📋 Проверяем инвойс #${invoice.id} (memo: "${invoice.crypto_memo}"):`);
              
              const memoMatch = comment.trim() === (invoice.crypto_memo || '').trim();
              const amountMatch = Math.abs(amount - invoice.amount) < 0.001;
              
              console.log(`   - Точное совпадение memo: ${memoMatch}`);
              console.log(`   - Сумма совпадает: ${amountMatch} (${amount} ≈ ${invoice.amount})`);
              
              if (memoMatch && amountMatch) {
                console.log(`✅ НАЙДЕН ПЛАТЕЖ! Инвойс #${invoice.id}, заказ #${invoice.order_id}`);
                await this.processCryptoPayment(invoice, event.event_id, amount);
                return; // Выходим после первого найденного платежа
              }
            }
          }
        }
      }
      
      console.log('🔍 Проверка завершена. Новых платежей не найдено.');
    } catch (error) {
      console.error('Ошибка проверки криптоплатежа:', error);
    }
  }

  // Обработка криптоплатежа
  async processCryptoPayment(invoice, eventId, amount) {
    try {
      // Проверяем, не был ли уже обработан
      if (invoice.status === 'paid') {
        return;
      }

      const txHash = eventId; // Используем event_id как идентификатор
      // amount уже передается как параметр

      // Обновляем инвойс
      const updateInvoice = this.db.prepare(`
        UPDATE invoices SET 
          status = 'paid',
          crypto_tx_hash = ?,
          crypto_confirmations = ?,
          paid_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      updateInvoice.run(txHash, 1, invoice.id); // Всегда считаем подтвержденным

      // Создаем транзакцию
      const insertTransaction = this.db.prepare(`
        INSERT INTO transactions (invoice_id, type, status, tx_hash, from_address, to_address, amount, confirmations, confirmed_at, metadata)
        VALUES (?, ?, 'confirmed', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
      `);
      const metadata = JSON.stringify({
        event_id: eventId,
        amount: amount,
        currency: invoice.currency
      });
      insertTransaction.run(invoice.id, 'crypto', txHash, 'external', process.env.TON_WALLET_ADDRESS, amount, 1, metadata);

      // Обновляем заказ
      const updateOrder = this.db.prepare(`
        UPDATE orders SET 
          payment_method = ?,
          payment_status = 'paid',
          status = 'paid',
          total_amount = ?,
          currency = ?
        WHERE id = ?
      `);
      updateOrder.run(invoice.currency.toLowerCase(), amount, invoice.currency, invoice.order_id);

      // Отправляем уведомление
      await this.sendPaymentNotification(invoice, invoice.currency.toLowerCase(), txHash);

      console.log('✅ Криптоплатеж обработан:', txHash);
    } catch (error) {
      console.error('Ошибка обработки криптоплатежа:', error);
    }
  }

  // Отправка уведомления о платеже
  async sendPaymentNotification(invoice, paymentMethod, txHash = null) {
    try {
      if (!this.botToken) {
        console.log('BOT_TOKEN не настроен, уведомление не отправлено');
        return;
      }

      // Получаем данные о заказе и пользователе
      const getOrderData = this.db.prepare(`
        SELECT o.*, p.name as product_name, p.description, u.telegram_id, u.username
        FROM orders o
        JOIN products p ON o.product_id = p.id
        JOIN users u ON o.user_id = u.id
        WHERE o.id = ?
      `);
      const orderData = getOrderData.get(invoice.order_id);

      if (!orderData) {
        console.error('Данные заказа не найдены');
        return;
      }

      let message = `🎉 Оплата успешно получена!\n\n`;
      message += `📦 Товар: ${orderData.product_name}\n`;
      message += `💰 Сумма: ${invoice.amount} ${invoice.currency}\n`;
      message += `🔗 Заказ: #${invoice.order_id}\n`;
      
      if (paymentMethod === 'stars') {
        message += `⭐ Способ оплаты: Telegram Stars\n`;
      } else {
        message += `💎 Способ оплаты: ${invoice.currency}\n`;
        if (txHash) {
          message += `🔍 Транзакция: \`${txHash}\`\n`;
        }
      }
      
      message += `\n✅ Ваш заказ обрабатывается. Спасибо за покупку!`;

      // Отправляем сообщение пользователю
      await axios.post(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
        chat_id: orderData.telegram_id,
        text: message,
        parse_mode: 'Markdown'
      });

      console.log('✅ Уведомление отправлено пользователю:', orderData.telegram_id);
    } catch (error) {
      console.error('Ошибка отправки уведомления:', error);
    }
  }

  // Получение статуса инвойса
  getInvoiceStatus(invoicePayload) {
    try {
      const getInvoice = this.db.prepare(`
        SELECT i.*, o.status as order_status 
        FROM invoices i
        JOIN orders o ON i.order_id = o.id
        WHERE i.invoice_payload = ?
      `);
      return getInvoice.get(invoicePayload);
    } catch (error) {
      console.error('Ошибка получения статуса инвойса:', error);
      return null;
    }
  }

  // Конвертация рублей в TON (актуальный курс)
  convertRubToTON(rubAmount) {
    // Для тестирования: 1 рубль = 0.01 TON
    const TON_RATE = 100; // 1 TON ≈ 100 рублей
    const tonAmount = (rubAmount / TON_RATE).toFixed(4);
    
    // Минимальная сумма для тестирования
    return Math.max(parseFloat(tonAmount), 0.01).toString();
  }

  // Конвертация рублей в USDT (актуальный курс)
  convertRubToUSDT(rubAmount) {
    // Для тестирования: 1 рубль = 0.01 USDT
    const USDT_RATE = 90; // 1 USDT ≈ 90 рублей
    const usdtAmount = (rubAmount / USDT_RATE).toFixed(4);
    
    // Минимальная сумма для тестирования
    return Math.max(parseFloat(usdtAmount), 0.01).toString();
  }

  // Отмена просроченных инвойсов
  cancelExpiredInvoices() {
    try {
      const updateExpired = this.db.prepare(`
        UPDATE invoices SET status = 'expired' 
        WHERE status = 'pending' AND expires_at < datetime('now')
      `);
      const result = updateExpired.run();
      
      if (result.changes > 0) {
        console.log(`Отменено просроченных инвойсов: ${result.changes}`);
      }
    } catch (error) {
      console.error('Ошибка отмены просроченных инвойсов:', error);
    }
  }
}

module.exports = PaymentService;
