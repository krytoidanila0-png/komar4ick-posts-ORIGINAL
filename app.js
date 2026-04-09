// Импорт функций Firebase
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
  serverTimestamp,
  doc,
  updateDoc,
  increment,
  where,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";

const auth = window.auth;
const db = window.db;

// Админский email
const ADMIN_EMAIL = 'krytoidanila0@gmail.com';

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
    authArea.innerHTML = `
      <span>${user.email}</span>
      <button id="logout-btn">Выйти</button>
    `;
    document.getElementById('logout-btn').addEventListener('click', async () => {
      await signOut(auth);
    });
    
    // Показываем форму добавления поста только админу
    if (user.email === ADMIN_EMAIL) {
      addPostSection.style.display = 'block';
    } else {
      addPostSection.style.display = 'none';
    }
  } else {
    authArea.innerHTML = `
      <input type="email" id="login-email" placeholder="Email" size="15">
      <input type="password" id="login-password" placeholder="Пароль" size="10">
      <button id="login-btn">Войти</button>
      <button id="signup-btn">Регистрация</button>
      <button id="google-login-btn">Войти через Google</button>
    `;
    addPostSection.style.display = 'none';

    document.getElementById('login-btn').addEventListener('click', async () => {
      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;
      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch (error) {
        alert('Ошибка входа: ' + error.message);
      }
    });

    document.getElementById('signup-btn').addEventListener('click', async () => {
      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;
      try {
        await createUserWithEmailAndPassword(auth, email, password);
      } catch (error) {
        alert('Ошибка регистрации: ' + error.message);
      }
    });

    document.getElementById('google-login-btn').addEventListener('click', async () => {
      const provider = new GoogleAuthProvider();
      try {
        await signInWithPopup(auth, provider);
      } catch (error) {
        console.error("Ошибка входа через Google:", error);
        alert('Ошибка входа через Google: ' + error.message);
      }
    });
  }
}

