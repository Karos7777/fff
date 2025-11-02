// Простой тест TonAPI
// Используем встроенный fetch в Node.js 18+

async function testTonAPI() {
  const walletAddress = 'UQCm27jo_LGzzwx49_niSXqEz9ZRRTyxJxa-yD89Wnxb13fx';
  const apiKey = 'AGJ4P6VJKPV7UCYAAAAP6S6CTAJGDRRKT3ZS5HMONITCA6MVVVK6XI6EUSHVWGPN3HYTQTA';
  
  console.log('🧪 Тестируем TonAPI...');
  console.log('📍 Адрес:', walletAddress);
  console.log('🔑 API ключ:', apiKey.substring(0, 20) + '...');
  
  // Тест 1: Проверка аккаунта
  try {
    console.log('\n1️⃣ Проверяем существование аккаунта...');
    const accountUrl = `https://tonapi.io/v2/accounts/${walletAddress}`;
    console.log('🌐 URL:', accountUrl);
    
    const accountResponse = await fetch(accountUrl, {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });
    
    console.log('📡 Статус:', accountResponse.status, accountResponse.statusText);
    
    if (accountResponse.ok) {
      const accountData = await accountResponse.json();
      console.log('✅ Аккаунт найден!');
      console.log('💰 Баланс:', accountData.balance, 'nanoTON');
      console.log('📊 Статус:', accountData.status);
    } else {
      const errorText = await accountResponse.text();
      console.log('❌ Ошибка:', errorText);
    }
  } catch (error) {
    console.error('❌ Ошибка запроса аккаунта:', error.message);
  }
  
  // Тест 2: Проверка транзакций (альтернативные endpoints)
  const txEndpoints = [
    `https://tonapi.io/v2/accounts/${walletAddress}/transactions?limit=5`,
    `https://tonapi.io/v2/accounts/${walletAddress}/events?limit=5`,
    `https://toncenter.com/api/v2/getTransactions?address=${walletAddress}&limit=5`,
    `https://tonapi.io/v1/blockchain/accounts/${walletAddress}/transactions?limit=5`
  ];
  
  for (let i = 0; i < txEndpoints.length; i++) {
    try {
      console.log(`\n2️⃣.${i+1} Проверяем endpoint ${i+1}...`);
      const txUrl = txEndpoints[i];
      console.log('🌐 URL:', txUrl);
      
      const txResponse = await fetch(txUrl, {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      
      console.log('📡 Статус:', txResponse.status, txResponse.statusText);
      
      if (txResponse.ok) {
        const txData = await txResponse.json();
        console.log('✅ Транзакции получены!');
        console.log('📊 Структура ответа:', Object.keys(txData));
        
        // Пробуем разные поля для транзакций
        const transactions = txData.transactions || txData.result || txData.events || [];
        console.log('📊 Количество транзакций:', transactions.length);
        
        if (transactions.length > 0) {
          const lastTx = transactions[0];
          console.log('🔍 Последняя транзакция:', JSON.stringify(lastTx, null, 2));
          break; // Если нашли рабочий endpoint, выходим
        }
      } else {
        const errorText = await txResponse.text();
        console.log('❌ Ошибка:', errorText);
      }
    } catch (error) {
      console.error('❌ Ошибка запроса:', error.message);
    }
  }
  
  // Тест 3: Без авторизации
  try {
    console.log('\n3️⃣ Проверяем без авторизации...');
    const noAuthUrl = `https://tonapi.io/v2/accounts/${walletAddress}`;
    
    const noAuthResponse = await fetch(noAuthUrl);
    console.log('📡 Статус без авторизации:', noAuthResponse.status, noAuthResponse.statusText);
    
    if (noAuthResponse.ok) {
      console.log('✅ Запрос без авторизации работает!');
    } else {
      console.log('❌ Требуется авторизация');
    }
  } catch (error) {
    console.error('❌ Ошибка запроса без авторизации:', error.message);
  }
}

testTonAPI().catch(console.error);
