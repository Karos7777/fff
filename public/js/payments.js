// Модуль для работы с платежами

// Функции оплаты разными способами
async function payWithStars(productId) {
  try {
    showLoading();
    
    const user = window.Telegram?.WebApp?.initDataUnsafe?.user;
    if (!user) {
      throw new Error('Данные пользователя недоступны');
    }
    
    // Получаем информацию о товаре
    const product = window.products?.find(p => p.id === productId);
    if (!product || !product.price_stars) {
      throw new Error('Товар не найден или цена в Stars не указана');
    }
    
    console.log('⭐ [STARS] Начинаем оплату Stars для товара:', product.name);
    
    // Сначала создаем заказ
    const orderResponse = await fetch('/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
      },
      body: JSON.stringify({
        product_id: productId,
        quantity: 1,
        payment_method: 'stars'
      })
    });
    
    if (!orderResponse.ok) {
      const error = await orderResponse.json();
      throw new Error(error.error || 'Ошибка создания заказа');
    }
    
    const orderData = await orderResponse.json();
    console.log('✅ [STARS] Заказ создан:', orderData);
    
    // Теперь создаем инвойс для Stars
    const invoiceResponse = await fetch('/api/payments/create-stars-invoice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
      },
      body: JSON.stringify({
        orderId: orderData.order?.id || orderData.orderId,
        productId: productId
      })
    });
    
    if (!invoiceResponse.ok) {
      const error = await invoiceResponse.json();
      throw new Error(error.error || 'Ошибка создания инвойса');
    }
    
    const invoiceData = await invoiceResponse.json();
    
    if (!invoiceData.success) {
      throw new Error(invoiceData.error || 'Ошибка создания инвойса');
    }
    
    console.log('✅ [STARS] Инвойс создан:', invoiceData);
    console.log('🔍 [STARS] Проверка Telegram WebApp API:', {
      hasTelegram: !!window.Telegram,
      hasWebApp: !!window.Telegram?.WebApp,
      hasOpenInvoice: !!window.Telegram?.WebApp?.openInvoice,
      invoiceLink: invoiceData.invoice_link
    });
    
    // Проверяем доступность Telegram WebApp API
    if (!window.Telegram?.WebApp?.openInvoice) {
      console.log('⚠️ [STARS] openInvoice недоступен, пробуем альтернативный способ...');
      
      // Альтернативный способ - открываем через openTelegramLink
      if (window.Telegram?.WebApp?.openTelegramLink) {
        window.Telegram.WebApp.openTelegramLink(invoiceData.invoice_link);
        return;
      }
      
      throw new Error('Telegram WebApp API недоступен');
    }
    
    console.log('🎯 [STARS] Открываем платежную форму через openInvoice...');
    
    // Открываем инвойс через Telegram WebApp API
    window.Telegram.WebApp.openInvoice(invoiceData.invoice_link, (status) => {
      console.log('⭐ [STARS] Статус оплаты:', status);
      
      if (status === 'paid') {
        showSuccess('Оплата успешно завершена!');
        // Закрываем модальное окно товара
        closeProductModal();
      } else if (status === 'cancelled') {
        showError('Оплата отменена');
      } else if (status === 'failed') {
        showError('Ошибка оплаты');
      } else {
        console.log('❓ [STARS] Неизвестный статус:', status);
      }
    });
    
  } catch (error) {
    console.error('❌ [STARS] Ошибка при оплате Stars:', error);
    showError(`Ошибка: ${error.message}`);
  } finally {
    hideLoading();
  }
}

async function payWithTON(productId) {
  try {
    console.log('💎 [TON] Начинаем оплату TON для товара:', productId);
    
    // Закрываем модальное окно товара
    closeProductModal();
    
    // Открываем модальное окно оплаты с выбором TON
    if (typeof orderProduct === 'function') {
      orderProduct(productId, 'ton');
    } else {
      showError('Система оплаты TON временно недоступна');
    }
    
  } catch (error) {
    console.error('❌ [TON] Ошибка оплаты TON:', error);
    showError('Ошибка оплаты TON');
  }
}

async function payWithUSDT(productId) {
  try {
    console.log('💵 [USDT] Начинаем оплату USDT для товара:', productId);
    
    // Закрываем модальное окно товара
    closeProductModal();
    
    // Открываем модальное окно оплаты с выбором USDT
    if (typeof orderProduct === 'function') {
      orderProduct(productId, 'usdt');
    } else {
      showError('Система оплаты USDT временно недоступна');
    }
    
  } catch (error) {
    console.error('❌ [USDT] Ошибка оплаты USDT:', error);
    showError('Ошибка оплаты USDT');
  }
}

// Создание заказа (общая функция)
async function orderProduct(productId, paymentMethod = null) {
  try {
    console.log('📦 [ORDER] Создание заказа:', { productId, paymentMethod });
    
    if (!checkAuth()) {
      showError('Необходимо авторизоваться');
      return;
    }
    
    showLoading();
    
    const product = window.products.find(p => p.id === productId);
    if (!product) {
      throw new Error('Товар не найден');
    }
    
    if (product.stock_quantity <= 0) {
      throw new Error('Товар закончился');
    }
    
    const orderData = {
      product_id: productId,
      quantity: 1
    };
    
    if (paymentMethod) {
      orderData.payment_method = paymentMethod;
    }
    
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify(orderData)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Ошибка создания заказа');
    }
    
    const data = await response.json();
    console.log('✅ [ORDER] Заказ создан:', data);
    
    showSuccess('Заказ создан успешно!');
    
    // Открываем менеджер платежей если доступен
    if (window.paymentManager) {
      console.log('👉 [ORDER] Вызов paymentManager.showPaymentOptions...');
      window.paymentManager.showPaymentOptions(
        data.id, 
        productId, 
        product.name, 
        product.price
      );
    } else {
      // Если нет менеджера платежей, открываем "Мои заказы"
      if (typeof showOrdersModal === 'function') {
        setTimeout(() => showOrdersModal(), 500);
      }
    }

  } catch (error) {
    console.error('❌ [ORDER] Ошибка заказа:', error);
    showError('Ошибка при создании заказа: ' + error.message);
  } finally {
    hideLoading();
  }
}

// Проверка статуса платежа
async function checkPaymentStatus(paymentId) {
  try {
    console.log('🔍 [PAYMENT] Проверка статуса платежа:', paymentId);
    
    const response = await fetch(`/api/payments/status/${paymentId}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    console.log('📊 [PAYMENT] Статус платежа:', data);
    
    return data;
  } catch (error) {
    console.error('❌ [PAYMENT] Ошибка проверки статуса:', error);
    throw error;
  }
}

// Глобальная функция для тестирования кнопки Stars
window.testStarsButton = function() {
  console.log('🧪 [TEST] Тестирование кнопки Stars...');
  console.log('🔍 [TEST] Доступные функции:', {
    payWithStars: typeof window.payWithStars,
    Telegram: !!window.Telegram,
    WebApp: !!window.Telegram?.WebApp,
    openInvoice: !!window.Telegram?.WebApp?.openInvoice
  });
  
  // Попробуем вызвать функцию с тестовым ID
  if (typeof window.payWithStars === 'function') {
    console.log('✅ [TEST] Функция payWithStars доступна');
    // Не вызываем реальную функцию, только проверяем доступность
  } else {
    console.error('❌ [TEST] Функция payWithStars недоступна');
  }
};

// Экспорт функций в глобальную область
window.payWithStars = payWithStars;
window.payWithTON = payWithTON;
window.payWithUSDT = payWithUSDT;
window.orderProduct = orderProduct;
window.checkPaymentStatus = checkPaymentStatus;
