// Dashboard.jsx
import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Axios from "axios";
import ReactDOM from "react-dom";
import {
  FaEdit,
  FaSignOutAlt,
  FaEnvelope,
  FaUserPlus,
  FaArrowUp,
  FaTrash,
  FaTelegramPlane,
  FaFileAlt,
} from "react-icons/fa";
import { AnimatePresence } from "framer-motion";

import EmployeeDetail from "./EmployeeDetail";
import MailDetail from "../MailDetail/MailDetail";

export default function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const userInfo = location.state?.userInfo || null;

  // allow only Ольга Никитина
  useEffect(() => {
    if (!userInfo) return navigate("/", { replace: true });
    const u = userInfo[0];
    if (u.first_name !== "Ольга" || u.last_name !== "Никитина") {
      navigate("/", { replace: true });
    }
  }, [userInfo, navigate]);

  // refs
  const headerWrapperRef = useRef(null);
  const cardsContainerRef = useRef(null);

  // state
  const [employees, setEmployees] = useState([]);
  const [mails, setMails] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [workSchedules, setWorkSchedules] = useState([]);
  const [reports, setReports] = useState([]);

  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedMail, setSelectedMail] = useState(null);
  const [slide, setSlide] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [newEmployee, setNewEmployee] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone_number: "",
    hire_date: "",
    job_title: "",
    qualification: "",
    salary: "",
    department_name: "",
    working_hours: "",
    shift_type: "",
  });

  // telegram binding
  const [showTelegramModal, setShowTelegramModal] = useState(false);
  const [telegramChatId, setTelegramChatId] = useState("");
  const [bindingInProgress, setBindingInProgress] = useState(false);
  const [boundChatId, setBoundChatId] = useState(null);
  const [modalState, setModalState] = useState("closed"); // 'closed', 'opening', 'open', 'closing'

  // helpers to fetch
  const fetchEmployees = () =>
    Axios.get("http://localhost:3002/employees")
      .then(({ data }) => data)
      .catch(() => []);
  const fetchWorkSchedules = () =>
    Axios.get("http://localhost:3002/workschedules")
      .then(({ data }) => setWorkSchedules(data))
      .catch(() => {});
  const fetchMails = () =>
    Axios.get("http://localhost:3002/mails")
      .then(({ data }) => setMails(data))
      .catch(() => {});
  const fetchDepartments = () =>
    Axios.get("http://localhost:3002/departments")
      .then(({ data }) => setDepartments(data))
      .catch(() => {});
  const fetchReports = () =>
    Axios.get("http://localhost:3002/reports")
      .then(({ data }) => setReports(data))
      .catch(() => {});

  // load employees + vacations
  const loadEmployeesWithVacations = async () => {
    const emps = await fetchEmployees();
    const empsWithVac = await Promise.all(
      emps.map(async (e) => {
        try {
          const { data: vac } = await Axios.get(
            `http://localhost:3002/vacations/${e.employee_id}`
          );
          return { ...e, vacations: Array.isArray(vac) ? vac : [] };
        } catch {
          return { ...e, vacations: [] };
        }
      })
    );
    setEmployees(empsWithVac);
  };

  // initial load
  useEffect(() => {
    loadEmployeesWithVacations();
    fetchWorkSchedules();
    fetchMails();
    fetchDepartments();
    fetchReports();

    // telegram link
    if (userInfo) {
      const empId = userInfo[0].employee_id;
      Axios.get(`http://localhost:3002/telegram-links/${empId}`)
        .then(({ data }) => setBoundChatId(data.telegram_chat_id))
        .catch(() => {});
    }
  }, [userInfo]);

  // hide header on scroll
  useEffect(() => {
    const cardsEl = cardsContainerRef.current;
    const headerEl = headerWrapperRef.current;
    if (!cardsEl || !headerEl) return;
    let lastScroll = 0;
    function onScroll() {
      const cur = cardsEl.scrollTop;
      if (cur > lastScroll + 10) headerEl.classList.add("scrolled");
      else if (cur < lastScroll - 10) headerEl.classList.remove("scrolled");
      lastScroll = cur;
    }
    cardsEl.addEventListener("scroll", onScroll);
    return () => cardsEl.removeEventListener("scroll", onScroll);
  }, [selectedEmployee]);

  // filtered employees
  const filteredEmployees = employees.filter((emp) =>
    `${emp.first_name} ${emp.last_name}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  // telegram handlers
  const openTelegramModal = () => {
    setShowTelegramModal(true);
    setModalState("opening");

    setTimeout(() => {
      setModalState("open");
    }, 10);
  };

  const closeTelegramModal = () => {
    setModalState("closing");

    setTimeout(() => {
      setShowTelegramModal(false);
      setModalState("closed");
    }, 300);
  };

  const handleBindTelegram = async () => {
    if (!telegramChatId.trim()) return alert("Введите username или chat_id");
    const empId = userInfo[0].employee_id;
    setBindingInProgress(true);
    try {
      const { data } = await Axios.post(
        "http://localhost:3002/telegram-links",
        { employee_id: empId, telegram_chat_id: telegramChatId.trim() }
      );
      setBoundChatId(data.telegram_chat_id);
      closeTelegramModal();
      alert("Telegram успешно привязан!");
    } catch {
      alert("Ошибка привязки Telegram");
      setBindingInProgress(false);
    }
  };

  const handleUnbindTelegram = async () => {
    if (!boundChatId) return;
    const empId = userInfo[0].employee_id;
    if (!window.confirm("Отвязать Telegram?")) return;
    try {
      await Axios.delete(`http://localhost:3002/telegram-links/${empId}`, {
        data: { employee_id: empId },
      });
      setBoundChatId(null);
      alert("Telegram отвязан");
    } catch {
      alert("Ошибка отвязки Telegram");
    }
  };

  // mail decision
  const handleMailDecision = (mailId, mode) => {
    setMails((prev) => prev.filter((m) => m.id !== mailId));
    if (mode === "approve") {
      loadEmployeesWithVacations();
      fetchWorkSchedules();
    }
  };

  // add new employee
  const handleNewChange = (e) => {
    const { name, value } = e.target;
    setNewEmployee((prev) => ({ ...prev, [name]: value }));
  };
  const handleNewSubmit = (e) => {
    e.preventDefault();
    const wh = newEmployee.working_hours
      ? Number(newEmployee.working_hours)
      : null;
    Axios.post("http://localhost:3002/employees", {
      ...newEmployee,
      working_hours: wh,
    })
      .then(({ data }) => data.employee_id || data.insertId)
      .then((newId) => Axios.get(`http://localhost:3002/employees/${newId}`))
      .then(({ data: fullEmp }) => {
        setEmployees((prev) => [fullEmp, ...prev]);
        fetchWorkSchedules();
        setNewEmployee({
          first_name: "",
          last_name: "",
          email: "",
          phone_number: "",
          hire_date: "",
          job_title: "",
          qualification: "",
          salary: "",
          department_name: "",
          working_hours: "",
          shift_type: "",
        });
        setSuccessMessage("Сотрудник успешно создан");
        setSlide(0);
        setTimeout(() => setSuccessMessage(""), 3000);
      })
      .catch(console.error);
  };

  // delete employee
  const handleDeleteEmployee = (employee_id) => {
    if (!window.confirm("Удалить сотрудника?")) return;
    Axios.delete(`http://localhost:3002/employees/${employee_id}`)
      .then(() =>
        setEmployees((prev) =>
          prev.filter((e) => e.employee_id !== employee_id)
        )
      )
      .then(() => {
        setSuccessMessage("Сотрудник удалён");
        setTimeout(() => setSuccessMessage(""), 3000);
      })
      .catch(console.error);
  };

  // logout
  const handleLogout = () => navigate("/");

  return (
    <div className="dashboard-container">
      {successMessage && <div className="success-banner">{successMessage}</div>}

      <div
        className="slides"
        style={{ transform: `translateY(-${slide * 100}vh)` }}
      >
        {/* ========== Slide 0: Employees ========== */}
        <section className="slide screen-emps">
          <div ref={headerWrapperRef} className="header-wrapper">
            <header className="dashboard-header">
              <div className="telegram-link-wrapper">
                {!boundChatId ? (
                  <div className="link-btn" onClick={openTelegramModal}>
                    <FaTelegramPlane size={16} />
                    <span className="link-label">Привязать Telegram</span>
                  </div>
                ) : (
                  <>
                    <div className="telegram-bound-info">
                      📲 Привязан: <b>{boundChatId}</b>
                    </div>
                    <button
                      className="unlink-btn"
                      onClick={handleUnbindTelegram}
                    >
                      Отвязать
                    </button>
                  </>
                )}
                {bindingInProgress && (
                  <div className="telegram-loading">…Сохраняем…</div>
                )}
              </div>

              {!selectedEmployee && (
                <div className="search-container">
                  <input
                    type="text"
                    placeholder="Поиск по имени и фамилии"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              )}

              {!selectedEmployee && (
                <>
                  <div className="desktop-header-buttons">
                    <FaUserPlus
                      className="add-icon-desktop"
                      size={24}
                      onClick={() => setSlide(2)}
                      title="Добавить сотрудника"
                    />
                    <FaEnvelope
                      className="btn-mail-desktop"
                      size={24}
                      onClick={() => setSlide(1)}
                      title="Почта заявлений"
                    />
                    <FaFileAlt
                      className="btn-report-desktop"
                      size={24}
                      onClick={() => setSlide(3)}
                      title="Отчёты сотрудников"
                    />
                    <FaSignOutAlt
                      className="logout-icon-desktop"
                      size={24}
                      onClick={handleLogout}
                      title="Выйти"
                    />
                  </div>
                  <div className="mobile-header-buttons">
                    <FaUserPlus
                      className="add-icon-mobile"
                      size={24}
                      onClick={() => setSlide(2)}
                      title="Добавить сотрудника"
                    />
                    <FaEnvelope
                      className="btn-mail-mobile"
                      size={24}
                      onClick={() => setSlide(1)}
                      title="Почта заявлений"
                    />
                    <FaFileAlt
                      className="btn-report-mobile"
                      size={24}
                      onClick={() => setSlide(3)}
                      title="Отчёты сотрудников"
                    />
                    <FaSignOutAlt
                      className="logout-icon-mobile"
                      size={24}
                      onClick={handleLogout}
                      title="Выйти"
                    />
                  </div>
                </>
              )}
            </header>
          </div>

          <AnimatePresence>
            {selectedEmployee && (
              <EmployeeDetail
                key={selectedEmployee.employee_id}
                employee={selectedEmployee}
                departments={departments}
                workSchedules={workSchedules}
                onClose={() => setSelectedEmployee(null)}
                onEmployeeUpdate={(upd) => {
                  // 1) Обновляем employees
                  setEmployees((prev) =>
                    prev.map((e) =>
                      e.employee_id === upd.employee_id ? upd : e
                    )
                  );
                  // 2) Обновляем workSchedules так, чтобы EmployeeDetail
                  //    при монтировании в useEffect увидел новый shift_type
                  setWorkSchedules((prev) =>
                    prev.map((s) =>
                      s.employee_id === upd.employee_id
                        ? { ...s, shift_type: upd.shift_type }
                        : s
                    )
                  );
                  // 3) Обновляем выбранного сотрудника (открытая карточка)
                  setSelectedEmployee(upd);
                }}
              />
            )}
          </AnimatePresence>

          {!selectedEmployee && (
            <div ref={cardsContainerRef} className="cards-container">
              {filteredEmployees.length ? (
                filteredEmployees.map((emp) => (
                  <div key={emp.employee_id} className="employee-card">
                    <FaEdit
                      className="edit-icon"
                      size={20}
                      onClick={() => setSelectedEmployee(emp)}
                    />
                    <ul>
                      <li>Имя: {emp.first_name}</li>
                      <li>Фамилия: {emp.last_name}</li>
                      <li>Почта: {emp.email}</li>
                      <li>Телефон: {emp.phone_number}</li>
                      <li>
                        Начало: {emp.hire_date.match(/\d{4}-\d{2}-\d{2}/)?.[0]}
                      </li>
                      <li>Должность: {emp.job_title}</li>
                      <li>Квалификация: {emp.qualification}</li>
                      <li>Зарплата: {emp.salary}</li>
                      <li>Осталось часов: {emp.hours_remaining?.toFixed(1)}</li>
                      <li>Тип смены: {emp.shift_type}</li>
                      <li>Отдел: {emp.department_name}</li>
                      {emp.vacations?.[0] && (
                        <li>
                          <strong>Последнее заявление:</strong>{" "}
                          {emp.vacations[0].vacation_type}
                          {emp.vacations[0].vacation_type === "Отпуск" &&
                            " (оплачиваемый)"}
                          {" с "}
                          {emp.vacations[0].start_date.split("T")[0]} по{" "}
                          {emp.vacations[0].end_date.split("T")[0]}
                        </li>
                      )}
                    </ul>
                    <FaTrash
                      className="delete-icon"
                      size={18}
                      onClick={() => handleDeleteEmployee(emp.employee_id)}
                      title="Удалить сотрудника"
                    />
                  </div>
                ))
              ) : (
                <p className="empty">Сотрудники не найдены.</p>
              )}
            </div>
          )}
        </section>

        {/* ========== Slide 1: Mail Requests ========== */}
        <section className="slide screen-mail">
          {selectedMail && (
            <MailDetail
              mail={selectedMail}
              onClose={() => setSelectedMail(null)}
              onDecision={handleMailDecision}
              onHoursUpdate={loadEmployeesWithVacations}
            />
          )}
          <header className="dashboard-header header-mail">
            <FaArrowUp
              className="btn-back-desktop"
              size={24}
              onClick={() => setSlide(0)}
              title="К сотрудникам"
            />
            <h2>Почта заявлений</h2>
            <FaSignOutAlt
              className="logout-icon-desktop"
              size={24}
              onClick={handleLogout}
              title="Выйти"
            />
          </header>
          {mails.length ? (
            <div className="mails-container">
              {mails.map((m) => (
                <div key={m.id} className="mail-card">
                  <strong>Заявление</strong>
                  <div>Тема: {m.subject}</div>
                  <div>От: {m.employeeName}</div>
                  <div className="mail-card-actions">
                    <button onClick={() => setSelectedMail(m)}>Ответить</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-mail">Входящие пусты</div>
          )}
        </section>

        {/* ========== Slide 2: Add Employee ========== */}
        <section className="slide screen-add-emp">
          <header className="dashboard-header header-add-emp">
            <FaArrowUp
              className="btn-back-desktop"
              size={24}
              onClick={() => setSlide(0)}
              title="К сотрудникам"
            />
            <h2>Добавить сотрудника</h2>
            <FaSignOutAlt
              className="logout-icon-desktop"
              size={24}
              onClick={handleLogout}
              title="Выйти"
            />
          </header>
          <div className="form-wrapper">
            <form className="add-employee-form" onSubmit={handleNewSubmit}>
              <div className="form-group">
                <label>Имя:</label>
                <input
                  type="text"
                  name="first_name"
                  value={newEmployee.first_name}
                  onChange={handleNewChange}
                  placeholder="Иван"
                  required
                />
              </div>

              <div className="form-group">
                <label>Фамилия:</label>
                <input
                  type="text"
                  name="last_name"
                  value={newEmployee.last_name}
                  onChange={handleNewChange}
                  placeholder="Иванов"
                  required
                />
              </div>

              <div className="form-group">
                <label>Почта:</label>
                <input
                  type="email"
                  name="email"
                  value={newEmployee.email}
                  onChange={handleNewChange}
                  placeholder="example@mail.com"
                  required
                />
              </div>

              <div className="form-group">
                <label>Телефон:</label>
                <input
                  type="text"
                  name="phone_number"
                  value={newEmployee.phone_number}
                  onChange={handleNewChange}
                  placeholder="+7 (___) ___-__-__"
                />
              </div>

              <div className="form-group">
                <label>Дата найма:</label>
                <input
                  type="date"
                  name="hire_date"
                  value={newEmployee.hire_date}
                  onChange={handleNewChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Должность:</label>
                <input
                  type="text"
                  name="job_title"
                  value={newEmployee.job_title}
                  onChange={handleNewChange}
                  placeholder="Например, Менеджер"
                />
              </div>

              <div className="form-group">
                <label>Квалификация:</label>
                <input
                  type="text"
                  name="qualification"
                  value={newEmployee.qualification}
                  onChange={handleNewChange}
                  placeholder="Например, Высшее"
                />
              </div>

              <div className="form-group">
                <label>Зарплата:</label>
                <input
                  type="number"
                  name="salary"
                  value={newEmployee.salary}
                  onChange={handleNewChange}
                  placeholder="0"
                />
              </div>

              <div className="form-group">
                <label>Отдел:</label>
                <input
                  type="text"
                  name="department_name"
                  value={newEmployee.department_name}
                  onChange={handleNewChange}
                  placeholder="Например, Продажный зал"
                  required
                />
              </div>

              <div className="form-group">
                <label>Рабочие часы:</label>
                <input
                  type="number"
                  name="working_hours"
                  value={newEmployee.working_hours}
                  onChange={handleNewChange}
                  placeholder="135"
                  required
                />
              </div>

              <div className="form-group">
                <label>Тип смены:</label>
                <input
                  type="text"
                  name="shift_type"
                  value={newEmployee.shift_type}
                  onChange={handleNewChange}
                  placeholder="Например, Дневная"
                  required
                />
              </div>
              <div className="form-actions">
                <button type="submit" className="btn">
                  Создать
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* ========== Slide 3: Reports ========== */}
        <section className="slide screen-reports">
          <header className="dashboard-header header-reports">
            <FaArrowUp
              className="btn-back-desktop"
              size={24}
              onClick={() => setSlide(0)}
              title="К сотрудникам"
            />
            <h2>Отчёты сотрудников</h2>
            <FaSignOutAlt
              className="logout-icon-desktop"
              size={24}
              onClick={handleLogout}
              title="Выйти"
            />
          </header>
          {reports.length ? (
            <div className="reports-container">
              {reports.map((r) => (
                <div key={r.report_id} className="report-card">
                  <ul>
                    <li>
                      <strong>№{r.report_id}</strong> от{" "}
                      {r.report_date.split("T")[0]}
                    </li>
                    <li>Сотрудник: {r.employee_name}</li>
                    <li>Описание: {r.report_description}</li>
                    <li>Данные: {r.report_data}</li>
                    {r.admin_comment && <li>Комментарий: {r.admin_comment}</li>}
                  </ul>
                  <button
                    className="btn mark-read-btn"
                    onClick={async () => {
                      await Axios.delete(
                        `http://localhost:3002/reports/${r.report_id}`
                      );
                      setReports((prev) =>
                        prev.filter((x) => x.report_id !== r.report_id)
                      );
                    }}
                  >
                    ✓ Просмотрено
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty">Нет новых отчётов.</p>
          )}
        </section>
      </div>

      {/* Telegram modal */}
      {showTelegramModal &&
        ReactDOM.createPortal(
          <div
            className={`telegram-form-overlay ${
              modalState === "open"
                ? "active"
                : modalState === "closing"
                ? "closing"
                : ""
            }`}
            onClick={closeTelegramModal}
          >
            <div
              className={`telegram-form-card ${
                modalState === "closing" ? "closing" : ""
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <h3>Инструкция по привязке Telegram</h3>
              <ol>
                <li className="li-telegram-modal">
                  Откройте бота <code>@diplomNotification_bot</code>.
                </li>
                <li className="li-telegram-modal">
                  Нажмите <code>/start</code>, затем <code>/bind</code> и
                  введите почту которую <br />
                  указывали при трудоустройстве.
                </li>
                <li className="li-telegram-modal">Бот подтвердит привязку.</li>
                <li className="li-telegram-modal">Обновите страницу.</li>
              </ol>
              <button
                className="close-telegram-modalBtn"
                onClick={closeTelegramModal}
              >
                Закрыть
              </button>
            </div>
          </div>,
          document.getElementById("modal-root")
        )}
    </div>
  );
}
