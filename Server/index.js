// в самом верху index.js
require("dotenv").config();

const axios = require("axios");
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

const express = require("express");
const mysql = require("mysql");
const cors = require("cors");
const path = require("path");
const { sendTelegramMessage } = require("./telegram");
const { startPolling } = require("./telegram-handler");
const app = express();

async function resolveChatId(usernameOrId) {
  // если цифры — возвращаем как есть
  if (/^\d+$/.test(usernameOrId.trim())) return usernameOrId.trim();

  // иначе приводим к "@username"
  let raw = usernameOrId.trim();
  if (!raw.startsWith("@")) raw = "@" + raw;

  // дергаем Telegram API
  const url = `${TELEGRAM_API_BASE}/getChat?chat_id=${encodeURIComponent(raw)}`;
  try {
    const resp = await fetch(url);
    const json = await resp.json();
    if (json.ok && json.result && json.result.id) {
      return String(json.result.id);
    } else {
      console.warn(
        "resolveChatId: getChat вернул не ok:",
        JSON.stringify(json)
      );
      return null;
    }
  } catch (e) {
    console.error("resolveChatId: ошибка при запросе к Telegram:", e);
    return null;
  }
}

app.use(express.json());
app.use(cors());

const db = mysql.createConnection({
  user: "root",
  host: "localhost",
  password: "",
  database: "store",
  multipleStatements: true,
});
console.log(
  "Using BOT_TOKEN:",
  process.env.TELEGRAM_BOT_TOKEN?.slice(0, 10) + "..."
);

