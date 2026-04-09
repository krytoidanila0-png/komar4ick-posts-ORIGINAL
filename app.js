* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  background-color: #0a0f0a;
  color: #0f0;
  font-family: 'Courier New', Courier, monospace;
  line-height: 1.5;
  min-height: 100vh;
  position: relative;
  padding: 20px;
}

/* Анимация матрицы */
.matrix-bg {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: -1;
  opacity: 0.15;
  overflow: hidden;
}

.matrix-bg span {
  position: absolute;
  color: #0f0;
  font-size: 1.2rem;
  white-space: nowrap;
  animation: fall linear infinite;
}

@keyframes fall {
  0% { transform: translateY(-100%); }
  100% { transform: translateY(100vh); }
}

/* Шапка */
header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2px solid #0f0;
  padding-bottom: 10px;
  margin-bottom: 30px;
  flex-wrap: wrap;
  gap: 15px;
}

h1, h2 {
  font-weight: normal;
  text-shadow: 0 0 5px #0f0;
}

h1 {
  font-size: 2rem;
}

h2 {
  margin-bottom: 15px;
  border-left: 3px solid #0f0;
  padding-left: 10px;
}

/* Формы и кнопки */
input, textarea, button {
  background: #111;
  border: 1px solid #0f0;
  color: #0f0;
  font-family: inherit;
  padding: 8px 12px;
  border-radius: 4px;
  outline: none;
}

input:focus, textarea:focus {
  box-shadow: 0 0 8px #0f0;
}

button {
  cursor: pointer;
  background: #0f0;
  color: #000;
  font-weight: bold;
  transition: 0.2s;
}

button:hover {
  background: #0c0;
  box-shadow: 0 0 10px #0f0;
}

#auth-area {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

/* Карточки постов */
.post-card {
  border: 1px solid #0f0;
  padding: 15px;
  margin-bottom: 20px;
  background: rgba(0, 20, 0, 0.7);
  border-radius: 5px;
}

.post-title {
  font-size: 1.4rem;
  margin-bottom: 8px;
}

.post-meta {
  font-size: 0.8rem;
  color: #0a0;
  margin-bottom: 10px;
}

.post-content {
  white-space: pre-wrap;
}

/* Секция добавления поста */
#add-post-section {
  margin-bottom: 30px;
  padding: 20px;
  border: 1px dashed #0f0;
  border-radius: 5px;
}

#add-post-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

#add-post-form input,
#add-post-form textarea {
  width: 100%;
}

/* Адаптив */
@media (max-width: 600px) {
  header {
    flex-direction: column;
    align-items: start;
  }
}
