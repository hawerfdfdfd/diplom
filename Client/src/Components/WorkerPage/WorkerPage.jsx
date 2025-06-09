// src/components/WorkerPage.jsx
import { useState, useEffect, useCallback } from "react";
import { useLocation, Link } from "react-router-dom";
import {
  FaUserAlt,
  FaPaperPlane, // заявка
  FaFileAlt, // отчёт
  FaInfoCircle, // Telegram-инструкция
  FaTrashAlt,
  FaSignOutAlt,
  FaCheck,
} from "react-icons/fa";
import Axios from "axios";
import userImg from "../../WorkerAssets/user.png";

export default function WorkerPage() {
  const location = useLocation();
  const userInfo = location.state?.userInfo?.[0] || null;

  const [view, setView] = useState("profile");
  const [employee, setEmployee] = useState(null);
  const [mails, setMails] = useState([]);
  const [removingId, setRemovingId] = useState(null);
  const [form, setForm] = useState({
    subject: "",
    start: "",
    end: "",
    reason: "",
  });
  const [report, setReport] = useState({
    report_date: "",
    report_description: "",
    report_data: "",
    report_notes: "",
  });
  const [telegramId, setTelegramId] = useState("");
  const [loading, setLoading] = useState({ profile: true, telegram: true });

  const empId = userInfo?.employee_id;

  const fetchProfile = useCallback(() => {
    if (!empId) return;
    Axios.get(`http://localhost:3002/employees/${empId}`)
      .then((r) => setEmployee(r.data))
      .finally(() => setLoading((l) => ({ ...l, profile: false })));
  }, [empId]);

  const fetchMails = useCallback(() => {
    if (!empId) return;
    Axios.get(`http://localhost:3002/mails/employee/${empId}`).then((r) =>
      setMails(Array.isArray(r.data) ? r.data : [])
    );
  }, [empId]);

  const fetchTelegram = useCallback(() => {
    if (!empId) return;
    Axios.get(`http://localhost:3002/telegram-links/${empId}`)
      .then((r) => setTelegramId(r.data.telegram_chat_id || ""))
      .catch(() => setTelegramId(""))
      .finally(() => setLoading((l) => ({ ...l, telegram: false })));
  }, [empId]);

  useEffect(() => {
    fetchProfile();
    fetchMails();
    fetchTelegram();
    document.body.style.overflow = "hidden";
    return () => (document.body.style.overflow = "");
  }, [fetchProfile, fetchMails, fetchTelegram]);

  const translate = (s) =>
    s === "approved"
      ? "Принято"
      : s === "rejected"
      ? "Отклонено"
      : "В ожидании";

  const handleForm = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  const handleReport = (e) =>
    setReport((r) => ({ ...r, [e.target.name]: e.target.value }));

  const submitRequest = (e) => {
    e.preventDefault();
    Axios.post("http://localhost:3002/mails", {
      employee_id: empId,
      subject: form.subject,
      start_date: form.start,
      end_date: form.end,
      reason: form.reason,
    })
      .then(() => {
        setForm({ subject: "", start: "", end: "", reason: "" });
        fetchMails();
        setView("profile");
      })
      .catch(console.error);
  };

  const submitReport = (e) => {
    e.preventDefault();
    Axios.post("http://localhost:3002/reports", {
      employee_id: empId,
      report_date: report.report_date,
      report_description: report.report_description,
      report_data: report.report_data,
      report_notes: report.report_notes,
    })
      .then(() => {
        setReport({
          report_date: "",
          report_description: "",
          report_data: "",
          report_notes: "",
        });
        setView("profile");
      })
      .catch(console.error);
  };

  const markRead = async (id) => {
    setRemovingId(id);
    try {
      await Axios.delete(`http://localhost:3002/mails/${id}`);
      setMails((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      console.error(err);
    } finally {
      setRemovingId(null);
    }
  };

  const unbindTelegram = () => {
    if (window.confirm("Вы уверены, что хотите отвязать Telegram?")) {
      Axios.delete(`http://localhost:3002/telegram-links/${empId}`)
        .then(() => setTelegramId(""))
        .catch(console.error);
    }
  };

  if (!userInfo || loading.profile) {
    return (
      <div className="workerPage">
        <div className="spinner" />
      </div>
    );
  }

  const {
    first_name,
    last_name,
    email,
    phone_number,
    hire_date,
    job_title,
    qualification,
    salary,
    hours_remaining,
  } = employee;

  return (
    <div className="workerPage">
      <aside className="sidebar">
        <div className="logo">🌑</div>
        <button
          className={view === "profile" ? "active" : ""}
          onClick={() => setView("profile")}
          title="Профиль"
        >
          <FaUserAlt />
        </button>
        <button
          className={view === "request" ? "active" : ""}
          onClick={() => setView("request")}
          title="Заявка"
        >
          <FaPaperPlane />
        </button>
        <button
          className={view === "report" ? "active" : ""}
          onClick={() => setView("report")}
          title="Отчёт"
        >
          <FaFileAlt />
        </button>
        <button
          className={view === "telegram" ? "active" : ""}
          onClick={() => setView("telegram")}
          title="Telegram"
        >
          <FaInfoCircle />
        </button>
        <Link to="/" className="exit" title="Выйти">
          <FaSignOutAlt />
        </Link>
      </aside>

      <main className="content">
        {view === "profile" && (
          <div className="grid">
            <div className="card profile">
              <img src={userImg} alt="" className="avatar" />
              <h2>
                {first_name} {last_name}
              </h2>
              <ul className="info-list">
                <li>📧 Почта: {email}</li>
                <li>📞 Телефон: {phone_number}</li>
                <li>🗓 Найм: {hire_date.split("T")[0]}</li>
                <li>💼 Должность: {job_title}</li>
                <li>🎓 Квалификация: {qualification}</li>
                <li>💰 Зарплата: {salary} ₽</li>
                <li>⏰ Оставшиеся часы: {hours_remaining}</li>
                {telegramId && <li>📲 Telegram: {telegramId}</li>}
              </ul>
            </div>
            <div className="card mails">
              <h3>Заявления</h3>
              {mails.length > 0 ? (
                mails.map((m) => (
                  <div
                    key={m.id}
                    className={`mail ${removingId === m.id ? "removing" : ""}`}
                  >
                    <div className="mail-header">
                      <span>{m.subject}</span>
                      <span className="status">{translate(m.mail_status)}</span>
                      <button
                        className="delete-btn"
                        onClick={() => markRead(m.id)}
                        title="Удалить"
                      >
                        <FaTrashAlt />
                      </button>
                    </div>
                    <small>
                      {m.start_date.split("T")[0]} → {m.end_date.split("T")[0]}
                    </small>
                    {m.admin_comment && (
                      <div className="admin-comment">💬 {m.admin_comment}</div>
                    )}
                  </div>
                ))
              ) : (
                <p>Нет заявлений</p>
              )}
            </div>
          </div>
        )}

        {view === "request" && (
          <div className="card form">
            <h3>Новая заявка</h3>
            <form onSubmit={submitRequest}>
              <select
                name="subject"
                value={form.subject}
                onChange={handleForm}
                required
              >
                <option value="">Тема</option>
                <option>Отпуск</option>
                <option>Отгул</option>
                <option>Больничный</option>
              </select>
              <div className="dates">
                <input
                  type="date"
                  name="start"
                  value={form.start}
                  onChange={handleForm}
                  required
                />
                <input
                  type="date"
                  name="end"
                  value={form.end}
                  onChange={handleForm}
                  required
                />
              </div>
              <textarea
                name="reason"
                value={form.reason}
                onChange={handleForm}
                rows="4"
                placeholder="Причина"
                required
              />
              <button type="submit">
                <FaCheck /> Отправить
              </button>
            </form>
          </div>
        )}

        {view === "report" && (
          <div className="card form">
            <h3>Добавить отчёт</h3>
            <form onSubmit={submitReport}>
              <input
                type="date"
                name="report_date"
                value={report.report_date}
                onChange={handleReport}
                required
              />
              <textarea
                name="report_description"
                value={report.report_description}
                onChange={handleReport}
                rows="3"
                placeholder="Описание"
                required
              />
              <input
                type="text"
                name="report_data"
                value={report.report_data}
                onChange={handleReport}
                placeholder="Данные"
                required
              />
              <textarea
                name="report_notes"
                value={report.report_notes}
                onChange={handleReport}
                rows="2"
                placeholder="Примечания"
              />
              <button type="submit">
                <FaCheck /> Отправить отчёт
              </button>
            </form>
          </div>
        )}

        {view === "telegram" && (
          <div className="card form">
            {!telegramId ? (
              <>
                <h3>Инструкция по привязке Telegram</h3>
                <ol>
                  <li>
                    Откройте бота <code>@diplomNotification_bot</code>.
                  </li>
                  <li>
                    Нажмите <code>/start</code>, затем <code>/bind</code> и
                    введите почту.
                  </li>
                  <li>Бот подтвердит привязку.</li>
                  <li>Обновите страницу.</li>
                </ol>
              </>
            ) : (
              <>
                <h3>Telegram привязан</h3>
                <p>📲 {telegramId}</p>
                <button className="unlink-btn" onClick={unbindTelegram}>
                  Отвязать Telegram
                </button>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