app.get("/employees", (req, res) => {
  const sql = `
    SELECT
      e.employee_id,
      e.first_name,
      e.last_name,
      e.email,
      e.phone_number,
      e.hire_date,
      e.job_title,
      e.qualification,
      e.salary,
      e.department_id,
      d.department_name,
      -- Если найдётся запись в time_deductions → берём td.hours_remaining,
      -- иначе берём ws.working_hours (а не «135»).
      COALESCE(td.hours_remaining, ws.working_hours) AS hours_remaining,
      COALESCE(td.hours_used, 0) AS hours_used,
      ws.shift_type
    FROM employees e
    LEFT JOIN departments d
      ON e.department_id = d.department_id
    LEFT JOIN workschedules ws
      ON e.employee_id = ws.employee_id
    LEFT JOIN time_deductions td
      ON e.employee_id = td.employee_id
     AND td.time_year_month = DATE_FORMAT(CURDATE(), '%Y-%m')
    ORDER BY e.employee_id;
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json(results);
  });
});

app.get("/employees/:id", (req, res) => {
  const empId = req.params.id;
  const sql = `
    SELECT
      e.employee_id,
      e.first_name,
      e.last_name,
      e.email,
      e.phone_number,
      e.hire_date,
      e.job_title,
      e.qualification,
      e.salary,
      e.department_id,
      d.department_name,
      COALESCE(td.hours_remaining, ws.working_hours) AS hours_remaining,
      COALESCE(td.hours_used, 0) AS hours_used,
      ws.shift_type
    FROM employees e
    LEFT JOIN departments d
      ON e.department_id = d.department_id
    LEFT JOIN workschedules ws
      ON e.employee_id = ws.employee_id
    LEFT JOIN time_deductions td
      ON e.employee_id = td.employee_id
     AND td.time_year_month = DATE_FORMAT(CURDATE(), '%Y-%m')
    WHERE e.employee_id = ?
  `;
  db.query(sql, [empId], (err, results) => {
    if (err) return res.status(500).json({ error: err });
    if (!results.length) return res.status(404).json({ error: "Not found" });
    res.json(results[0]);
  });
});

app.get("/departments", (req, res) => {
  const sqlQuery = "SELECT * FROM departments";
  db.query(sqlQuery, (err, result) => {
    if (err) {
      console.error("Ошибка выполнения запроса:", err);
      res.status(500).json({ error: "Ошибка выполнения запроса" });
    } else {
      res.json(result);
    }
  });
});

app.get("/reports", (req, res) => {
  const sql = `
    SELECT
      r.report_id,
      r.report_date,
      r.employee_id,
      CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
      r.report_description,
      r.report_data,
      r.admin_comment
    FROM reports AS r
    JOIN employees AS e
      ON r.employee_id = e.employee_id
    ORDER BY r.report_date DESC
  `;
  db.query(sql, (err, rows) => {
    if (err) {
      console.error("Ошибка при получении отчётов:", err);
      return res.status(500).json({ error: "DB error on SELECT reports" });
    }
    res.json(rows);
  });
});

app.get("/vacations", (req, res) => {
  const sqlQuery = "SELECT * FROM vacations";
  db.query(sqlQuery, (err, result) => {
    if (err) {
      console.error("Ошибка выполнения запроса:", err);
      res.status(500).json({ error: "Ошибка выполнения запроса" });
    } else {
      res.json(result);
    }
  });
});

app.get("/workschedules", (req, res) => {
  const sqlQuery = "SELECT * FROM workschedules";
  db.query(sqlQuery, (err, result) => {
    if (err) {
      console.error("Ошибка выполнения запроса:", err);
      res.status(500).json({ error: "Ошибка выполнения запроса" });
    } else {
      res.json(result);
    }
  });
});

// GET /vacations/:employee_id — все записи об отпусках/отгулах/больничных
// 2) Новый роут для чтения vacations
app.get("/vacations/:employee_id", (req, res) => {
  const empId = req.params.employee_id;
  const sql = `
    SELECT vacation_type, start_date, end_date
    FROM vacations
    WHERE employee_id = ?
    ORDER BY vacation_id DESC
  `;
  db.query(sql, [empId], (err, rows) => {
    if (err) {
      console.error("Ошибка при получении vacations:", err);
      return res.status(500).json({ error: "DB error on SELECT vacations" });
    }
    res.json(rows);
  });
});
app.post("/login", (req, res) => {
  const sentloginUserName = req.body.LoginUserName;
  const sentLoginPassword = req.body.LoginPassword;

  const SQL = "SELECT * FROM employees WHERE first_name = ? && last_name = ?";

  const Values = [sentloginUserName, sentLoginPassword];
  db.query(SQL, Values, (err, results) => {
    if (err) {
      res.send({ error: err });
    }
    if (results.length > 0) {
      res.send(results);
    } else {
      res.send({ message: `не найдено` });
    }
  });
});

// Обновление записи отпуска
app.put("/vacations/:id", (req, res) => {
  const vacationId = req.params.id;
  const { start_date, end_date, vacation_type } = req.body;
  const SQL =
    "UPDATE vacations SET start_date = ?, end_date = ?, vacation_type = ? WHERE vacation_id = ?";
  const values = [start_date, end_date, vacation_type, vacationId];

  db.query(SQL, values, (err, result) => {
    if (err) {
      console.error("Ошибка обновления отпуска:", err);
      return res.status(500).json({ error: "Ошибка обновления отпуска" });
    }
    res.json({ message: "Отпуск обновлен", data: req.body });
  });
});

// Обновление записи смены
app.put("/workschedules/:id", (req, res) => {
  const scheduleId = req.params.id;
  const { working_hours, shift_type } = req.body;
  const SQL =
    "UPDATE workschedules SET working_hours = ?, shift_type = ? WHERE schedule_id = ?";
  const values = [working_hours, shift_type, scheduleId];

  db.query(SQL, values, (err, result) => {
    if (err) {
      console.error("Ошибка обновления смены:", err);
      return res.status(500).json({ error: "Ошибка обновления смены" });
    }
    res.json({ message: "Смена обновлена", data: req.body });
  });
});

// Обновление записи отдела
app.put("/departments/:id", (req, res) => {
  const departmentId = req.params.id;
  const { department_name } = req.body;
  console.log("Подключение к БД использует базу:", db.config.database);
  db.query(
    "SELECT * FROM departments WHERE department_id = ?",
    [departmentId],
    (err, rows) => {
      if (err) console.error("Ошибка SELECT перед UPDATE:", err);
      else console.log("Существующая запись перед UPDATE:", rows);

      // Теперь сам UPDATE
      db.query(
        "UPDATE departments SET department_name = ? WHERE department_id = ?",
        [department_name, departmentId],
        (err2, result) => {
          if (err2) {
            console.error("Ошибка обновления отдела:", err2);
            return res.status(500).json({ error: "Ошибка обновления отдела" });
          }

          console.log("UPDATE result:", result);

          // Теперь проверим после
          db.query(
            "SELECT * FROM departments WHERE department_id = ?",
            [departmentId],
            (err3, rowsAfter) => {
              if (err3) console.error("Ошибка SELECT после UPDATE:", err3);
              else console.log("Запись после UPDATE:", rowsAfter);
              res.json({ message: "Отдел обновлен", data: req.body });
            }
          );
        }
      );
    }
  );
});

// Обновление записи отчёта
app.put("/reports/:id", (req, res) => {
  const reportId = req.params.id;
  const { report_description, report_date, report_data } = req.body;
  const SQL =
    "UPDATE reports SET report_description = ?, report_date = ?, report_data = ? WHERE report_id = ?";
  const values = [report_description, report_date, report_data, reportId];

  db.query(SQL, values, (err, result) => {
    if (err) {
      console.error("Ошибка обновления отчёта:", err);
      return res.status(500).json({ error: "Ошибка обновления отчёта" });
    }
    res.json({ message: "Отчёт обновлен", data: req.body });
  });
});

// ваш файл server.js или index.js
app.put("/employees/:id", (req, res) => {
  const employeeId = req.params.id;
  const updateData = req.body; // { first_name, last_name, ..., qualification, salary }

  // 1) Обновляем только поля employees
  const SQL_UPDATE = `
    UPDATE employees
    SET first_name = ?, last_name = ?, email = ?,
        phone_number = ?, hire_date = ?, job_title = ?,
        qualification = ?, salary = ?
    WHERE employee_id = ?
  `;
  const values = [
    updateData.first_name,
    updateData.last_name,
    updateData.email,
    updateData.phone_number,
    updateData.hire_date,
    updateData.job_title,
    updateData.qualification,
    updateData.salary,
    employeeId,
  ];

  db.query(SQL_UPDATE, values, (err, result) => {
    if (err) {
      console.error("Ошибка при обновлении сотрудника:", err);
      return res
        .status(500)
        .json({ error: "Ошибка при обновлении сотрудника" });
    }

    // 2) После успешного UPDATE делаем SELECT для получения полной записи
    const SQL_SELECT = `
      SELECT e.*, d.department_name
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.department_id
      WHERE e.employee_id = ?
    `;
    db.query(SQL_SELECT, [employeeId], (err2, rows) => {
      if (err2) {
        console.error("Ошибка при получении обновлённых данных:", err2);
        return res.status(500).json({ error: "Ошибка при получении данных" });
      }
      res.json({ message: "Сотрудник обновлён", data: rows[0] });
    });
  });
});

// Приём нового заявления
// 1) POST /mails — сохраняем заявление, а затем уведомляем директора
// Приём нового заявления
app.post("/mails", (req, res) => {
  const { employee_id, subject, start_date, end_date, reason } = req.body;
  const insertSQL = `
    INSERT INTO mails (employee_id, subject, start_date, end_date, reason)
    VALUES (?, ?, ?, ?, ?)
  `;
  db.query(
    insertSQL,
    [employee_id, subject, start_date, end_date, reason],
    (err, result) => {
      if (err) {
        console.error("Ошибка вставки заявления:", err);
        return res.status(500).json({ error: "DB insert error" });
      }

      const newMailId = result.insertId;

      // === 1.1) Уведомляем директора о новом заявлении ===
      // Предположим, что директор у нас в БД – employee_id = 10. Например:
      const ADMIN_EMPLOYEE_ID = 10;

      const fetchAdminChatIdSql = `
      SELECT telegram_chat_id
      FROM telegram_links
      WHERE employee_id = ?
    `;
      db.query(
        fetchAdminChatIdSql,
        [ADMIN_EMPLOYEE_ID],
        (errLink, rowsLink) => {
          if (errLink) {
            console.error(
              "Ошибка при получении telegram_chat_id директора:",
              errLink
            );
          } else if (rowsLink.length) {
            const adminChatId = rowsLink[0].telegram_chat_id;
            const text =
              `📬 <b>Новое заявление #${newMailId}</b>\n` +
              `От сотрудника (ID ${employee_id})\n` +
              `Тема: ${subject}\n` +
              `Период: ${start_date} — ${end_date}\n` +
              `Причина: ${reason}`;
            sendTelegramMessage(adminChatId, text);
          }
        }
      );

      // === 1.2) Отправляем клиенту ответ с созданным ID ===
      res.json({
        id: newMailId,
        employee_id,
        subject,
        start_date,
        end_date,
        reason,
      });
    }
  );
});

