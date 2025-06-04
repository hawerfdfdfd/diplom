// WorkerPage.jsx
import { useState, useEffect, useCallback } from "react";
import { useLocation, Link } from "react-router-dom";
import { FaPaperPlane, FaArrowUp, FaFileAlt } from "react-icons/fa";
import Axios from "axios";
import userImg from "../../WorkerAssets/user.png";

export default function WorkerPage() {
  const location = useLocation();
  // При логине мы передали userInfo, но сами часы будем подгружать «свежие»
  const userInfo = location.state?.userInfo || null;

  const [slide, setSlide] = useState(0);
  const [subject, setSubject] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);

  const [myMails, setMyMails] = useState([]);
  const [removingId, setRemovingId] = useState(null);

  // Новый state, чтобы хранить актуальную информацию о сотруднике (включая hours_remaining)
  const [employeeData, setEmployeeData] = useState(null);

  // Если userInfo нет (залогинен не по ссылке), просто показываем «Нет данных»
  if (!userInfo) return <div className="workerPage">Нет данных</div>;
  // Из userInfo достаём только ID, а все остальное подгружаем со свежими часами
  const u = userInfo[0];
  const empId = u.employee_id;

  // 1) Загрузка «свежих» данных сотрудника (в том числе hours_remaining)
  const fetchEmployeeData = useCallback(() => {
    Axios.get(`http://localhost:3002/employees/${empId}`)
      .then(({ data }) => {
        setEmployeeData(data);
      })
      .catch((err) => {
        console.error("Ошибка при загрузке профиля:", err);
      });
  }, [empId]);

  // 2) Загрузка списка заявлений
  const fetchMyMails = useCallback(() => {
    Axios.get(`http://localhost:3002/mails/employee/${empId}`)
      .then(({ data }) => setMyMails(data))
      .catch(console.error);
  }, [empId]);

  useEffect(() => {
    // При монтировании сразу подгружаем профиль и список заявлений
    fetchEmployeeData();
    fetchMyMails();
    // Блокируем прокрутку body, пока открыт этот экран
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [fetchEmployeeData, fetchMyMails]);

  // После отправки нового заявления или после одобрения в мэйл-детале
  // будем сбрасывать submitResult, чтобы перезагрузить заново список заявлений
  useEffect(() => {
    if (submitResult !== null) {
      fetchMyMails();
      fetchEmployeeData(); // пересчитаем часы сразу после отправки/одобрения
    }
  }, [fetchMyMails, fetchEmployeeData, submitResult]);

  // Если ещё не загрузились актуальные данные: показываем пока простой «Загрузка…»
  if (!employeeData)
    return (
      <div className="workerPage">
        <div className="loading">Загрузка профиля…</div>
      </div>
    );

  // Для удобства назовём переменную `e`:
  const e = employeeData;

  // Отправка заявления (слайд 1)
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
      // возвращаемся к карточке профиля
      setSlide(0);
    } catch {
      setSubmitResult("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Отправка отчёта (слайд 2)
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
      // после отправки отчёта возвращаемся к карточке профиля
      setSlide(0);
    } catch (error) {
      console.error("Ошибка при отправке отчёта:", error);
      alert("❌ Ошибка при отправке отчёта. Попробуйте снова.");
    }
  };

  // Перевод статуса заявления на русский
  const translateStatus = (status) => {
    if (status === "approved") return "Принято";
    if (status === "rejected") return "Отклонено";
    return "В ожидании";
  };

  // Удаление («прочитано») заявления
  const markRead = async (id) => {
    const el = document.getElementById(`mail-${id}`);
    if (!el) return;

    // Для плавного сворачивания вычисляем текущую высоту и задаём её как inline max-height
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

      {/* Оверлей уведомления при отправке/результате */}
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

      {/* ======================================
            Колонка с тремя «слайдами»
         ====================================== */}
      <div
        className="slides"
        style={{ transform: `translateY(-${slide * 100}vh)` }}
      >
        {/* ------------------------------------------------------
            Слайд 0: Профиль + список моих заявлений + иконки
            ------------------------------------------------------ */}
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
                {/* Здесь показываем «Оставшиеся часы» */}
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

            {/* Иконки с якорями для перехода к формам */}
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

        {/* ------------------------------------------------------
            Слайд 1: Форма “Отправить заявление”
            ------------------------------------------------------ */}
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

        {/* ------------------------------------------------------
            Слайд 2: Форма “Добавить отчёт”
            ------------------------------------------------------ */}
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

      {/* Кнопка «Выйти» внизу */}
      <div className="workerDownButton">
        <Link to="/" className="btn">
          Выйти
        </Link>
      </div>
    </div>
  );
}
