// MailDetail.jsx
import { useState } from "react";
import { FaTimes } from "react-icons/fa";
import Axios from "axios";
import "../../../../css/main.css"; // imp4

export default function MailDetail({
  mail,
  onClose,
  onDecision,
  onHoursUpdate,
}) {
  const [comment, setComment] = useState("");
  const [isClosing, setIsClosing] = useState(false);

  const handleSubmit = async (mode) => {
    try {
      // 1) Отправляем PUT /mails/:id/approve или /reject
      const { data: resp } = await Axios.put(
        `http://localhost:3002/mails/${mail.id}/${mode}`,
        { adminComment: comment }
      );
      // resp.employee_id должен прийти из сервера
      const empId = resp.employee_id;
      if (!empId) {
        console.error("Не пришёл employee_id из /approve");
      } else {
        // 2) Сразу запрашиваем обновлённого сотрудника
        const { data: updatedEmp } = await Axios.get(
          `http://localhost:3002/employees/${empId}`
        );
        // 3) Передаём наверх, чтобы Dashboard обновил свой state
        onHoursUpdate(updatedEmp);
      }

      // 4) Оповещаем Dashboard, что письмо обработано (удаляем из списка)
      onDecision(mail.id, mode);

      // 5) Анимация закрытия
      setIsClosing(true);
      setTimeout(() => {
        onClose();
      }, 200);
    } catch (err) {
      console.error(err);
      alert("Не удалось выполнить действие");
    }
  };

  const handleCancel = () => {
    setIsClosing(true);
    setTimeout(onClose, 200);
  };

  return (
    <div
      className="mail-detail-overlay"
      data-closing={isClosing ? "true" : "false"}
    >
      <div className="mail-detail">
        <div className="mail-detail-header">
          <h3>Заявление #{mail.id}</h3>
          <FaTimes className="close-icon" onClick={handleCancel} />
        </div>
        <div className="mail-detail-body">
          <p>
            <strong>От:</strong> {mail.employeeName}
          </p>
          <p>
            <strong>Тема:</strong> {mail.subject}
          </p>
          <p>
            <strong>Период:</strong>{" "}
            {mail.start_date.match(/\d{4}-\d{2}-\d{2}/)[0]} —{" "}
            {mail.end_date.match(/\d{4}-\d{2}-\d{2}/)[0]}
          </p>
          <p>
            <strong>Причина:</strong> {mail.reason}
          </p>
          <div className="form-group">
            <label>Комментарий администратора</label>
            <textarea
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>
        </div>
        <div className="mail-detail-actions">
          <button className="btn reject" onClick={() => handleSubmit("reject")}>
            Отклонить
          </button>
          <button
            className="btn approve"
            onClick={() => handleSubmit("approve")}
          >
            Одобрить
          </button>
        </div>
      </div>
    </div>
  );
}
