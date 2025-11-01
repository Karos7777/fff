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
    
    // Инициализируем таблицы платежей
    this.initPaymentTables();
  }

  initPaymentTables() {
    try {
      // Создаем таблицы для платежей
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS invoices (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          product_id INTEGER NOT NULL,
          
          amount REAL NOT NULL,
          currency TEXT NOT NULL,
          status TEXT DEFAULT 'pending',
          
          invoice_payload TEXT UNIQUE NOT NULL,
          
          telegram_payment_charge_id TEXT,
          telegram_provider_payment_charge_id TEXT,
          
          crypto_address TEXT,
          crypto_memo TEXT,
          crypto_tx_hash TEXT,
          crypto_confirmations INTEGER DEFAULT 0,
          
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          paid_at DATETIME,
          expires_at DATETIME,
          
          FOREIGN KEY (order_id) REFERENCES orders (id),
          FOREIGN KEY (user_id) REFERENCES users (id),
          FOREIGN KEY (product_id) REFERENCES products (id)
        )
      `);

      this.db.exec(`
        CREATE TABLE IF NOT EXISTS transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          invoice_id INTEGER NOT NULL,
          
          type TEXT NOT NULL,
          status TEXT NOT NULL,
          
          tx_hash TEXT,
          from_address TEXT,
          to_address TEXT,
          amount REAL NOT NULL,
          fee REAL DEFAULT 0,
          
          block_number INTEGER,
          confirmations INTEGER DEFAULT 0,
          
          telegram_payment_id TEXT,
          
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          confirmed_at DATETIME,
          
          metadata TEXT,
          
          FOREIGN KEY (invoice_id) REFERENCES invoices (id)
        )
      `);

      this.db.exec(`
        CREATE TABLE IF NOT EXISTS payment_settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          key TEXT UNIQUE NOT NULL,
          value TEXT NOT NULL,
          description TEXT,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Добавляем колонки в orders если их нет
      try {
        this.db.exec('ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT NULL');
      } catch (e) { /* колонка уже существует */ }
      
      try {
        this.db.exec('ALTER TABLE orders ADD COLUMN payment_status TEXT DEFAULT "unpaid"');
      } catch (e) { /* колонка уже существует */ }
      
      try {
        this.db.exec('ALTER TABLE orders ADD COLUMN total_amount REAL DEFAULT 0');
      } catch (e) { /* колонка уже существует */ }
      
      try {
        this.db.exec('ALTER TABLE orders ADD COLUMN currency TEXT DEFAULT "RUB"');
      } catch (e) { /* колонка уже существует */ }

      // Создаем индексы
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_invoices_payload ON invoices(invoice_payload)');
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status)');
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_transactions_hash ON transactions(tx_hash)');

      console.log('✅ Таблицы платежей инициализированы');
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

  // Создание инвойса для криптовалют (TON/USDT)
  async createCryptoInvoice(orderId, userId, productId, amount, currency) {
    try {
      const payload = this.generateInvoicePayload();
      const memo = `ORDER_${orderId}_${payload.substring(0, 8)}`;
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 минут

      // Используем основной кошелек для получения
      const cryptoAddress = this.tonWalletAddress;

      // Создаем запись в БД
      const insertInvoice = this.db.prepare(`
        INSERT INTO invoices (order_id, user_id, product_id, amount, currency, invoice_payload, crypto_address, crypto_memo, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const result = insertInvoice.run(orderId, userId, productId, amount, currency, payload, cryptoAddress, memo, expiresAt.toISOString());

      return {
        invoiceId: result.lastInsertRowid,
        payload: payload,
        address: cryptoAddress,
        memo: memo,
        amount: amount,
        currency: currency,
        expiresAt: expiresAt
      };
    } catch (error) {
      console.error('Ошибка создания крипто инвойса:', error);
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

  // Проверка криптоплатежей через TON API
  async checkCryptoPayments() {
    try {
      if (!this.tonApiKey || !this.tonWalletAddress) {
        console.log('TON API или адрес кошелька не настроены');
        return;
      }

      // Получаем все ожидающие крипто-инвойсы
      const getPendingInvoices = this.db.prepare(`
        SELECT * FROM invoices 
        WHERE status = 'pending' 
        AND currency IN ('TON', 'USDT') 
        AND expires_at > datetime('now')
      `);
      const pendingInvoices = getPendingInvoices.all();

      for (const invoice of pendingInvoices) {
        await this.checkSingleCryptoPayment(invoice);
      }
    } catch (error) {
      console.error('Ошибка проверки криптоплатежей:', error);
    }
  }

  // Проверка одного криптоплатежа
  async checkSingleCryptoPayment(invoice) {
    try {
      const response = await axios.get(
        `https://tonapi.io/v2/accounts/${this.tonWalletAddress}/transactions`,
        {
          headers: {
            'Authorization': `Bearer ${this.tonApiKey}`
          },
          params: {
            limit: 50,
            sort_order: 'desc'
          }
        }
      );

      const transactions = response.data.transactions || [];

      for (const tx of transactions) {
        // Проверяем входящие транзакции
        if (tx.in_msg && tx.in_msg.destination && 
            tx.in_msg.destination.address === this.tonWalletAddress) {
          
          const amount = parseInt(tx.in_msg.value) / 1e9; // Конвертируем из nanoTON
          const comment = tx.in_msg.decoded_body?.text || '';
          
          // Проверяем memo/comment
          if (comment.includes(invoice.crypto_memo) && 
              Math.abs(amount - invoice.amount) < 0.001) { // Допуск на комиссии
            
            // Проверяем количество подтверждений
            const confirmations = tx.now ? Math.floor((Date.now() / 1000 - tx.now) / 5) : 0;
            const minConfirmations = invoice.currency === 'TON' ? 1 : 2;
            
            if (confirmations >= minConfirmations) {
              await this.processCryptoPayment(invoice, tx, confirmations);
              return;
            }
          }
        }
      }
    } catch (error) {
      console.error('Ошибка проверки криптоплатежа:', error);
    }
  }

  // Обработка криптоплатежа
  async processCryptoPayment(invoice, transaction, confirmations) {
    try {
      // Проверяем, не был ли уже обработан
      if (invoice.status === 'paid') {
        return;
      }

      const txHash = transaction.hash;
      const amount = parseInt(transaction.in_msg.value) / 1e9;

      // Обновляем инвойс
      const updateInvoice = this.db.prepare(`
        UPDATE invoices SET 
          status = 'paid',
          crypto_tx_hash = ?,
          crypto_confirmations = ?,
          paid_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      updateInvoice.run(txHash, confirmations, invoice.id);

      // Создаем транзакцию
      const insertTransaction = this.db.prepare(`
        INSERT INTO transactions (invoice_id, type, status, tx_hash, from_address, to_address, amount, confirmations, confirmed_at, metadata)
        VALUES (?, ?, 'confirmed', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
      `);
      const metadata = JSON.stringify({
        block_number: transaction.lt,
        transaction_time: transaction.now,
        comment: transaction.in_msg.decoded_body?.text || ''
      });
      insertTransaction.run(
        invoice.id, 
        invoice.currency.toLowerCase(), 
        txHash,
        transaction.in_msg.source?.address || '',
        this.tonWalletAddress,
        amount,
        confirmations,
        metadata
      );

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
