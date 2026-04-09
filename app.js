import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile
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
  where,
  deleteDoc,
  setDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";

const auth = window.auth;
const db = window.db;
const ADMIN_EMAIL = 'krytoidanila0@gmail.com';

const authArea = document.getElementById('auth-area');
const addPostSection = document.getElementById('add-post-section');
const postsContainer = document.getElementById('posts-container');
const addPostForm = document.getElementById('add-post-form');
const mediaUrlInput = document.getElementById('media-url');
const mediaPreview = document.getElementById('media-preview');

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

// -------------------- Вспомогательные функции --------------------
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function getUserProfile(user) {
  if (!user) return null;
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    return userSnap.data();
  } else {
    let username = user.displayName || user.email.split('@')[0];
    const profile = {
      uid: user.uid,
      email: user.email,
      username: username,
      createdAt: serverTimestamp()
    };
    await setDoc(userRef, profile);
    return profile;
  }
}

async function getUserProfileById(uid) {
  const docRef = doc(db, "users", uid);
  const snap = await getDoc(docRef);
  return snap.exists() ? snap.data() : null;
}

// -------------------- Предпросмотр медиа по ссылке --------------------
function renderMediaPreviewFromUrl(url) {
  if (!url) {
    mediaPreview.innerHTML = '';
    return;
  }

  // YouTube
  const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/;
  const ytMatch = url.match(youtubeRegex);
  if (ytMatch) {
    const videoId = ytMatch[1];
    mediaPreview.innerHTML = `
      <iframe width="100%" height="200" src="https://www.youtube.com/embed/${videoId}" 
        frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen>
      </iframe>
    `;
    return;
  }

  // Прямые ссылки на изображения и видео
  const isImage = /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(url) || url.includes('image');
  const isVideo = /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url) || url.includes('video');

  if (isImage) {
    mediaPreview.innerHTML = `<img src="${escapeHtml(url)}" alt="Preview">`;
  } else if (isVideo) {
    mediaPreview.innerHTML = `
      <video controls>
        <source src="${escapeHtml(url)}">
        Ваш браузер не поддерживает видео.
      </video>
    `;
  } else {
    mediaPreview.innerHTML = `<p>🔗 Ссылка добавлена. Предпросмотр недоступен.</p>`;
  }
}

// Обработчик ввода URL
mediaUrlInput.addEventListener('input', (e) => {
  renderMediaPreviewFromUrl(e.target.value.trim());
});

// -------------------- Рендеринг интерфейса --------------------
async function renderAuthUI(user) {
  if (user) {
    const profile = await getUserProfile(user);
    const displayName = profile?.username || user.email;
    authArea.innerHTML = `
      <span>${escapeHtml(displayName)}</span>
      <button id="logout-btn">Выйти</button>
    `;
    document.getElementById('logout-btn').addEventListener('click', async () => {
      await signOut(auth);
    });
    addPostSection.style.display = (user.email === ADMIN_EMAIL) ? 'block' : 'none';
  } else {
    authArea.innerHTML = `
      <div id="auth-forms">
        <input type="email" id="login-email" placeholder="Email" size="15">
        <input type="password" id="login-password" placeholder="Пароль" size="10">
        <input type="text" id="signup-username" placeholder="Никнейм" size="12" style="display:none;">
        <button id="login-btn">Войти</button>
        <button id="signup-btn">Регистрация</button>
        <button id="google-login-btn">Войти через Google</button>
      </div>
    `;
    addPostSection.style.display = 'none';
    attachGuestEventListeners();
  }
}

function attachGuestEventListeners() {
  const loginBtn = document.getElementById('login-btn');
  const signupBtn = document.getElementById('signup-btn');
  const googleBtn = document.getElementById('google-login-btn');
  const emailInput = document.getElementById('login-email');
  const passInput = document.getElementById('login-password');
  const usernameInput = document.getElementById('signup-username');

  loginBtn.addEventListener('click', async () => {
    try {
      await signInWithEmailAndPassword(auth, emailInput.value, passInput.value);
    } catch (error) {
      alert('Ошибка входа: ' + error.message);
    }
  });

  signupBtn.addEventListener('click', async () => {
    if (signupBtn.textContent === 'Регистрация') {
      usernameInput.style.display = 'inline-block';
      signupBtn.textContent = 'Подтвердить';
    } else {
      const username = usernameInput.value.trim();
      if (!username) {
        alert('Введите никнейм');
        return;
      }
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, emailInput.value, passInput.value);
        await setDoc(doc(db, "users", userCredential.user.uid), {
          uid: userCredential.user.uid,
          email: emailInput.value,
          username: username,
          createdAt: serverTimestamp()
        });
        await updateProfile(userCredential.user, { displayName: username });
      } catch (error) {
        alert('Ошибка регистрации: ' + error.message);
      }
    }
  });

  googleBtn.addEventListener('click', async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      await getUserProfile(result.user);
    } catch (error) {
      alert('Ошибка входа через Google: ' + error.message);
    }
  });
}

