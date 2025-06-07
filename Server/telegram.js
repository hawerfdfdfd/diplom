// telegram.js
const axios = require("axios");
require("dotenv").config(); // если вы храните токен в .env

// Забираем токен бота из переменных окружения
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) {
  console.warn(
    "Warning: TELEGRAM_BOT_TOKEN не задан. Убедитесь, что в .env есть TELEGRAM_BOT_TOKEN."
  );
}
const TELEGRAM_API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

/**
 * Отправляет текстовое сообщение в Telegram.
 *
 * @param {string|number} chatId — целевой chat_id (из telegram_links)
 * @param {string} text — текст сообщения (можно использовать HTML-разметку)
 * @returns {Promise<void>}
 */
async function sendTelegramMessage(chatId, text) {
  if (!BOT_TOKEN) {
    console.error("sendTelegramMessage: TELEGRAM_BOT_TOKEN не задан.");
    return;
  }
  if (!chatId) {
    console.warn(
      "sendTelegramMessage: не передан chatId, пропускаем отправку."
    );
    return;
  }

  try {
    await axios.post(`${TELEGRAM_API_BASE}/sendMessage`, {
      chat_id: chatId,
      text: text,
      parse_mode: "HTML", // при желании можно убрать или заменить на "Markdown"
    });
  } catch (err) {
    // Логируем ошибку, но не бросаем её дальше, чтобы не ломать бизнес-логику
    console.error(
      "Ошибка при отправке сообщения в Telegram:",
      err.response?.data || err.message
    );
  }
}

module.exports = {
  sendTelegramMessage,
};
