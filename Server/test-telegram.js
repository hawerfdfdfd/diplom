// test-telegram.js
require("dotenv").config();
const axios = require("axios");

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function testPolling() {
  try {
    // 1. Сброс текущей сессии
    await axios.get(`${TELEGRAM_API_BASE}/getUpdates?offset=-1`);
    console.log("✅ Сессия успешно сброшена");

    // 2. Тестовый запрос
    const response = await axios.get(
      `${TELEGRAM_API_BASE}/getUpdates?offset=0`
    );
    console.log(
      "📩 Ответ от Telegram:",
      JSON.stringify(response.data, null, 2)
    );

    // 3. Проверка на конфликт
    if (!response.data.ok && response.data.error_code === 409) {
      console.error("❌ Обнаружен конфликт сессий!");
    } else {
      console.log("🎉 Успешное подключение без конфликтов!");
    }
  } catch (error) {
    console.error(
      "🔥 Критическая ошибка:",
      error.response?.data || error.message
    );
  }
}

testPolling();