// -------------------- Загрузка постов --------------------
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
      
      let authorName = post.authorEmail;
      if (post.authorId) {
        const authorProfile = await getUserProfileById(post.authorId);
        if (authorProfile) authorName = authorProfile.username || authorProfile.email;
      }
      
      const likesQuery = query(collection(db, "likes"), where("postId", "==", postId));
      const likesSnapshot = await getDocs(likesQuery);
      const likesCount = likesSnapshot.size;
      
      let userLiked = false;
      if (user) {
        const userLikeQuery = query(
          collection(db, "likes"), 
          where("postId", "==", postId),
          where("userId", "==", user.uid)
        );
        userLiked = !(await getDocs(userLikeQuery)).empty;
      }
      
      const commentsQuery = query(
        collection(db, "comments"), 
        where("postId", "==", postId),
        orderBy("createdAt", "asc")
      );
      const commentsSnapshot = await getDocs(commentsQuery);
      const comments = [];
      for (const commDoc of commentsSnapshot.docs) {
        const comm = commDoc.data();
        let commentAuthor = comm.authorEmail;
        if (comm.userId) {
          const profile = await getUserProfileById(comm.userId);
          if (profile) commentAuthor = profile.username || profile.email;
        }
        comments.push({
          ...comm,
          authorName: commentAuthor
        });
      }

      // Формируем медиа-контент
      let mediaHtml = '';
      if (post.mediaUrl) {
        const url = post.mediaUrl;
        const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/;
        const ytMatch = url.match(youtubeRegex);
        if (ytMatch) {
          const videoId = ytMatch[1];
          mediaHtml = `
            <div class="post-media embed-video">
              <iframe src="https://www.youtube.com/embed/${videoId}" 
                frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen>
              </iframe>
            </div>
          `;
        } else {
          const isImage = /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(url);
          const isVideo = /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url);
          if (isImage) {
            mediaHtml = `<img src="${escapeHtml(url)}" alt="Post media" class="post-media">`;
          } else if (isVideo) {
            mediaHtml = `<video controls class="post-media"><source src="${escapeHtml(url)}"></video>`;
          } else {
            mediaHtml = `<p><a href="${escapeHtml(url)}" target="_blank" style="color:#0f0;">🔗 Ссылка на материал</a></p>`;
          }
        }
      }

      html += `
        <div class="post-card" data-post-id="${postId}">
          <div class="post-header">
            <div class="post-title">${escapeHtml(post.title)}</div>
            ${isAdmin ? `<button class="delete-post-btn" data-post-id="${postId}">🗑️</button>` : ''}
          </div>
          <div class="post-meta">${escapeHtml(authorName)} | ${post.createdAt ? new Date(post.createdAt.toDate()).toLocaleString() : ''}</div>
          <div class="post-content">${escapeHtml(post.content)}</div>
          ${mediaHtml}
          
          <div class="post-actions">
            <button class="like-btn ${userLiked ? 'liked' : ''}" data-post-id="${postId}">
              ❤️ <span class="likes-count">${likesCount}</span>
            </button>
          </div>
          
          <div class="comments-section">
            <div class="comments-list">
              ${comments.map(c => `
                <div class="comment">
                  <span class="comment-author">${escapeHtml(c.authorName)}</span>
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
    attachPostEventListeners();
  } catch (error) {
    console.error(error);
    postsContainer.innerHTML = '<p>Ошибка загрузки записей.</p>';
  }
}

function attachPostEventListeners() {
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
        loadPosts();
      } catch (error) {
        alert('Ошибка: ' + error.message);
      }
    });
  });

  // Удаление постов
  document.querySelectorAll('.delete-post-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const user = auth.currentUser;
      if (!user || user.email !== ADMIN_EMAIL) return;
      const postId = btn.dataset.postId;
      if (!confirm('Удалить эту запись навсегда?')) return;
      try {
        await deleteDoc(doc(db, "posts", postId));
        const likesQuery = query(collection(db, "likes"), where("postId", "==", postId));
        (await getDocs(likesQuery)).forEach(async d => await deleteDoc(doc(db, "likes", d.id)));
        const commentsQuery = query(collection(db, "comments"), where("postId", "==", postId));
        (await getDocs(commentsQuery)).forEach(async d => await deleteDoc(doc(db, "comments", d.id)));
        loadPosts();
      } catch (error) {
        alert('Ошибка удаления: ' + error.message);
      }
    });
  });
}

// -------------------- Добавление поста --------------------
addPostForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user || user.email !== ADMIN_EMAIL) {
    alert('Только администратор может публиковать');
    return;
  }
  const title = document.getElementById('post-title').value.trim();
  const content = document.getElementById('post-content').value.trim();
  const mediaUrl = mediaUrlInput.value.trim();
  
  if (!title || !content) return;

  try {
    await addDoc(collection(db, "posts"), {
      title,
      content,
      mediaUrl: mediaUrl || null,
      authorEmail: user.email,
      authorId: user.uid,
      createdAt: serverTimestamp()
    });
    addPostForm.reset();
    mediaPreview.innerHTML = '';
    loadPosts();
  } catch (error) {
    alert('Ошибка: ' + error.message);
  }
});

// -------------------- Отслеживание состояния --------------------
onAuthStateChanged(auth, (user) => {
  renderAuthUI(user);
  loadPosts();
});