// И, разумеется, существующий GET /mails оставляем, чтобы фронт мог их получать
app.get("/mails", (req, res) => {
  const sql = `
    SELECT 
      m.id,
      m.subject,
      m.start_date,
      m.end_date,
      m.reason,
      m.admin_comment,
      m.mail_status,
      e.first_name,
      e.last_name
    FROM mails AS m
    JOIN employees AS e ON m.employee_id = e.employee_id
    WHERE m.mail_status = 'pending'
    ORDER BY m.created_at DESC
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err });
    // Собираем поле employeeName
    const mails = results.map((row) => ({
      id: row.id,
      subject: row.subject,
      start_date: row.start_date,
      end_date: row.end_date,
      reason: row.reason,
      admin_comment: row.admin_comment,
      mail_status: row.mail_status,
      employeeName: `${row.first_name} ${row.last_name}`,
    }));
    res.json(mails);
  });
});

// вернуть все заявления данного сотрудника
// И поправим главный GET, чтобы не возвращать уже прочитанные:
// вернуть только непомеченные как прочитанные заявления данного сотрудника
app.get("/mails/employee/:id", (req, res) => {
  const empId = req.params.id;
  const sql = `
    SELECT 
      m.id,
      m.subject,
      m.start_date,
      m.end_date,
      m.reason,
      m.admin_comment,
      m.mail_status
    FROM mails AS m
    WHERE m.employee_id = ?
      AND m.mail_status <> 'read'
    ORDER BY m.created_at DESC
  `;
  db.query(sql, [empId], (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json(results);
  });
});

// PUT /mails/:id/approve — та же логика + уведомляем автора
app.put("/mails/:id/approve", (req, res) => {
  const mailId = req.params.id;
  const { adminComment } = req.body;

  // 1) Получаем заявку
  db.query(`SELECT * FROM mails WHERE id = ?`, [mailId], (err, mailRows) => {
    if (err) {
      console.error("Ошибка при получении заявки:", err);
      return res.status(500).json({ error: "DB error on SELECT mail" });
    }
    if (!mailRows.length)
      return res.status(404).json({ error: "Mail not found" });

    const mail = mailRows[0];
    const empId = mail.employee_id;
    const { subject: vacationType, start_date, end_date } = mail;

    // считаем часы
    const start = new Date(start_date);
    const end = new Date(end_date);
    const days = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
    const hoursToDeduct = days * 4.5;

    // 2) Снимаем часы из workschedules
    db.query(
      `UPDATE workschedules SET working_hours = working_hours - ? WHERE employee_id = ?`,
      [hoursToDeduct, empId],
      (err2) => {
        if (err2) {
          console.error(err2);
          return res
            .status(500)
            .json({ error: "Failed to update employee hours" });
        }

        // 3) Обновляем time_deductions (не трогаем)
        const ym = `${start.getFullYear()}-${String(
          start.getMonth() + 1
        ).padStart(2, "0")}`;
        db.query(
          `
            INSERT INTO time_deductions
              (employee_id, time_year_month, hours_used, hours_remaining)
            VALUES
              (?, ?, ?, GREATEST(135 - ?, 0))
            ON DUPLICATE KEY UPDATE
              hours_used      = hours_used + ?,
              hours_remaining = hours_remaining - ?
          `,
          [
            empId,
            ym,
            hoursToDeduct,
            hoursToDeduct,
            hoursToDeduct,
            hoursToDeduct,
          ],
          (err3) => {
            if (err3) {
              console.error(err3);
              return res
                .status(500)
                .json({ error: "Failed to upsert time_deductions" });
            }

            // 4) Обновляем статус самого mail
            db.query(
              `UPDATE mails SET mail_status = 'approved', admin_comment = ? WHERE id = ?`,
              [adminComment, mailId],
              (err4) => {
                if (err4) {
                  console.error(err4);
                  return res
                    .status(500)
                    .json({ error: "Failed to update mail status" });
                }

                // 5) Вставляем новую запись в vacations без is_paid
                db.query(
                  `INSERT INTO vacations (employee_id, vacation_type, start_date, end_date)
                   VALUES (?, ?, ?, ?)`,
                  [empId, vacationType, start_date, end_date],
                  (errV) => {
                    if (errV)
                      console.error("Ошибка при вставке vacations:", errV);
                    // даже если тут ошибка — продолжаем
                  }
                );

                // 6) Уведомляем сотрудника в Telegram
                db.query(
                  `SELECT telegram_chat_id FROM telegram_links WHERE employee_id = ?`,
                  [empId],
                  (errLink, rowsLink) => {
                    if (errLink) console.error(errLink);
                    else if (rowsLink.length) {
                      const chatId = rowsLink[0].telegram_chat_id;
                      const text =
                        `✅ Ваше заявление #${mailId} одобрено.\n` +
                        `Тип: ${vacationType}\n` +
                        `Период: ${start_date} — ${end_date}\n` +
                        `Комментарий: ${adminComment || "—"}\n` +
                        `Удержано часов: ${hoursToDeduct.toFixed(1)}`;
                      sendTelegramMessage(chatId, text);
                    }
                  }
                );

                // 7) Ответ клиенту
                res.json({
                  message: "Заявление одобрено",
                  mailId,
                  employee_id: empId,
                  hoursDeducted: hoursToDeduct,
                });
              }
            );
          }
        );
      }
    );
  });
});

