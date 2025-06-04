// Login.jsx
import { useState, useEffect } from "react";
import Axios from "axios";
import { useNavigate } from "react-router-dom";
import { BsMortarboard } from "react-icons/bs";
import "../../../../css/main.css"; //imp4

export default function Login() {
  const [loginUserName, setLoginUserName] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginStatus, setLoginStatus] = useState(""); // Текст ошибки
  const [showError, setShowError] = useState(false); // Управляет анимацией видимости ошибки
  const navigateTo = useNavigate();

  const loginUser = (e) => {
    e.preventDefault();
    Axios.post("http://localhost:3002/login", {
      LoginUserName: loginUserName,
      LoginPassword: loginPassword,
    })
      .then((response) => {
        if (
          response.data.message ||
          loginUserName === "" ||
          loginPassword === ""
        ) {
          navigateTo("/");
          setLoginStatus("");
          setTimeout(() => {
            setLoginStatus("Данные не верны!");
          }, 50);
        } else if (loginUserName === "Ольга" && loginPassword === "Никитина") {
          navigateTo("/dashboard", { state: { userInfo: response.data } });
        } else {
          navigateTo("/workerPage", { state: { userInfo: response.data } });
        }
      })
      .catch((error) => {
        console.error("Ошибка запроса:", error);
      });
  };

  useEffect(() => {
    if (loginStatus) {
      setShowError(true);
      const timer = setTimeout(() => {
        setShowError(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [loginStatus]);

  return (
    <div className="loginPage">
      {/* Удалён блок с фоновой анимацией (stars) из компонента Login */}
      <div className="loginContainer">
        <div className="loginForm">
          <div className="formHeader">
            <BsMortarboard className="icon" />
            <div className="formHeaderText">
              <span>Добро</span>
              <p>Пожаловать!</p>
            </div>
          </div>

          <form className="mainForm" onSubmit={loginUser}>
            <div className={`error-container ${showError ? "visible" : ""}`}>
              <span className="error-message">{loginStatus}</span>
            </div>

            <div className="inputDiv">
              <label htmlFor="username">Имя пользователя</label>
              <div className="input">
                <input
                  type="text"
                  id="username"
                  placeholder="Введите логин"
                  onChange={(event) => setLoginUserName(event.target.value)}
                />
              </div>
            </div>

            <div className="inputDiv">
              <label htmlFor="password">Пароль</label>
              <div className="input">
                <input
                  type="password"
                  id="password"
                  placeholder="Введите пароль"
                  autoComplete="current-password"
                  onChange={(event) => setLoginPassword(event.target.value)}
                />
              </div>
            </div>

            <button type="submit" className="btn">
              <span>Ввести</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
