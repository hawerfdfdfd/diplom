// Dashboard.jsx
import { useState, useEffect, useRef } from "react";
import Axios from "axios";
import {
  FaEdit,
  FaSignOutAlt,
  FaEnvelope,
  FaUserPlus,
  FaArrowUp,
  FaTrash, // Импортируем иконку "удалить"
} from "react-icons/fa";
import { AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import EmployeeDetail from "./EmployeeDetail";
import MailDetail from "../MailDetail/MailDetail";
import "../../../../css/main.css"; // imp4

export default function Dashboard() {
  const [employees, setEmployees] = useState([]);
  const [mails, setMails] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [workSchedules, setWorkSchedules] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedMail, setSelectedMail] = useState(null);
  const [slide, setSlide] = useState(0); // 0 = сотрудники, 1 = почта, 2 = добавить сотрудника
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  // STATE ДЛЯ БАННЕРА УСПЕХА
  const [successMessage, setSuccessMessage] = useState("");

  // refs for header hide-on-scroll
  const headerWrapperRef = useRef(null);
  const cardsContainerRef = useRef(null);

  // новый сотрудник для формы
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

  // 1) Загрузка списка сотрудников вместе с working_hours
  const fetchEmployees = () => {
    Axios.get("http://localhost:3002/employees")
      .then(({ data }) => {
        setEmployees(data);
      })
      .catch((err) => console.error("Error fetching employees:", err));
  };

  // 2) Загрузка списка рабочих графиков (необязательно, если часы лежат прямо в employees)
  const fetchWorkSchedules = () => {
    Axios.get("http://localhost:3002/workschedules")
      .then(({ data }) => setWorkSchedules(data))
      .catch((err) => console.error("Error fetching work schedules:", err));
  };

  // 3) При старте сразу выкачиваем 4 ресурса: сотрудников, письма, отделы, графики
  useEffect(() => {
    fetchEmployees(); // сразу получаем working_hours
    Axios.get("http://localhost:3002/mails")
      .then(({ data }) => setMails(data))
      .catch(console.error);

    Axios.get("http://localhost:3002/departments")
      .then(({ data }) => setDepartments(data))
      .catch(console.error);

    fetchWorkSchedules(); // если нужно держать список графиков отдельно
  }, []);

  // hide header on scroll down (для слайдов сотрудников и почты)
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

  const filteredEmployees = employees.filter((emp) =>
    `${emp.first_name} ${emp.last_name}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

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
  };

  const handleLogout = () => navigate("/");

  const handleCloseEmployee = () => setSelectedEmployee(null);
  const handleCloseMail = () => setSelectedMail(null);

  const handleMailDecision = (mailId, mode) => {
    // Убираем письмо из списка
    setMails((prev) => prev.filter((m) => m.id !== mailId));

    if (mode === "approve") {
      // 1) Сразу подтягиваем свежий список сотрудников (чтобы часы тоже обновились)
      fetchEmployees();
      // 2) Сразу подтягиваем свежий список рабочих графиков
      fetchWorkSchedules();
    }
  };

  // Обработка полей формы нового сотрудника
  const handleNewChange = (e) => {
    const { name, value } = e.target;
    setNewEmployee((prev) => ({ ...prev, [name]: value }));
  };

  // Отправка POST-запроса для создания нового сотрудника
  // Отправка POST-запроса для создания нового сотрудника
  const handleNewSubmit = (e) => {
    e.preventDefault();

    Axios.post("http://localhost:3002/employees", newEmployee)
      .then(({ data }) => {
        // data должен содержать { employee_id: <новый ID>, … }
        const newId = data.employee_id || data.insertId;
        if (!newId) {
          // на случай, если сервер вернул лишь сообщение без ID
          console.error("Не получили insertId при создании сотрудника");
          return;
        }

        // После того как сервер вставил сотрудника, запрашиваем его «полный» объект,
        // чтобы получить корректные hours_remaining, hours_used и т.п.
        return Axios.get(`http://localhost:3002/employees/${newId}`)
          .then(({ data: fullEmp }) => {
            // 1) Добавляем «полный» объект сотрудника в локальный стейт:
            setEmployees((prev) => [fullEmp, ...prev]);

            // 2) Сбрасываем форму
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

            // 3) Показываем баннер успеха
            setSuccessMessage("Сотрудник успешно создан");
            setTimeout(() => setSuccessMessage(""), 3000);

            // 4) Переключаемся на слайд сотрудников
            setSlide(0);
          })
          .catch((err) => {
            console.error("Не удалось получить созданного сотрудника:", err);
          });
      })
      .catch(console.error);
  };

  // Удаление сотрудника
  const handleDeleteEmployee = (employee_id) => {
    // Подтверждение
    const ok = window.confirm(
      "Вы уверены, что хотите удалить этого сотрудника?"
    );
    if (!ok) return;

    Axios.delete(`http://localhost:3002/employees/${employee_id}`)
      .then(() => {
        // Удаляем из локального стейта
        setEmployees((prev) =>
          prev.filter((e) => e.employee_id !== employee_id)
        );
        // Показать краткое уведомление об удалении (можно расширить)
        setSuccessMessage("Сотрудник удалён");
        setTimeout(() => setSuccessMessage(""), 3000);
      })
      .catch(console.error);
  };

  const handleHoursUpdate = (updatedEmployee) => {
    setEmployees((prev) =>
      prev.map((e) =>
        e.employee_id === updatedEmployee.employee_id ? updatedEmployee : e
      )
    );
  };

  return (
    <div className="dashboard-container">
      {/* ===================== ПЛАШКА УСПЕХА ===================== */}
      {successMessage && <div className="success-banner">{successMessage}</div>}
      {/* ========================================================= */}

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
        {/* === Слайд 0: сотрудники === */}
        <section className="slide screen-emps">
          <div ref={headerWrapperRef} className="header-wrapper">
            <header className="dashboard-header">
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
            </header>
            {!selectedEmployee && (
              <>
                <div className="desktop-header-buttons">
                  {/* Иконка "Добавить сотрудника" */}
                  <FaUserPlus
                    className="add-icon-desktop"
                    size={24}
                    onClick={() => setSlide(2)}
                    title="Добавить сотрудника"
                  />
                  {/* Иконка "Почта заявлений" */}
                  <FaEnvelope
                    className="btn-mail-desktop"
                    size={24}
                    onClick={() => setSlide(1)}
                    title="Почта заявлений"
                  />
                  {/* Иконка "Выйти" */}
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
          </div>

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
                    </ul>

                    {/* Иконка удаления в правом нижнем углу карточки */}
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

        {/* === Слайд 1: почта заявлений === */}
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

        {/* === Слайд 2: добавить сотрудника === */}
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
                <button type="submit">Создать</button>
              </div>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