// PUT /mails/:id/reject — та же логика + уведомляем автора письма
// PUT /mails/:id/reject
app.put("/mails/:id/reject", (req, res) => {
  const mailId = req.params.id;
  const { adminComment } = req.body;

  const updateMailSQL = `
    UPDATE mails
    SET mail_status   = 'rejected',
        admin_comment = ?
    WHERE id = ?
  `;
  db.query(updateMailSQL, [adminComment, mailId], (err) => {
    if (err) {
      console.error("Ошибка при обновлении mail:", err);
      return res.status(500).json({ error: "Failed to update mail status" });
    }

    // === 3.1) Найдём employee_id автора, чтобы отправить уведомление ===
    const getMailSql = `SELECT employee_id FROM mails WHERE id = ?`;
    db.query(getMailSql, [mailId], (err2, rowsMail) => {
      if (err2) {
        console.error("Ошибка при получении письма:", err2);
      } else if (rowsMail.length) {
        const empId = rowsMail[0].employee_id;
        const fetchUserChatIdSql = `
          SELECT telegram_chat_id
          FROM telegram_links
          WHERE employee_id = ?
        `;
        db.query(fetchUserChatIdSql, [empId], (errLink, rowsLink) => {
          if (errLink) {
            console.error(
              "Ошибка при получении telegram_chat_id автора:",
              errLink
            );
          } else if (rowsLink.length) {
            const userChatId = rowsLink[0].telegram_chat_id;
            const text =
              `❌ Ваше заявление #${mailId} было <b>отклонено</b>.\n` +
              `Комментарий администратора: ${adminComment || "—"}`;
            sendTelegramMessage(userChatId, text);
          }
        });
      }
    });

    // === 3.2) Ответ клиенту ===
    res.json({ message: "Заявление отклонено", mailId });
  });
});

// PUT /mails/:id/read
app.put("/mails/:id/read", (req, res) => {
  const mailId = req.params.id;
  const sql = `
    UPDATE mails
    SET mail_status = 'read'
    WHERE id = ?
  `;
  db.query(sql, [mailId], (err, result) => {
    if (err) return res.status(500).json({ error: "DB error" });
    res.json({ message: "Отмечено как прочитанное", mailId });
  });
});

