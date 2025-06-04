// EmployeeDetail.jsx
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FaTimes } from "react-icons/fa";
import Axios from "axios";
import "../../../../css/main.css"; // imp4

export default function EmployeeDetail({
  employee,
  departments,
  workSchedules,
  onClose,
  onEmployeeUpdate,
}) {
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone_number: "",
    hire_date: "",
    job_title: "",
    qualification: "",
    salary: "",
    hours_remaining: "", // вместо working_hours
    shift_type: "",
  });
  const [editedDeptName, setEditedDeptName] = useState("");
  const [scheduleId, setScheduleId] = useState(null);

  // Найдём расписание (shift_type) у данного сотрудника:
  const schedule = workSchedules.find(
    (s) => s.employee_id === employee.employee_id
  ) || {
    schedule_id: null,
    shift_type: "",
  };

  useEffect(() => {
    if (!employee) return;

    // Инициализируем форму из props.employee:
    setFormData({
      first_name: employee.first_name,
      last_name: employee.last_name,
      email: employee.email,
      phone_number: employee.phone_number,
      hire_date: employee.hire_date?.substring(0, 10) || "",
      job_title: employee.job_title,
      qualification: employee.qualification,
      salary: employee.salary,
      // Важно: берём именно employee.hours_remaining, а не workSchedules.working_hours
      hours_remaining: employee.hours_remaining ?? "",
      shift_type: schedule.shift_type || "",
    });

    setEditedDeptName(employee.department_name || "");
    setScheduleId(schedule.schedule_id);
  }, [employee, schedule]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    try {
      // ————————————————
      // 1) Обновляем поля employees
      await Axios.put(
        `http://localhost:3002/employees/${employee.employee_id}`,
        {
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email,
          phone_number: formData.phone_number,
          hire_date: formData.hire_date,
          job_title: formData.job_title,
          qualification: formData.qualification,
          salary: formData.salary,
        }
      );

      // 2) Обновляем shift_type в workschedules
      if (scheduleId) {
        await Axios.put(`http://localhost:3002/workschedules/${scheduleId}`, {
          shift_type: formData.shift_type,
        });
      }

      // 3) Обновляем отдел:
      await Axios.put(
        `http://localhost:3002/departments/${employee.department_id}`,
        { department_name: editedDeptName }
      );

      // 4) Обновляем часы вручную в time_deductions
      await Axios.put(
        `http://localhost:3002/time_deductions/${employee.employee_id}`,
        {
          hours_remaining: Number(formData.hours_remaining),
        }
      );

      // 5) Запрашиваем обновленного сотрудника целиком
      const { data: updatedEmp } = await Axios.get(
        `http://localhost:3002/employees/${employee.employee_id}`
      );

      // 6) Передаём наверх Dashboard
      onEmployeeUpdate &&
        onEmployeeUpdate({
          ...updatedEmp,
          department_name: editedDeptName,
        });

      alert("Данные успешно сохранены");
      onClose();
    } catch (err) {
      console.error("Ошибка при сохранении сотрудника:", err);
      alert("Ошибка при сохранении данных");
    }
  };

  return (
    <motion.div
      className="employee-detail"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4 }}
    >
      <div className="detail-header">
        <h2 className="detail-title">Редактирование сотрудника</h2>
        <div className="close-detail" onClick={onClose}>
          <FaTimes size={24} color="#fff" />
        </div>
      </div>

      <div className="detail-content">
        {[
          { label: "Имя", name: "first_name", type: "text" },
          { label: "Фамилия", name: "last_name", type: "text" },
          { label: "Почта", name: "email", type: "email" },
          { label: "Телефон", name: "phone_number", type: "text" },
          { label: "Начало работы", name: "hire_date", type: "date" },
          { label: "Должность", name: "job_title", type: "text" },
          { label: "Квалификация", name: "qualification", type: "text" },
          { label: "Зарплата", name: "salary", type: "number" },
          // Показываем только «оставшиеся часы», пользователю нельзя вручную менять:
          { label: "Оставшиеся часы", name: "hours_remaining", type: "text" },
          // Поле для смены:
          { label: "Тип смены", name: "shift_type", type: "text" },
        ].map(({ label, name, type }) => (
          <div className="form-group" key={name}>
            <label>{label}:</label>
            <input
              type={type}
              name={name}
              value={formData[name]}
              onChange={handleChange}
              {...(name === "hours_remaining"
                ? { disabled: false }
                : { disabled: false })}
            />
          </div>
        ))}

        <div className="form-group">
          <label>Текущий отдел:</label>
          <input type="text" value={employee.department_name} disabled />
        </div>
        <div className="form-group">
          <label>Новое название отдела:</label>
          <input
            type="text"
            value={editedDeptName}
            onChange={(e) => setEditedDeptName(e.target.value)}
          />
        </div>
      </div>

      <div className="employee-form-buttons">
        <button className="btn" onClick={handleSave}>
          Сохранить
        </button>
        <button className="btn" onClick={onClose}>
          Отмена
        </button>
      </div>
    </motion.div>
  );
}
