// telegram-handler.js
require("dotenv").config();

const axios = require("axios");
const mysql = require("mysql");

// Забираем токен бота из переменных окружения
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) {
  console.warn(
    "Warning: TELEGRAM_BOT_TOKEN не задан. Убедитесь, что в .env есть TELEGRAM_BOT_TOKEN."
  );
}
const TELEGRAM_API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Функция для отправки сообщения (можно оставить уже существующую из telegram.js)
// Но здесь для простоты дублируем минимально:
async function sendTelegramMessage(chatId, text) {
  if (!BOT_TOKEN) return;
  if (!chatId) return;
  try {
    await axios.post(`${TELEGRAM_API_BASE}/sendMessage`, {
      chat_id: chatId,
      text: text,
      parse_mode: "HTML",
    });
  } catch (err) {
    console.error(
      "Ошибка при отправке сообщения в Telegram:",
      err.response?.data || err.message
    );
  }
}

// Утилита: получить numeric chat_id по username через getChat
async function resolveChatId(usernameOrId) {
  // Если уже цифры — возвращаем как есть
  if (/^\d+$/.test(usernameOrId.trim())) {
    return usernameOrId.trim();
  }

  // Иначе приводим к "@username"
  let raw = usernameOrId.trim();
  if (!raw.startsWith("@")) raw = "@" + raw;

  const url = `${TELEGRAM_API_BASE}/getChat?chat_id=${encodeURIComponent(raw)}`;
  try {
    const resp = await axios.get(url);
    const json = resp.data;
    if (json.ok && json.result && json.result.id) {
      return String(json.result.id);
    } else {
      console.warn("resolveChatId: getChat вернул неok:", JSON.stringify(json));
      return null;
    }
  } catch (e) {
    console.error(
      "resolveChatId: ошибка при запросе к Telegram:",
      e.response?.data || e.message
    );
    return null;
  }
}

// Настроим подключение к БД (можете взять те же параметры, что и в index.js)
const db = mysql.createConnection({
  user: "root",
  host: "localhost",
  password: "",
  database: "store",
  multipleStatements: true,
});

// === Основной поллинг ===
// Мы каждые 2 секунды проверяем новые апдейты, и если найдём команду "/bind",
// пытаемся записать в таблицу telegram_links (employee_id ↔ telegram_chat_id).

let lastUpdateId = 0;

async function pollTelegram() {
  if (!BOT_TOKEN) {
    console.warn("Telegram-поллинг: пропускаем, BOT_TOKEN не задан.");
    return;
  }

  try {
    // 1) Достаём getUpdates начиная с lastUpdateId+1
    const url = `${TELEGRAM_API_BASE}/getUpdates?timeout=0&limit=10&offset=${
      lastUpdateId + 1
    }`;
    const resp = await axios.get(url);
    const data = resp.data;

    if (!data.ok) {
      console.warn("getUpdates вернул ok=false:", data);
      return;
    }

    for (const upd of data.result) {
      lastUpdateId = upd.update_id;

      const message = upd.message;
      if (!message || !message.text) continue;

      // 2) Проверяем, начинается ли текст с "/bind"
      const text = message.text.trim();
      if (!text.startsWith("/bind")) continue;

      // Парсим "/bind <email>"
      // Возможные варианты: "/bind   email@domain.com", "/bindemail@domain.com" (неправильно) и т. д.
      const parts = text.split(/\s+/);
      if (parts.length < 2) {
        // Если без параметров — отправим инструкцию
        await sendTelegramMessage(
          message.chat.id,
          `❌ Неверный формат. Используйте:\n` +
            `<code>/bind ваш_email@пример.com</code>`
        );
        continue;
      }

      const rawEmail = parts[1].trim().toLowerCase();
      // 3) Ищем в таблице employees по полю email
      const findSql = `SELECT employee_id FROM employees WHERE email = ? LIMIT 1`;
      db.query(findSql, [rawEmail], async (err, rows) => {
        if (err) {
          console.error("Ошибка при SELECT employee по email:", err);
          await sendTelegramMessage(
            message.chat.id,
            `❌ Внутренняя ошибка сервера при поиске сотрудника.`
          );
          return;
        }

        if (!rows.length) {
          // Если не нашли —
          await sendTelegramMessage(
            message.chat.id,
            `❌ Не найден сотрудник с email <b>${rawEmail}</b>.`
          );
          return;
        }

        const employeeId = rows[0].employee_id;
        // 4) Сразу вставляем/обновляем в telegram_links
        const upsertSql = `
          INSERT INTO telegram_links (employee_id, telegram_chat_id)
          VALUES (?, ?)
          ON DUPLICATE KEY UPDATE
            telegram_chat_id = VALUES(telegram_chat_id),
            updated_at = CURRENT_TIMESTAMP
        `;
        const realChatId = String(message.chat.id);
        db.query(upsertSql, [employeeId, realChatId], async (err2) => {
          if (err2) {
            console.error("Ошибка при upsert telegram_links:", err2);
            await sendTelegramMessage(
              message.chat.id,
              `❌ Не удалось сохранить привязку.`
            );
            return;
          }
          await sendTelegramMessage(
            message.chat.id,
            `✅ Привязка завершена! Теперь вы будете получать уведомления.`
          );
        });
      });
    }
  } catch (e) {
    console.error("Ошибка polling Telegram:", e.response?.data || e.message);
  }
}

// Запускаем polling раз в 2 секунды
setInterval(pollTelegram, 2000);
console.log("Telegram polling запущен (каждые 2 секунды).");