// PUT /mails/:id/read
app.put("/mails/:id/read", (req, res) => {
  const mailId = req.params.id;
  const sql = `
    UPDATE mails
    SET mail_status = 'read'
    WHERE id = ?
  `;
  db.query(sql, [mailId], (err, result) => {
    if (err) return res.status(500).json({ error: "DB error" });
    res.json({ message: "Отмечено как прочитанное", mailId });
  });
});

// DELETE /mails/:id
app.delete("/mails/:id", (req, res) => {
  const mailId = req.params.id;
  const sql = `DELETE FROM mails WHERE id = ?`;
  db.query(sql, [mailId], (err, result) => {
    if (err) return res.status(500).json({ error: "DB delete error" });
    if (result.affectedRows === 0)
      return res.status(404).json({ error: "Mail not found" });
    res.json({ message: "Заявление удалено", mailId });
  });
});

// ------------- СОЗДАТЬ НОВОГО СОТРУДНИКА -------------
app.post("/employees", (req, res) => {
  const {
    first_name,
    last_name,
    email,
    phone_number,
    hire_date,
    job_title,
    qualification,
    salary,
    department_name,
    working_hours,
    shift_type,
  } = req.body;

  if (
    !first_name ||
    !last_name ||
    !email ||
    !hire_date ||
    !department_name ||
    working_hours == null ||
    !shift_type
  ) {
    return res.status(400).json({ error: "Отсутствуют обязательные поля" });
  }

  // 1) ОТДЕЛ: пытаемся получить department_id по имени
  const findDeptSql =
    "SELECT department_id FROM departments WHERE department_name = ?";
  db.query(findDeptSql, [department_name], (deptErr, deptResults) => {
    if (deptErr) {
      console.error("Ошибка при поиске отдела:", deptErr);
      return res.status(500).json({ error: "Ошибка БД (find department)." });
    }

    // Если такой отдел уже есть → deptResults[0].department_id
    if (deptResults.length > 0) {
      const existingDeptId = deptResults[0].department_id;
      insertEmployee(existingDeptId);
    } else {
      // Вставляем новый отдел и забираем его ID
      const insertDeptSql =
        "INSERT INTO departments (department_name) VALUES (?);";
      db.query(insertDeptSql, [department_name], (insDeptErr, insDeptRes) => {
        if (insDeptErr) {
          console.error("Ошибка при вставке нового отдела:", insDeptErr);
          return res
            .status(500)
            .json({ error: "Ошибка БД (insert department)." });
        }
        const newDeptId = insDeptRes.insertId;
        insertEmployee(newDeptId);
      });
    }
  });

  // Функция, которая вставит сотрудника, зная department_id
  function insertEmployee(deptId) {
    const insertEmpSql = `
      INSERT INTO employees 
        (first_name, last_name, email, phone_number, hire_date, job_title, qualification, salary, department_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;

    const empValues = [
      first_name,
      last_name,
      email,
      phone_number || null,
      hire_date,
      job_title || null,
      qualification || null,
      salary || 0,
      deptId,
    ];

    db.query(insertEmpSql, empValues, (insEmpErr, insEmpRes) => {
      if (insEmpErr) {
        console.error("Ошибка при вставке сотрудника:", insEmpErr);
        return res.status(500).json({ error: "Ошибка БД (insert employee)." });
      }

      const newEmployeeId = insEmpRes.insertId;

      // 3) ВСТАВКА В WORKSCHEDULES:
      // Примем, что start_date и end_date совпадают с hire_date
      const insertSchedSql = `
        INSERT INTO workschedules 
          (start_date, end_date, working_hours, shift_type, employee_id)
        VALUES (?, ?, ?, ?, ?);
      `;
      const schedValues = [
        hire_date,
        hire_date,
        working_hours,
        shift_type,
        newEmployeeId,
      ];

      db.query(insertSchedSql, schedValues, (insSchedErr, insSchedRes) => {
        if (insSchedErr) {
          console.error("Ошибка при вставке расписания:", insSchedErr);
          // Если нужно, можно откатить вставку сотрудника, но для простоты вернём ошибку:
          return res
            .status(500)
            .json({ error: "Ошибка БД (insert workschedule)." });
        }

        // 4) Всё успешно, возвращаем данные нового сотрудника (а можно сразу
        // взять их из таблицы SELECT * FROM employees WHERE employee_id = newEmployeeId)
        const selectNewSql = `
          SELECT 
            e.employee_id,
            e.first_name,
            e.last_name,
            e.email,
            e.phone_number,
            e.hire_date,
            e.job_title,
            e.qualification,
            e.salary,
            e.department_id,
            d.department_name,
            w.working_hours,
            w.shift_type
          FROM employees e
          LEFT JOIN departments d ON e.department_id = d.department_id
          LEFT JOIN workschedules w ON e.employee_id = w.employee_id
          WHERE e.employee_id = ?;
        `;
        db.query(selectNewSql, [newEmployeeId], (selErr, selRes) => {
          if (selErr) {
            console.error(
              "Ошибка при получении только что созданного сотрудника:",
              selErr
            );
            return res
              .status(500)
              .json({ error: "Ошибка БД (select new employee)." });
          }
          if (selRes.length === 0) {
            return res
              .status(404)
              .json({ error: "Не удалось найти созданного сотрудника." });
          }
          // Отправляем единственный объект в массиве
          return res.status(201).json(selRes[0]);
        });
      });
    });
  }
});

//удалить сотрудника
app.delete("/employees/:id", (req, res) => {
  const { id } = req.params;
  // 1) Удаляем сначала расписание сотрудника
  const delSched = "DELETE FROM workschedules WHERE employee_id = ?";
  db.query(delSched, [id], (e1, r1) => {
    if (e1) {
      console.error(e1);
      return res.status(500).json({ error: "Ошибка удаления расписания." });
    }
    // 2) Удаляем самого сотрудника
    const delEmp = "DELETE FROM employees WHERE employee_id = ?";
    db.query(delEmp, [id], (e2, r2) => {
      if (e2) {
        console.error(e2);
        return res.status(500).json({ error: "Ошибка удаления сотрудника." });
      }
      return res.status(200).json({ message: "Сотрудник удалён" });
    });
  });
});

// ======== CREATE (POST) REPORT ========
// POST /reports — сохраняем новый отчёт и уведомляем директора
app.post("/reports", (req, res) => {
  const { report_date, report_description, report_data, employee_id } =
    req.body;
  if (!report_date || !report_description || !report_data || !employee_id) {
    return res.status(400).json({ error: "Неполные данные для отчёта" });
  }

  const insertReportSql = `
    INSERT INTO reports (report_date, report_description, report_data, employee_id)
    VALUES (?, ?, ?, ?)
  `;
  db.query(
    insertReportSql,
    [report_date, report_description, report_data, employee_id],
    (err, result) => {
      if (err) {
        console.error("Ошибка при добавлении отчёта:", err);
        return res.status(500).json({ error: "Ошибка при добавлении отчёта" });
      }

      const newReportId = result.insertId;

      // -------------------------------------------------------------
      // 1) После успешного INSERT уведомляем директора
      // -------------------------------------------------------------
      const ADMIN_EMPLOYEE_ID = 10; //айди директора
      const fetchAdminChatSql = `
        SELECT telegram_chat_id
        FROM telegram_links
        WHERE employee_id = ?
      `;
      db.query(fetchAdminChatSql, [ADMIN_EMPLOYEE_ID], (errLink, rowsLink) => {
        if (errLink) {
          console.error(
            "Ошибка при получении telegram_chat_id директора:",
            errLink
          );
        } else if (rowsLink.length) {
          const adminChatId = rowsLink[0].telegram_chat_id;
          const text =
            `📈 <b>Новый отчёт №${newReportId}</b>\n` +
            `От сотрудника (ID ${employee_id})\n` +
            `Дата отчёта: ${report_date}\n` +
            `Описание: ${report_description}\n` +
            `Данные: ${report_data}`;
          sendTelegramMessage(adminChatId, text);
        }
      });

      // -------------------------------------------------------------
      // 2) Возвращаем ответ клиенту
      // -------------------------------------------------------------
      res.status(200).json({
        report_id: newReportId,
        report_date,
        report_description,
        report_data,
        employee_id,
      });
    }
  );
});

app.put("/reports/:id/approve", (req, res) => {
  const reportId = req.params.id;
  const { adminComment } = req.body;

  // 1) Сначала найдём запись, чтобы узнать автора (employee_id)
  const getReportSql = `SELECT employee_id FROM reports WHERE report_id = ?`;
  db.query(getReportSql, [reportId], (errFetch, rowsFetch) => {
    if (errFetch) {
      console.error("Ошибка при получении отчёта:", errFetch);
      return res.status(500).json({ error: "DB error on SELECT report" });
    }
    if (!rowsFetch.length) {
      return res.status(404).json({ error: "Report not found" });
    }

    const empId = rowsFetch[0].employee_id;

    // 2) Обновляем статус отчёта (здесь предполагается, что в таблице reports есть колонки report_status и admin_comment)
    const updateReportSQL = `
      UPDATE reports
      SET report_status = 'approved',
          admin_comment = ?
      WHERE report_id = ?
    `;
    db.query(updateReportSQL, [adminComment, reportId], (errUpdate) => {
      if (errUpdate) {
        console.error("Ошибка при обновлении отчёта:", errUpdate);
        return res
          .status(500)
          .json({ error: "Failed to update report status" });
      }

      // -------------------------------------------------------------
      // 3) Уведомляем автора отчёта в Telegram
      // -------------------------------------------------------------
      const fetchUserChatSql = `
        SELECT telegram_chat_id
        FROM telegram_links
        WHERE employee_id = ?
      `;
      db.query(fetchUserChatSql, [empId], (errLink, rowsLink) => {
        if (errLink) {
          console.error(
            "Ошибка при получении telegram_chat_id автора:",
            errLink
          );
        } else if (rowsLink.length) {
          const userChatId = rowsLink[0].telegram_chat_id;
          const text =
            `✅ Ваш отчёт №${reportId} был <b>одобрен</b>.\n` +
            `Комментарий администратора: ${adminComment || "—"}`;
          sendTelegramMessage(userChatId, text);
        }
      });

      // -------------------------------------------------------------
      // 4) Возвращаем ответ клиенту
      // -------------------------------------------------------------
      res.json({ message: "Отчёт одобрен", reportId, employee_id: empId });
    });
  });
});

app.put("/reports/:id/reject", (req, res) => {
  const reportId = req.params.id;
  const { adminComment } = req.body;

  // 1) Найдём автора (employee_id)
  const getReportSql = `SELECT employee_id FROM reports WHERE report_id = ?`;
  db.query(getReportSql, [reportId], (errFetch, rowsFetch) => {
    if (errFetch) {
      console.error("Ошибка при получении отчёта:", errFetch);
      return res.status(500).json({ error: "DB error on SELECT report" });
    }
    if (!rowsFetch.length) {
      return res.status(404).json({ error: "Report not found" });
    }

    const empId = rowsFetch[0].employee_id;

    // 2) Обновляем статус отчёта
    const updateReportSQL = `
      UPDATE reports
      SET report_status = 'rejected',
          admin_comment = ?
      WHERE report_id = ?
    `;
    db.query(updateReportSQL, [adminComment, reportId], (errUpdate) => {
      if (errUpdate) {
        console.error("Ошибка при обновлении отчёта:", errUpdate);
        return res
          .status(500)
          .json({ error: "Failed to update report status" });
      }

      // -------------------------------------------------------------
      // 3) Уведомляем автора отчёта в Telegram
      // -------------------------------------------------------------
      const fetchUserChatSql = `
        SELECT telegram_chat_id
        FROM telegram_links
        WHERE employee_id = ?
      `;
      db.query(fetchUserChatSql, [empId], (errLink, rowsLink) => {
        if (errLink) {
          console.error(
            "Ошибка при получении telegram_chat_id автора:",
            errLink
          );
        } else if (rowsLink.length) {
          const userChatId = rowsLink[0].telegram_chat_id;
          const text =
            `❌ Ваш отчёт №${reportId} был <b>отклонён</b>.\n` +
            `Комментарий администратора: ${adminComment || "—"}`;
          sendTelegramMessage(userChatId, text);
        }
      });

      // -------------------------------------------------------------
      // 4) Возвращаем ответ клиенту
      // -------------------------------------------------------------
      res.json({ message: "Отчёт отклонён", reportId });
    });
  });
});

// ======== GET ALL REPORTS (для первоначальной загрузки) ========
app.get("/reports", (req, res) => {
  const sql = `
    SELECT 
      r.report_id,
      r.report_date,
      r.report_description,
      r.report_data,
      r.employee_id,
      CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
      r.report_status,
      r.admin_comment
    FROM reports r
    LEFT JOIN employees e ON r.employee_id = e.employee_id
    ORDER BY r.report_date DESC
  `;
  db.query(sql, (err, rows) => {
    if (err) {
      console.error("Ошибка при получении отчётов:", err);
      return res.status(500).json({ error: "Не удалось получить отчёты" });
    }
    res.json(rows);
  });
});

// ======== GET ALL REPORTS (для первоначальной загрузки) ========
app.get("/reports", (req, res) => {
  const sql = `
    SELECT 
      r.report_id,
      r.report_date,
      r.report_description,
      r.report_data,
      r.employee_id,
      CONCAT(e.first_name, ' ', e.last_name) AS employee_name
    FROM reports r
    LEFT JOIN employees e ON r.employee_id = e.employee_id
    ORDER BY r.report_date DESC
  `;
  db.query(sql, (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Не удалось получить отчёты" });
    }
    res.json(rows);
  });
});

// DELETE /reports/:id — удаляет отчёт и уведомляет сотрудника
app.delete("/reports/:id", (req, res) => {
  const reportId = req.params.id;

  // 1) Сначала получаем автора отчёта
  const getSql = `SELECT employee_id FROM reports WHERE report_id = ?`;
  db.query(getSql, [reportId], (err, rows) => {
    if (err) {
      console.error("Ошибка при получении отчёта для удаления:", err);
      return res.status(500).json({ error: "DB error on SELECT report" });
    }
    if (!rows.length) {
      return res.status(404).json({ error: "Report not found" });
    }

    const empId = rows[0].employee_id;

    // 2) Удаляем запись
    const delSql = `DELETE FROM reports WHERE report_id = ?`;
    db.query(delSql, [reportId], (err2, result) => {
      if (err2) {
        console.error("Ошибка при удалении отчёта:", err2);
        return res.status(500).json({ error: "DB delete error" });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Report not found" });
      }

      // 3) Отправляем уведомление сотруднику в Telegram
      const fetchChatSql = `
        SELECT telegram_chat_id
        FROM telegram_links
        WHERE employee_id = ?
      `;
      db.query(fetchChatSql, [empId], (errLink, rowsLink) => {
        if (errLink) {
          console.error(
            "Ошибка при получении telegram_chat_id автора:",
            errLink
          );
        } else if (rowsLink.length) {
          const chatId = rowsLink[0].telegram_chat_id;
          const text = `✅ Ваш отчёт №${reportId} был просмотрен администратором.`;
          sendTelegramMessage(chatId, text);
        }
      });

      // 4) Отправляем ответ клиенту
      res.json({ message: "Отчёт удалён и автор уведомлён", reportId });
    });
  });
});

// PUT /time_deductions/:employee_id
app.put("/time_deductions/:employee_id", (req, res) => {
  const empId = req.params.employee_id;
  // Ждём в теле { hours_remaining: <число> }
  const { hours_remaining } = req.body;
  if (hours_remaining == null) {
    return res.status(400).json({ error: "Не передано hours_remaining" });
  }
  // Считаем, сколько всего часов уже «использовано»:
  const used = 135 - Number(hours_remaining);
  // Формат текущего месяца, например "2025-06"
  const today = new Date();
  const ym = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(
    2,
    "0"
  )}`;

  const sql = `
    INSERT INTO time_deductions
      (employee_id, time_year_month, hours_used, hours_remaining)
    VALUES
      (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      hours_used      = ?,
      hours_remaining = ?
  `;
  const params = [
    empId,
    ym,
    used,
    Number(hours_remaining),
    used,
    Number(hours_remaining),
  ];

  db.query(sql, params, (err) => {
    if (err) {
      console.error("Ошибка при сохранении time_deductions:", err);
      return res
        .status(500)
        .json({ error: "Failed to upsert time_deductions" });
    }
    // Возвращаем свежие данные, чтобы фронт сразу обновил стейт
    res.json({
      message: "time_deductions сохранены",
      employee_id: empId,
      time_year_month: ym,
      hours_used: used,
      hours_remaining: Number(hours_remaining),
    });
  });
});

//for telegramm
// 1) POST /telegram-links
//    Принимает JSON { employee_id, telegram_chat_id }
//    Если запись для этого employee_id уже есть => обновляем telegram_chat_id
//    Иначе — вставляем новую.
app.post("/telegram-links", async (req, res) => {
  const { employee_id, telegram_chat_id } = req.body;

  if (!employee_id || !telegram_chat_id) {
    return res.status(400).json({
      error: "Неверные данные: employee_id или telegram_chat_id отсутствует.",
    });
  }

  // 1) Сначала пытаемся получить реальный numeric chat_id:
  const realChatId = await resolveChatId(telegram_chat_id);
  if (!realChatId) {
    console.warn("resolveChatId вернул null для:", telegram_chat_id);
    return res.status(400).json({
      error:
        "Невозможно получить chat_id у пользователя “" +
        telegram_chat_id +
        "”. Убедитесь, что он нажал /start боту и username введён без ошибок.",
    });
  }

  // 2) Теперь вставляем/обновляем в telegram_links
  const sql = `
    INSERT INTO telegram_links (employee_id, telegram_chat_id)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE
      telegram_chat_id = VALUES(telegram_chat_id),
      updated_at = CURRENT_TIMESTAMP
  `;
  db.query(sql, [employee_id, realChatId], (err, result) => {
    if (err) {
      console.error("Ошибка при вставке/обновлении telegram_links:", err);
      return res
        .status(500)
        .json({ error: "Ошибка БД при upsert telegram_links." });
    }
    res.json({
      message:
        result.affectedRows > 1 ? "Привязка обновлена" : "Привязка создана",
      employee_id,
      telegram_chat_id: realChatId,
    });
  });
});

// 2) GET /telegram-links/:employee_id
//    Возвращает существующую запись, если сотрудник уже привязал Telegram.
//    Пример ответа: { employee_id: 42, telegram_chat_id: "123456789" }
//    Если записи нет — возвращаем 404.
app.get("/telegram-links/:employee_id", (req, res) => {
  const empId = req.params.employee_id;
  const sql = `
    SELECT employee_id, telegram_chat_id
    FROM telegram_links
    WHERE employee_id = ?
  `;
  db.query(sql, [empId], (err, rows) => {
    if (err) {
      console.error("Ошибка при выборе telegram_links:", err);
      return res
        .status(500)
        .json({ error: "DB error on select telegram_links." });
    }
    if (!rows.length) {
      return res.json({ employee_id: empId, telegram_chat_id: null });
    }
    res.json(rows[0]);
  });
});

// 3) DELETE /telegram-links/:employee_id
//    Удаляет существующую ассоциацию (отвязывает Telegram-чат).
app.delete("/telegram-links/:employee_id", (req, res) => {
  const empId = req.params.employee_id;
  const sql = `
    DELETE FROM telegram_links
    WHERE employee_id = ?
  `;
  db.query(sql, [empId], (err, result) => {
    if (err) {
      console.error("Ошибка при удалении telegram_links:", err);
      return res
        .status(500)
        .json({ error: "DB error on delete telegram_links." });
    }
    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ error: "Связь не найдена, нечего удалять." });
    }
    res.json({ message: "Связь удалена", employee_id: empId });
  });
});

app.listen(process.env.PORT || 3002, "127.0.0.1", async () => {
  console.log("Server is working on 3002 port");

  // Явный запуск поллинга
  try {
    const { startPolling } = require("./telegram-handler");
    startPolling();
    console.log("Telegram polling явно запущен");
  } catch (e) {
    console.error("Ошибка запуска Telegram polling:", e);
  }
});