// -------------------- Загрузка постов с лайками, комментариями и удалением --------------------
async function loadPosts() {
  postsContainer.innerHTML = 'Загрузка...';
  const user = auth.currentUser;
  const isAdmin = user && user.email === ADMIN_EMAIL;
  
  try {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      postsContainer.innerHTML = '<p>Записей пока нет. Будьте первым!</p>';
      return;
    }
    
    let html = '';
    for (const docSnap of snapshot.docs) {
      const post = docSnap.data();
      const postId = docSnap.id;
      
      // Получаем количество лайков
      const likesQuery = query(collection(db, "likes"), where("postId", "==", postId));
      const likesSnapshot = await getDocs(likesQuery);
      const likesCount = likesSnapshot.size;
      
      // Проверяем, лайкнул ли текущий пользователь
      let userLiked = false;
      if (user) {
        const userLikeQuery = query(
          collection(db, "likes"), 
          where("postId", "==", postId),
          where("userId", "==", user.uid)
        );
        const userLikeSnapshot = await getDocs(userLikeQuery);
        userLiked = !userLikeSnapshot.empty;
      }
      
      // Получаем комментарии
      const commentsQuery = query(
        collection(db, "comments"), 
        where("postId", "==", postId),
        orderBy("createdAt", "asc")
      );
      const commentsSnapshot = await getDocs(commentsQuery);
      const comments = [];
      commentsSnapshot.forEach(comm => comments.push(comm.data()));
      
      // Генерируем HTML для поста
      html += `
        <div class="post-card" data-post-id="${postId}">
          <div class="post-header">
            <div class="post-title">${escapeHtml(post.title)}</div>
            ${isAdmin ? `<button class="delete-post-btn" data-post-id="${postId}" title="Удалить запись">🗑️</button>` : ''}
          </div>
          <div class="post-meta">${post.author || 'Аноним'} | ${post.createdAt ? new Date(post.createdAt.toDate()).toLocaleString() : ''}</div>
          <div class="post-content">${escapeHtml(post.content)}</div>
          
          <div class="post-actions">
            <button class="like-btn ${userLiked ? 'liked' : ''}" data-post-id="${postId}">
              ❤️ <span class="likes-count">${likesCount}</span>
            </button>
          </div>
          
          <div class="comments-section">
            <div class="comments-list">
              ${comments.map(c => `
                <div class="comment">
                  <span class="comment-author">${escapeHtml(c.authorEmail || 'Аноним')}</span>
                  <span class="comment-text">${escapeHtml(c.text)}</span>
                  <span class="comment-time">${c.createdAt ? new Date(c.createdAt.toDate()).toLocaleString() : ''}</span>
                </div>
              `).join('')}
            </div>
            ${user ? `
              <form class="add-comment-form" data-post-id="${postId}">
                <input type="text" class="comment-input" placeholder="Ваш комментарий..." required>
                <button type="submit">Отправить</button>
              </form>
            ` : '<p class="login-to-comment">Войдите, чтобы комментировать</p>'}
          </div>
        </div>
      `;
    }
    postsContainer.innerHTML = html;
    
    // Добавляем обработчики событий
    attachEventListeners();
    
  } catch (error) {
    console.error(error);
    postsContainer.innerHTML = '<p>Ошибка загрузки записей.</p>';
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// -------------------- Обработчики событий --------------------
function attachEventListeners() {
  // Лайки
  document.querySelectorAll('.like-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const user = auth.currentUser;
      if (!user) {
        alert('Войдите, чтобы ставить лайки');
        return;
      }
      
      const postId = btn.dataset.postId;
      const likesCountSpan = btn.querySelector('.likes-count');
      
      const likeQuery = query(
        collection(db, "likes"),
        where("postId", "==", postId),
        where("userId", "==", user.uid)
      );
      const snapshot = await getDocs(likeQuery);
      
      if (snapshot.empty) {
        await addDoc(collection(db, "likes"), {
          postId,
          userId: user.uid,
          createdAt: serverTimestamp()
        });
        btn.classList.add('liked');
        likesCountSpan.textContent = parseInt(likesCountSpan.textContent) + 1;
      } else {
        const likeDoc = snapshot.docs[0];
        await deleteDoc(doc(db, "likes", likeDoc.id));
        btn.classList.remove('liked');
        likesCountSpan.textContent = parseInt(likesCountSpan.textContent) - 1;
      }
    });
  });
  
  // Комментарии
  document.querySelectorAll('.add-comment-form').forEach(form => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const user = auth.currentUser;
      if (!user) {
        alert('Войдите, чтобы комментировать');
        return;
      }
      
      const postId = form.dataset.postId;
      const input = form.querySelector('.comment-input');
      const text = input.value.trim();
      if (!text) return;
      
      try {
        await addDoc(collection(db, "comments"), {
          postId,
          text,
          authorEmail: user.email,
          userId: user.uid,
          createdAt: serverTimestamp()
        });
        input.value = '';
        loadPosts(); // перезагружаем
      } catch (error) {
        alert('Ошибка: ' + error.message);
      }
    });
  });

  // Удаление постов (только для админа)
  document.querySelectorAll('.delete-post-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const user = auth.currentUser;
      if (!user || user.email !== ADMIN_EMAIL) {
        alert('Только администратор может удалять посты');
        return;
      }
      
      const postId = btn.dataset.postId;
      if (!confirm('Удалить эту запись навсегда?')) return;
      
      try {
        // Удаляем сам пост
        await deleteDoc(doc(db, "posts", postId));
        
        // Удаляем связанные лайки и комментарии (опционально, можно оставить, но для чистоты лучше удалить)
        const likesQuery = query(collection(db, "likes"), where("postId", "==", postId));
        const likesSnapshot = await getDocs(likesQuery);
        likesSnapshot.forEach(async (likeDoc) => {
          await deleteDoc(doc(db, "likes", likeDoc.id));
        });
        
        const commentsQuery = query(collection(db, "comments"), where("postId", "==", postId));
        const commentsSnapshot = await getDocs(commentsQuery);
        commentsSnapshot.forEach(async (commDoc) => {
          await deleteDoc(doc(db, "comments", commDoc.id));
        });
        
        loadPosts(); // обновляем ленту
      } catch (error) {
        alert('Ошибка удаления: ' + error.message);
      }
    });
  });
}

// -------------------- Добавление поста (только админ) --------------------
addPostForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) {
    alert('Войдите, чтобы публиковать');
    return;
  }
  
  if (user.email !== ADMIN_EMAIL) {
    alert('Только администратор может публиковать записи');
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
    loadPosts();
  } catch (error) {
    alert('Ошибка: ' + error.message);
  }
});

// -------------------- Отслеживание состояния входа --------------------
onAuthStateChanged(auth, (user) => {
  renderAuthUI(user);
  loadPosts();
});
