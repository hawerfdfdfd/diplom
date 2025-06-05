// Dashboard.jsx
import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Axios from "axios";
import {
  FaEdit,
  FaSignOutAlt,
  FaEnvelope,
  FaUserPlus,
  FaArrowUp,
  FaTrash,
  FaTelegramPlane,
} from "react-icons/fa";
import { AnimatePresence } from "framer-motion";

import EmployeeDetail from "./EmployeeDetail";
import MailDetail from "../MailDetail/MailDetail";

export default function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();

  // ======= Проверка: пускаем только «Ольга Никитина» =======
  const userInfo = location.state?.userInfo || null;
  useEffect(() => {
    if (!userInfo) {
      navigate("/", { replace: true });
      return;
    }
    const u = userInfo[0];
    if (!(u.first_name === "Ольга" && u.last_name === "Никитина")) {
      navigate("/", { replace: true });
    }
  }, [userInfo, navigate]);

  // ======= Основные состояния =======
  const [employees, setEmployees] = useState([]);
  const [mails, setMails] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [workSchedules, setWorkSchedules] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedMail, setSelectedMail] = useState(null);
  const [slide, setSlide] = useState(0); // 0 – сотрудники, 1 – почта, 2 – добавить сотрудника
  const [searchQuery, setSearchQuery] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const headerWrapperRef = useRef(null);
  const cardsContainerRef = useRef(null);

  // Для формы «Новый сотрудник»
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

  // ======= Состояния для Telegram-привязки =======
  const [showTelegramModal, setShowTelegramModal] = useState(false);
  const [telegramChatId, setTelegramChatId] = useState("");
  const [bindingInProgress, setBindingInProgress] = useState(false);
  const [boundChatId, setBoundChatId] = useState(null);

  // Открыть/закрыть модалку для ввода chat_id
  const openTelegramModal = () => setShowTelegramModal(true);
  const closeTelegramModal = () => {
    setTelegramChatId("");
    setBindingInProgress(false);
    setShowTelegramModal(false);
  };

  // ======= Привязка Telegram =======
  const handleBindTelegram = async () => {
    if (!telegramChatId.trim()) {
      alert("Введите ваш Telegram chat_id.");
      return;
    }
    const empId = userInfo[0].employee_id;
    try {
      setBindingInProgress(true);
      await Axios.post("http://localhost:3002/telegram-links", {
        employee_id: empId,
        telegram_chat_id: telegramChatId.trim(),
      });
      setBoundChatId(telegramChatId.trim());
      closeTelegramModal();
      alert("Telegram успешно привязан!");
    } catch (err) {
      console.error("Ошибка при сохранении telegram_chat_id:", err);
      alert("Не удалось сохранить, попробуйте снова.");
      setBindingInProgress(false);
    }
  };

  // ======= Отвязка Telegram =======
  const handleUnbindTelegram = async () => {
    if (!boundChatId) return;
    const empId = userInfo[0].employee_id;
    if (!window.confirm("Вы уверены, что хотите отвязать Telegram?")) {
      return;
    }
    try {
      setBindingInProgress(true);
      await Axios.delete(`http://localhost:3002/telegram-links/${empId}`, {
        data: { employee_id: empId },
      });
      setBoundChatId(null);
      setBindingInProgress(false);
      alert("Telegram отвязан.");
    } catch (err) {
      console.error("Ошибка при отвязке Telegram:", err);
      alert("Не удалось отвязать, попробуйте снова.");
      setBindingInProgress(false);
    }
  };

  useEffect(() => {
    if (!userInfo) return;
    const empId = userInfo[0].employee_id;

    // Запрашиваем, существует ли уже связь в БД
    Axios.get(`http://localhost:3002/telegram-links/${empId}`)
      .then(({ data }) => {
        // Если связь есть, устанавливаем её в локальный стейт
        setBoundChatId(data.telegram_chat_id);
      })
      .catch((err) => {
        // Если 404 — значит связи ещё нет, просто ничего не делаем
        if (err.response?.status !== 404) {
          console.error("Ошибка при загрузке telegram_link:", err);
        }
      });
  }, [userInfo]);

  // ======= Загрузка данных сотрудников / почты / отделов / расписаний =======
  const fetchEmployees = () => {
    Axios.get("http://localhost:3002/employees")
      .then(({ data }) => setEmployees(data))
      .catch((err) => console.error("Error fetching employees:", err));
  };
  const fetchWorkSchedules = () => {
    Axios.get("http://localhost:3002/workschedules")
      .then(({ data }) => setWorkSchedules(data))
      .catch((err) => console.error("Error fetching work schedules:", err));
  };
  useEffect(() => {
    fetchEmployees();
    Axios.get("http://localhost:3002/mails")
      .then(({ data }) => setMails(data))
      .catch(console.error);
    Axios.get("http://localhost:3002/departments")
      .then(({ data }) => setDepartments(data))
      .catch(console.error);
    fetchWorkSchedules();
  }, []);

  // ======= Скрытие шапки при скролле вверх/вниз =======
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

  // ======= Фильтрация сотрудников по поиску =======
  const filteredEmployees = employees.filter((emp) =>
    `${emp.first_name} ${emp.last_name}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  // ======= Когда вернули из модалки редактирования – обновляем список =======
  const handleEmployeeUpdate = (updated) => {
    if (!updated.employee_id) {
      setEmployees((prev) => [updated, ...prev]);
      setSelectedEmployee(null);
      return;
    }
    setEmployees((prev) =>
      prev.map((e) => (e.employee_id === updated.employee_id ? updated : e))
    );
    setSelectedEmployee((cur) =>
      cur && cur.employee_id === updated.employee_id ? updated : cur
    );
    fetchWorkSchedules();
  };

  // ======= Логаут =======
  const handleLogout = () => navigate("/");
  const handleCloseEmployee = () => setSelectedEmployee(null);
  const handleCloseMail = () => setSelectedMail(null);

  // ======= Обработка разных действий в «Почте заявлений» =======
  const handleMailDecision = (mailId, mode) => {
    // удаляем письмо из списка
    setMails((prev) => prev.filter((m) => m.id !== mailId));
    if (mode === "approve") {
      fetchEmployees();
      fetchWorkSchedules();
    }
  };

  // ======= Форма «Добавить нового сотрудника» =======
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
      .then(({ data }) => {
        const newId = data.employee_id || data.insertId;
        if (!newId) {
          console.error("Не получили insertId при создании сотрудника");
          return;
        }
        return Axios.get(`http://localhost:3002/employees/${newId}`).then(
          ({ data: fullEmp }) => {
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
            setTimeout(() => setSuccessMessage(""), 3000);
            setSlide(0);
          }
        );
      })
      .catch(console.error);
  };

  // ======= Удаление сотрудника =======
  const handleDeleteEmployee = (employee_id) => {
    const ok = window.confirm(
      "Вы уверены, что хотите удалить этого сотрудника?"
    );
    if (!ok) return;
    Axios.delete(`http://localhost:3002/employees/${employee_id}`)
      .then(() => {
        setEmployees((prev) =>
          prev.filter((e) => e.employee_id !== employee_id)
        );
        setSuccessMessage("Сотрудник удалён");
        setTimeout(() => setSuccessMessage(""), 3000);
      })
      .catch(console.error);
  };

  // ======= Обновление часов после «approve» =======
  const handleHoursUpdate = (updatedEmployee) => {
    setEmployees((prev) =>
      prev.map((e) =>
        e.employee_id === updatedEmployee.employee_id ? updatedEmployee : e
      )
    );
  };

  return (
    <div className="dashboard-container">
      {/* ==================================================================== */}
      {/* 1) БАННЕР УСПЕХА                                                    */}
      {/* ==================================================================== */}
      {successMessage && <div className="success-banner">{successMessage}</div>}

      {/* ==================================================================== */}
      {/* 2) СЛАЙДЫ: «Сотрудники», «Почта заявлений», «Добавить сотрудника»      */}
      {/* ==================================================================== */}
      <div
        className="slides"
        style={{
          transform:
            slide === 0
              ? "translateY(0)"
              : slide === 1
              ? "translateY(-100vh)"
              : "translateY(-200vh)",
        }}
      >
        {/* ====================== Слайд 0: сотрудники ======================== */}
        <section className="slide screen-emps">
          {/* ========== Шапка с Telegram, поиском и иконками ========== */}
          <div ref={headerWrapperRef} className="header-wrapper">
            <header className="dashboard-header">
              {/* —————————————————————————————— */}
              {/* 1) Кнопка «Привязать Telegram» */}
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

              {/* —————————————————————————————— */}
              {/* 2) Поисковая строка */}
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

              {/* —————————————————————————————— */}
              {/* 3) Иконки справа (Desktop) и (Mobile) */}
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

          {/* ===== Модалка редактирования сотрудника ===== */}
          <AnimatePresence>
            {selectedEmployee && (
              <EmployeeDetail
                employee={selectedEmployee}
                departments={departments}
                workSchedules={workSchedules}
                onClose={handleCloseEmployee}
                onEmployeeUpdate={handleEmployeeUpdate}
              />
            )}
          </AnimatePresence>

          {/* ===== Список карточек сотрудников ===== */}
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
                      <li>Осталось часов: {emp.hours_remaining.toFixed(1)}</li>
                      <li>Тип смены: {emp.shift_type}</li>
                      <li>Отдел: {emp.department_name}</li>
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

        {/* ====================== Слайд 1: почта заявлений ====================== */}
        <section className="slide screen-mail">
          {selectedMail && (
            <MailDetail
              mail={selectedMail}
              onClose={handleCloseMail}
              onDecision={handleMailDecision}
              onHoursUpdate={handleHoursUpdate}
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

        {/* ====================== Слайд 2: добавить сотрудника ====================== */}
        <section className="slide screen-add-emp">
          <header className="dashboard-header header-add-emp">
            <FaArrowUp
              className="btn-back-desktop"
              size={24}
              onClick={() => setSlide(0)}
              title="Назад к сотрудникам"
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
              {/* … все поля формы как было ранее … */}
              <div className="form-actions">
                <button type="submit">Создать</button>
              </div>
            </form>
          </div>
        </section>
      </div>

      {/* ==================================================================== */}
      {/* 3) ОВЕРЛЕЙ-ФОРМА для ввода chat_id (если showTelegramModal = true)      */}
      {/* ==================================================================== */}
      {showTelegramModal && (
        <div className="telegram-form-overlay" onClick={closeTelegramModal}>
          <div
            className="telegram-form-card"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Ввести Telegram chat_id</h3>
            <input
              type="text"
              value={telegramChatId}
              onChange={(e) => setTelegramChatId(e.target.value)}
              placeholder="Введите ваш chat_id"
            />
            <div className="telegram-form-buttons">
              <button
                className="btn cancel"
                onClick={closeTelegramModal}
                disabled={bindingInProgress}
              >
                Отмена
              </button>
              <button
                className="btn"
                onClick={handleBindTelegram}
                disabled={bindingInProgress}
              >
                Привязать
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
