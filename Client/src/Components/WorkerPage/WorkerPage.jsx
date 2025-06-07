// WorkerPage.jsx
import { useState, useEffect, useCallback } from "react";
import { useLocation, Link } from "react-router-dom";
import {
  FaPaperPlane,
  FaArrowUp,
  FaFileAlt,
  FaTelegramPlane,
} from "react-icons/fa";
import Axios from "axios";
import userImg from "../../WorkerAssets/user.png";

export default function WorkerPage() {
  const location = useLocation();
  // При логине мы передали userInfo, но сами часы будем подгружать «свежие»
  const userInfo = location.state?.userInfo || null;

  // Состояния для слайдов, формы заявления/отчёта
  const [slide, setSlide] = useState(0);
  const [subject, setSubject] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);

  const [myMails, setMyMails] = useState([]);
  const [removingId, setRemovingId] = useState(null);

  // Актуальные данные профиля, включая hours_remaining
  const [employeeData, setEmployeeData] = useState(null);

  // ===== Состояния для Telegram-привязки =====
  const [telegramChatId, setTelegramChatId] = useState(""); // реальный numeric chat_id, если уже привязан
  const [isLinkLoading, setIsLinkLoading] = useState(true); // флаг во время GET-запроса
  const [showTelegramModal, setShowTelegramModal] = useState(false); // показывать инструкцию
  const [bindingInProgress, setBindingInProgress] = useState(false); // флаг «сохраняем…»
  const [newChatIdInput, setNewChatIdInput] = useState(""); // поле для ввода username или ID

  // Если userInfo нет (неавторизован) — показываем заглушку
  if (!userInfo) return <div className="workerPage">Нет данных</div>;

  const u = userInfo[0];
  const empId = u.employee_id;

  // ===== После загрузки userInfo пытаемся получить существующую связь =====
  useEffect(() => {
    if (!userInfo) return;
    Axios.get(`http://localhost:3002/telegram-links/${empId}`)
      .then(({ data }) => {
        setTelegramChatId(data.telegram_chat_id);
      })
      .catch((err) => {
        // если 404 — просто оставляем пустую строку
        if (err.response?.status !== 404) {
          console.error("Ошибка при получении Telegram-связи:", err);
        }
      })
      .finally(() => {
        setIsLinkLoading(false);
      });
  }, [userInfo, empId]);

  const openTelegramModal = () => setShowTelegramModal(true);
  const closeTelegramModal = () => {
    setNewChatIdInput("");
    setBindingInProgress(false);
    setShowTelegramModal(false);
  };

  // POST /telegram-links  — сохраняем или обновляем связь
  const handleLinkTelegram = async () => {
    if (!userInfo) return;
    try {
      setBindingInProgress(true);
      await Axios.post("http://localhost:3002/telegram-links", {
        employee_id: empId,
        telegram_chat_id: newChatIdInput.trim(),
      });
      // После успеха:
      setTelegramChatId(newChatIdInput.trim());
      setNewChatIdInput("");
      closeTelegramModal();
      alert("Telegram успешно привязан!");
    } catch (err) {
      console.error("Ошибка привязки Telegram:", err);
      alert("Не удалось привязать Telegram. Попробуйте снова.");
      setBindingInProgress(false);
    }
  };

  // DELETE /telegram-links/:employee_id  — отвязка
  const handleUnlinkTelegram = async () => {
    if (!userInfo) return;
    if (!window.confirm("Вы уверены, что хотите отвязать Telegram?")) {
      return;
    }
    try {
      await Axios.delete(`http://localhost:3002/telegram-links/${empId}`);
      setTelegramChatId("");
      alert("Telegram отвязан.");
    } catch (err) {
      console.error("Ошибка отвязки Telegram:", err);
      alert("Не удалось отвязать. Попробуйте снова.");
    }
  };

  // ===== Загрузка профиля + часов =====
  const fetchEmployeeData = useCallback(() => {
    Axios.get(`http://localhost:3002/employees/${empId}`)
      .then(({ data }) => {
        setEmployeeData(data);
      })
      .catch((err) => {
        console.error("Ошибка при загрузке профиля:", err);
      });
  }, [empId]);

  // ===== Загрузка списка заявлений =====
  const fetchMyMails = useCallback(() => {
    Axios.get(`http://localhost:3002/mails/employee/${empId}`)
      .then(({ data }) => setMyMails(data))
      .catch(console.error);
  }, [empId]);

  useEffect(() => {
    fetchEmployeeData();
    fetchMyMails();
    // Блокируем прокрутку body, пока открыт рабочий экран
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [fetchEmployeeData, fetchMyMails]);

  // После отправки или изменения состояния заявлений — перезагружаем списки
  useEffect(() => {
    if (submitResult !== null) {
      fetchMyMails();
      fetchEmployeeData();
    }
  }, [submitResult, fetchMyMails, fetchEmployeeData]);

  // Пока профиль ещё не загрузился
  if (!employeeData) {
    return (
      <div className="workerPage">
        <div className="loading">Загрузка профиля…</div>
      </div>
    );
  }

  const e = employeeData;

  // === Обработчик отправки заявления ===
  const handleSubmit = async (evt) => {
    evt.preventDefault();
    setIsSubmitting(true);
    setSubmitResult(null);
    try {
      await Axios.post("http://localhost:3002/mails", {
        employee_id: empId,
        subject,
        start_date: startDate,
        end_date: endDate,
        reason,
      });
      setSubmitResult("success");
      setSubject("");
      setStartDate("");
      setEndDate("");
      setReason("");
      setSlide(0);
    } catch {
      setSubmitResult("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // === Обработчик отправки отчёта ===
  const handleReportSubmit = async (evt) => {
    evt.preventDefault();
    const formData = new FormData(evt.target);
    const reportData = Object.fromEntries(formData.entries());

    try {
      await Axios.post("http://localhost:3002/reports", {
        employee_id: empId,
        ...reportData,
      });
      alert("✅ Отчёт успешно отправлен!");
      evt.target.reset();
      setSlide(0);
    } catch (error) {
      console.error("Ошибка при отправке отчёта:", error);
      alert("❌ Ошибка при отправке отчёта. Попробуйте снова.");
    }
  };

  // === Помощник для перевода статуса ===
  const translateStatus = (status) => {
    if (status === "approved") return "Принято";
    if (status === "rejected") return "Отклонено";
    return "В ожидании";
  };

  // === Удаление (отметка «прочитано») ===
  const markRead = async (id) => {
    const el = document.getElementById(`mail-${id}`);
    if (!el) return;
    const height = el.scrollHeight;
    el.style.maxHeight = `${height}px`;

    requestAnimationFrame(() => {
      setRemovingId(id);
    });

    try {
      await Axios.delete(`http://localhost:3002/mails/${id}`);
      setTimeout(() => {
        setMyMails((prev) => prev.filter((m) => m.id !== id));
        el.style.maxHeight = "";
      }, 400);
    } catch (err) {
      console.error(err);
      setRemovingId(null);
      el.style.maxHeight = "";
    }
  };

  return (
    <div className="workerPage">
      <div className="background">
        <div className="stars">
          <div id="stars" />
          <div id="stars2" />
          <div id="stars3" />
        </div>
      </div>

      {/* Пока идёт загрузка состояния привязки */}
      {isLinkLoading && (
        <div className="telegram-loading">Загрузка привязки Telegram…</div>
      )}

      {/* ======== Кнопка «Telegram» ======== */}
      {!isLinkLoading && (
        <div className="telegram-link-wrapper">
          {telegramChatId ? (
            <>
              <span className="telegram-bound-info">
                📲 Привязан: <b>{telegramChatId}</b>
              </span>
              <button
                className="unlink-btn"
                onClick={handleUnlinkTelegram}
                title="Отвязать Telegram"
              >
                Отвязать
              </button>
            </>
          ) : (
            <button
              className="link-btn"
              onClick={openTelegramModal}
              title="Привязать Telegram"
            >
              <FaTelegramPlane size={24} />
              <span className="link-label">Привязать Telegram</span>
            </button>
          )}
        </div>
      )}

      {/* ======== Модалка-инструкция «Как привязать Telegram» ======== */}
      {showTelegramModal && (
        <div className="telegram-form-overlay" onClick={closeTelegramModal}>
          <div
            className="telegram-form-card"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Как привязать Telegram-аккаунт</h3>
            <ol className="telegram-instructions">
              <li>
                Откройте в <strong>Telegram</strong> бота{" "}
                <code>@diplomNotification_bot</code> (или перейдите по ссылке{" "}
                <a
                  href="https://t.me/diplomNotification_bot"
                  target="_blank"
                  rel="noreferrer"
                >
                  t.me/diplomNotification_bot
                </a>
                ).
              </li>
              <li>
                Нажмите кнопку <code>/start</code> в чате с ботом. Это нужно,
                чтобы бот «узнал» ваш чат и разрешил отправлять вам сообщения.
              </li>
              <li>
                Дальше напишите <strong>/bind</strong> и почту которую указывали
                при трудоустройстве.
              </li>
              <li>Если все хорошо вам напишет что привязка завершена.</li>
              <li>Обновите страницу.</li>
            </ol>
            <div className="form-group"></div>
            <div className="telegram-form-buttons">
              <button
                className="btn cancel"
                onClick={closeTelegramModal}
                disabled={bindingInProgress}
              >
                Отмена
              </button>
            </div>
            {bindingInProgress && (
              <div className="telegram-loading">…Сохраняем…</div>
            )}
          </div>
        </div>
      )}

      {/* ======== Оверлей уведомления по результату отправки заявления ======== */}
      {(isSubmitting || submitResult) && (
        <div className="notify-overlay">
          <div className="notify-card">
            {isSubmitting && <p>Отправляем заявление...</p>}
            {submitResult === "success" && <p>✅ Заявление отправлено!</p>}
            {submitResult === "error" && <p>❌ Ошибка при отправке.</p>}
            {submitResult && (
              <button
                className="btn"
                onClick={() => {
                  setSubmitResult(null);
                  setSlide(0);
                }}
              >
                ОК
              </button>
            )}
          </div>
        </div>
      )}

      {/* ======== Слайды: Профиль, Заявка, Отчёт ======== */}
      <div
        className="slides"
        style={{ transform: `translateY(-${slide * 100}vh)` }}
      >
        {/* ------------- Слайд 0: Профиль + мои заявления + иконки ------------- */}
        <section className="halfSection top">
          <div className="workerUpInfo">
            <div className="workerImgInfo">
              <img src={userImg} alt="user" />
            </div>
            <div className="workerMainInfo">
              <ul>
                <li>Имя: {e.first_name}</li>
                <li>Фамилия: {e.last_name}</li>
                <li>Почта: {e.email}</li>
                <li>Телефон: {e.phone_number}</li>
                <li>
                  Начало работы: {e.hire_date.match(/\d{4}-\d{2}-\d{2}/)[0]}
                </li>
                <li>Должность: {e.job_title}</li>
                <li>Квалификация: {e.qualification}</li>
                <li>Зарплата: {e.salary}</li>
                <li>
                  Оставшиеся часы в этом месяце:{" "}
                  <strong>{e.hours_remaining}</strong>
                </li>
              </ul>
            </div>

            <div className="my-mails">
              <h3>Мои заявления</h3>
              {myMails.length ? (
                <ul className="my-mails-list">
                  {myMails.map((m) => (
                    <li
                      id={`mail-${m.id}`}
                      key={m.id}
                      className={`my-mail-card ${
                        removingId === m.id ? "removing" : ""
                      }`}
                    >
                      <button
                        className="mark-read-btn"
                        onClick={() => markRead(m.id)}
                        title="Отметить как прочитанное"
                      >
                        ✓
                      </button>
                      <div>
                        <strong>Тема:</strong> {m.subject}
                      </div>
                      <div>
                        <strong>Период:</strong>{" "}
                        {m.start_date.match(/\d{4}-\d{2}-\d{2}/)[0]} —{" "}
                        {m.end_date.match(/\d{4}-\d{2}-\d{2}/)[0]}
                      </div>
                      <div>
                        <strong>Статус:</strong>{" "}
                        {translateStatus(m.mail_status)}
                      </div>
                      {m.admin_comment && (
                        <div className="admin-comment">
                          <strong>Комментарий:</strong> {m.admin_comment}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Заявлений нет.</p>
              )}
            </div>

            {/* Якоря для перехода к формам */}
            <div
              className="anchorIcon mail-icon"
              onClick={() => setSlide(1)}
              title="Отправить заявление"
            >
              <FaPaperPlane size={24} />
            </div>
            <div
              className="anchorIcon report-icon"
              onClick={() => setSlide(2)}
              title="Добавить отчёт"
            >
              <FaFileAlt size={24} />
            </div>
          </div>
        </section>

        {/* ------------- Слайд 1: Форма «Отправить заявление» ------------- */}
        <section className="halfSection bottom">
          <div className="requestForm">
            <h2>Заявка сотрудника</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Тема заявления</label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                >
                  <option value="">Выберите тему</option>
                  <option>Отпуск</option>
                  <option>Отгул</option>
                  <option>Больничный</option>
                </select>
              </div>
              <div className="form-group dates">
                <div>
                  <label>С</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label>По</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Причина</label>
                <textarea
                  rows="4"
                  placeholder="Опишите..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                />
              </div>
              <div className="form-buttons">
                <button type="submit" className="btn">
                  Отправить заявление
                </button>
              </div>
            </form>
            <div
              className="anchorIcon"
              onClick={() => setSlide(0)}
              title="Вернуться к профилю"
            >
              <FaArrowUp size={24} />
            </div>
          </div>
        </section>

        {/* ------------- Слайд 2: Форма «Добавить отчёт» ------------- */}
        <section className="halfSection report-section">
          <div className="requestForm">
            <h2>Добавить отчёт</h2>
            <form onSubmit={handleReportSubmit}>
              <div className="form-group">
                <label>Дата отчёта</label>
                <input type="date" name="report_date" required />
              </div>
              <div className="form-group">
                <label>Описание</label>
                <textarea
                  name="report_description"
                  rows="3"
                  placeholder="Краткое описание"
                  required
                />
              </div>
              <div className="form-group">
                <label>Данные отчёта</label>
                <input
                  type="text"
                  name="report_data"
                  placeholder="Например, 12345"
                  required
                />
              </div>
              <div className="form-group">
                <label>Комментарий</label>
                <textarea
                  name="report_notes"
                  rows="2"
                  placeholder="Доп. комментарии (необязательно)"
                />
              </div>
              <div className="form-buttons">
                <button type="submit" className="btn">
                  Отправить отчёт
                </button>
              </div>
            </form>
            <div
              className="anchorIcon"
              onClick={() => setSlide(0)}
              title="Вернуться к профилю"
            >
              <FaArrowUp size={24} />
            </div>
          </div>
        </section>
      </div>

      {/* Кнопка «Выйти» */}
      <div className="workerDownButton">
        <Link to="/" className="btn">
          Выйти
        </Link>
      </div>
    </div>
  );
}
