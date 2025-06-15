require("dotenv").config();
const axios = require("axios");
const mysql = require("mysql");

console.log("Инициализация telegram-handler.js");

// Проверка дублирования запуска
if (global.telegramHandlerStarted) {
  console.warn("Telegram handler уже запущен! Пропускаем дубликат");
  return;
}
global.telegramHandlerStarted = true;

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error("TELEGRAM_BOT_TOKEN не установлен! Telegram polling отключен.");
  return;
}

console.log("Токен бота:", BOT_TOKEN.slice(0, 10) + "...");

const TELEGRAM_API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;
console.log("Telegram API Base:", TELEGRAM_API_BASE);

let pollingTimeout = null;
let isPollingActive = true;
let lastUpdateId = 0;
let isActive = true;
const RETRY_DELAY = 10000;

// Настройка подключения к БД
const db = mysql.createConnection({
  user: "root",
  host: "localhost",
  password: "",
  database: "store",
  multipleStatements: true,
});

db.connect((err) => {
  if (err) {
    console.error("Ошибка подключения к БД:", err.message);
  } else {
    console.log("Подключено к БД");
    // Проверка таблицы employees
    db.query("SELECT COUNT(*) AS count FROM employees", (err, result) => {
      if (err) {
        console.error("Ошибка проверки таблицы employees:", err);
      } else {
        console.log(`В таблице employees ${result[0].count} записей`);
      }
    });
  }
});

// Импорт функции отправки сообщения
const { sendTelegramMessage } = require("./telegram");

/**
 * Основная функция опроса Telegram
 */
async function safePollTelegram() {
  if (!isPollingActive) return;

  try {
    // console.log(`🔄 Опрос Telegram (offset: ${lastUpdateId + 1})`);
    const url = `${TELEGRAM_API_BASE}/getUpdates?timeout=10&limit=10&offset=${
      lastUpdateId + 1
    }`;
    // console.log("Запрос к Telegram:", url);

    const { data } = await axios.get(url, {
      timeout: 15000,
    });

    console.log("Ответ Telegram:", JSON.stringify(data, null, 2));

    if (!data.ok) {
      if (data.error_code === 409) {
        throw new Error("CONFLICT_409");
      }
      console.warn("Ошибка Telegram API:", data);
      return;
    }

    if (data.result && data.result.length > 0) {
      console.log(`Получено обновлений: ${data.result.length}`);
      for (const upd of data.result) {
        lastUpdateId = Math.max(lastUpdateId, upd.update_id);

        const message = upd.message;
        if (!message || !message.text) continue;

        console.log(
          `Обработка сообщения: ${message.text} от ${message.chat.id}`
        );

        if (message.text === "/test") {
          await sendTelegramMessage(
            message.chat.id,
            "✅ Бот работает! Ваш chat_id: " + message.chat.id
          );
          continue;
        }

        if (message.text.startsWith("/bind")) {
          processBindCommand(message);
        }
      }
    } else {
      console.log("Нет новых обновлений");
    }
  } catch (e) {
    console.error("Ошибка при опросе Telegram:", e.message);

    if (
      e.message === "CONFLICT_409" ||
      (e.response && e.response.data && e.response.data.error_code === 409)
    ) {
      console.error("⚠️ Обнаружен конфликт сессии. Перезапуск через 10s...");
      stopPolling();
      await new Promise((r) => setTimeout(r, RETRY_DELAY));
      startPolling();
      return; // Важно: прерываем текущую итерацию
    }
  } finally {
    // Планируем следующий опрос только если polling активен
    if (isPollingActive) {
      pollingTimeout = setTimeout(safePollTelegram, 3000);
    }
  }
}

/**
 * Обработка команды /bind
 */
async function processBindCommand(message) {
  try {
    console.log(`Обработка команды /bind: ${message.text}`);

    const text = message.text.trim();
    const parts = text.split(/\s+/);

    if (parts.length < 2) {
      console.log("Недостаточно параметров для команды /bind");
      await sendTelegramMessage(
        message.chat.id,
        `❌ Неверный формат. Используйте:\n<code>/bind ваш_email@пример.com</code>`
      );
      return;
    }

    const rawEmail = parts[1].trim().toLowerCase();
    const chatId = message.chat.id;

    console.log(`Поиск сотрудника с email: ${rawEmail}`);

    // Используем промисы для работы с БД
    const findEmployee = () =>
      new Promise((resolve, reject) => {
        // ИСПРАВЛЕННЫЙ ЗАПРОС - используем employee_id вместо id
        const findSql = `SELECT employee_id FROM employees WHERE email = ? LIMIT 1`;
        db.query(findSql, [rawEmail], (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        });
      });

    const rows = await findEmployee();
    console.log(`Результат поиска: ${rows.length} совпадений`);

    if (!rows.length) {
      await sendTelegramMessage(
        chatId,
        `❌ Не найден сотрудник с email <b>${rawEmail}</b>.`
      );
      return;
    }

    // ИСПРАВЛЕНО - получаем employee_id вместо id
    const employeeId = rows[0].employee_id;
    console.log(`Найден сотрудник ID: ${employeeId}`);

    // Обновление связи
    const upsertLink = () =>
      new Promise((resolve, reject) => {
        const upsertSql = `
        INSERT INTO telegram_links (employee_id, telegram_chat_id)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE
          telegram_chat_id = VALUES(telegram_chat_id),
          updated_at = CURRENT_TIMESTAMP
      `;
        db.query(upsertSql, [employeeId, chatId], (err) => {
          if (err) return reject(err);
          resolve();
        });
      });

    await upsertLink();
    console.log(
      `Привязка сохранена: сотрудник ${employeeId} -> chat_id ${chatId}`
    );

    await sendTelegramMessage(
      chatId,
      `✅ Привязка завершена! Теперь вы будете получать уведомления.`
    );
  } catch (error) {
    console.error("Ошибка обработки команды /bind:", error);
    await sendTelegramMessage(
      message.chat.id,
      `❌ Произошла ошибка при обработке вашего запроса. Пожалуйста, попробуйте позже.`
    );
  }
}

/**
 * Запускает опрос
 */
function startPolling() {
  stopPolling(); // Останавливаем предыдущие
  isPollingActive = true;

  console.log("🟢 ЗАПУСК POLLING...");

  // Сброс сессии перед запуском
  axios
    .get(`${TELEGRAM_API_BASE}/getUpdates?offset=-1`)
    .then(() => {
      console.log("✅ Сессия сброшена");
      // Запускаем первый опрос без задержки
      safePollTelegram();
    })
    .catch((e) => {
      console.error("⚠️ Ошибка сброса сессии:", e.message);
      // Все равно запускаем опрос
      safePollTelegram();
    });
}
/**
 * Останавливает опрос
 */
function stopPolling() {
  isPollingActive = false;
  if (pollingTimeout) {
    clearTimeout(pollingTimeout);
    pollingTimeout = null;
    console.log("🛑 POLLING ОСТАНОВЛЕН");
  }
}

// Обработчики завершения работы
process.on("SIGINT", () => {
  console.log("\nЗавершение работы...");
  stopPolling();
  db.end();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\nПринудительное завершение...");
  stopPolling();
  db.end();
  process.exit(0);
});

// Экспорт функций
module.exports = {
  startPolling,
  stopPolling,
};
