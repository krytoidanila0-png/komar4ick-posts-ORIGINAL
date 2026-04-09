// Импорт функций Firebase (используем глобальные объекты из window)
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js";

import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";

const auth = window.auth;
const db = window.db;

// DOM элементы
const authArea = document.getElementById('auth-area');
const addPostSection = document.getElementById('add-post-section');
const postsContainer = document.getElementById('posts-container');
const addPostForm = document.getElementById('add-post-form');

// -------------------- Анимация матрицы --------------------
function createMatrixRain() {
  const bg = document.getElementById('matrix');
  const spanCount = 40;
  for (let i = 0; i < spanCount; i++) {
    const span = document.createElement('span');
    span.style.left = Math.random() * 100 + '%';
    span.style.animationDuration = (Math.random() * 5 + 5) + 's';
    span.style.animationDelay = Math.random() * 5 + 's';
    span.textContent = Array.from({ length: 20 }, () => Math.round(Math.random())).join('');
    bg.appendChild(span);
  }
}
createMatrixRain();

// -------------------- Аутентификация UI --------------------
function renderAuthUI(user) {
  if (user) {
    // Пользователь вошёл
    authArea.innerHTML = `
      <span>${user.email}</span>
      <button id="logout-btn">Выйти</button>
    `;
    document.getElementById('logout-btn').addEventListener('click', async () => {
      await signOut(auth);
    });
    addPostSection.style.display = 'block';
  } else {
    // Гость — интерфейс с кнопкой Google
    authArea.innerHTML = `
      <input type="email" id="login-email" placeholder="Email" size="15">
      <input type="password" id="login-password" placeholder="Пароль" size="10">
      <button id="login-btn">Войти</button>
      <button id="signup-btn">Регистрация</button>
      <button id="google-login-btn">Войти через Google</button>
    `;
    addPostSection.style.display = 'none';

    // Вход по email
    document.getElementById('login-btn').addEventListener('click', async () => {
      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;
      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch (error) {
        alert('Ошибка входа: ' + error.message);
      }
    });

    // Регистрация
    document.getElementById('signup-btn').addEventListener('click', async () => {
      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;
      try {
        await createUserWithEmailAndPassword(auth, email, password);
      } catch (error) {
        alert('Ошибка регистрации: ' + error.message);
      }
    });

    // Вход через Google
    document.getElementById('google-login-btn').addEventListener('click', async () => {
      const provider = new GoogleAuthProvider();
      try {
        await signInWithPopup(auth, provider);
        // UI обновится автоматически через onAuthStateChanged
      } catch (error) {
        console.error("Ошибка входа через Google:", error);
        alert('Ошибка входа через Google: ' + error.message);
      }
    });
  }
}

// -------------------- Загрузка постов --------------------
async function loadPosts() {
  postsContainer.innerHTML = 'Загрузка...';
  try {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      postsContainer.innerHTML = '<p>Записей пока нет. Будьте первым!</p>';
      return;
    }
    let html = '';
    snapshot.forEach(doc => {
      const post = doc.data();
      html += `
        <div class="post-card">
          <div class="post-title">${escapeHtml(post.title)}</div>
          <div class="post-meta">${post.author || 'Аноним'} | ${post.createdAt ? new Date(post.createdAt.toDate()).toLocaleString() : ''}</div>
          <div class="post-content">${escapeHtml(post.content)}</div>
        </div>
      `;
    });
    postsContainer.innerHTML = html;
  } catch (error) {
    console.error(error);
    postsContainer.innerHTML = '<p>Ошибка загрузки записей.</p>';
  }
}

// Простейшая защита от XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// -------------------- Добавление поста --------------------
addPostForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) {
    alert('Войдите, чтобы публиковать');
    return;
  }

  const title = document.getElementById('post-title').value.trim();
  const content = document.getElementById('post-content').value.trim();
  if (!title || !content) return;

  try {
    await addDoc(collection(db, "posts"), {
      title,
      content,
      author: user.email,
      createdAt: serverTimestamp()
    });
    addPostForm.reset();
    loadPosts(); // обновить ленту
  } catch (error) {
    alert('Ошибка: ' + error.message);
  }
});

// -------------------- Отслеживание состояния входа --------------------
onAuthStateChanged(auth, (user) => {
  renderAuthUI(user);
  loadPosts();
});
