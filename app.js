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

const ADMIN_EMAILS = ['krytoidanila0@gmail.com', 'olenkakrasavica88@gmail.com'];

function isAdmin(user) {
  return user && ADMIN_EMAILS.includes(user.email);
}

const authArea = document.getElementById('auth-area');
const addPostSection = document.getElementById('add-post-section');
const postsContainer = document.getElementById('posts-container');
const addPostForm = document.getElementById('add-post-form');
const mediaUrlInput = document.getElementById('media-url');
const mediaPreview = document.getElementById('media-preview');
const adminPanel = document.getElementById('admin-panel');
const adminLists = document.getElementById('admin-lists');
const modal = document.getElementById('mod-modal');
const modalUserInfo = document.getElementById('modal-user-info');
const modalBanBtn = document.getElementById('modal-ban-btn');
const modalMuteBtn = document.getElementById('modal-mute-btn');
const modalDeleteCommentsBtn = document.getElementById('modal-delete-comments-btn');
const modalMuteDurationDiv = document.getElementById('modal-mute-duration');
const muteDurationInput = document.getElementById('mute-duration');
const applyMuteBtn = document.getElementById('apply-mute-btn');
const closeModalBtn = document.querySelector('.close-modal');

let currentTargetUser = null;

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
      createdAt: serverTimestamp(),
      ip: await getUserIP()
    };
    await setDoc(userRef, profile);
    return profile;
  }
}

async function getUserProfileById(uid) {
  if (!uid) return null;
  const docRef = doc(db, "users", uid);
  const snap = await getDoc(docRef);
  return snap.exists() ? snap.data() : null;
}

async function getUserIP() {
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    const data = await res.json();
    return data.ip;
  } catch (e) {
    return 'unknown';
  }
}

async function isUserBanned(uid, email, ip) {
  const bansSnapshot = await getDocs(collection(db, "bans"));
  for (const doc of bansSnapshot.docs) {
    const ban = doc.data();
    if (ban.uid === uid || ban.email === email || (ip && ban.ip === ip)) {
      return ban;
    }
  }
  return null;
}

async function isUserMuted(uid) {
  if (!uid) return false;
  const mutesSnapshot = await getDocs(query(collection(db, "mutes"), where("uid", "==", uid)));
  if (mutesSnapshot.empty) return false;
  const mute = mutesSnapshot.docs[0].data();
  return mute.expiresAt.toMillis() > Date.now();
}

function renderMediaPreviewFromUrl(url) {
  if (!url) { mediaPreview.innerHTML = ''; return; }
  const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/;
  const ytMatch = url.match(youtubeRegex);
  if (ytMatch) {
    const videoId = ytMatch[1];
    mediaPreview.innerHTML = `<iframe width="100%" height="200" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>`;
    return;
  }
  const isImage = /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(url);
  const isVideo = /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url);
  if (isImage) {
    mediaPreview.innerHTML = `<img src="${escapeHtml(url)}" alt="Preview">`;
  } else if (isVideo) {
    mediaPreview.innerHTML = `<video controls><source src="${escapeHtml(url)}"></video>`;
  } else {
    mediaPreview.innerHTML = `<p>🔗 Ссылка добавлена. Предпросмотр недоступен.</p>`;
  }
}
mediaUrlInput.addEventListener('input', (e) => renderMediaPreviewFromUrl(e.target.value.trim()));

async function renderAuthUI(user) {
  if (user) {
    const ip = await getUserIP();
    const ban = await isUserBanned(user.uid, user.email, ip);
    if (ban) {
      alert(`Ваш аккаунт заблокирован. Причина: ${ban.reason || 'не указана'}`);
      await signOut(auth);
      return;
    }

    const profile = await getUserProfile(user);
    const displayName = profile?.username || user.email;
    authArea.innerHTML = `
      <span>${escapeHtml(displayName)}</span>
      <button id="logout-btn">Выйти</button>
    `;
    document.getElementById('logout-btn').addEventListener('click', async () => {
      await signOut(auth);
    });
    
    const admin = isAdmin(user);
    addPostSection.style.display = admin ? 'block' : 'none';
    adminPanel.style.display = admin ? 'block' : 'none';
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
    adminPanel.style.display = 'none';
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
      const userCredential = await signInWithEmailAndPassword(auth, emailInput.value, passInput.value);
      const ip = await getUserIP();
      const ban = await isUserBanned(userCredential.user.uid, userCredential.user.email, ip);
      if (ban) {
        alert(`Ваш аккаунт заблокирован. Причина: ${ban.reason || 'не указана'}`);
        await signOut(auth);
      }
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
      if (!username) { alert('Введите никнейм'); return; }
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, emailInput.value, passInput.value);
        const ip = await getUserIP();
        await setDoc(doc(db, "users", userCredential.user.uid), {
          uid: userCredential.user.uid,
          email: emailInput.value,
          username: username,
          createdAt: serverTimestamp(),
          ip: ip
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
      const ip = await getUserIP();
      const ban = await isUserBanned(result.user.uid, result.user.email, ip);
      if (ban) {
        alert(`Ваш аккаунт заблокирован. Причина: ${ban.reason || 'не указана'}`);
        await signOut(auth);
      } else {
        await getUserProfile(result.user);
      }
    } catch (error) {
      alert('Ошибка входа через Google: ' + error.message);
    }
  });
}

async function loadPosts() {
  postsContainer.innerHTML = 'Загрузка...';
  const user = auth.currentUser;
  const admin = isAdmin(user);
  
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
      
      const likesSnapshot = await getDocs(query(collection(db, "likes"), where("postId", "==", postId)));
      const likesCount = likesSnapshot.size;
      
      let userLiked = false;
      if (user) {
        const userLikeSnapshot = await getDocs(query(collection(db, "likes"), where("postId", "==", postId), where("userId", "==", user.uid)));
        userLiked = !userLikeSnapshot.empty;
      }
      
      const commentsSnapshot = await getDocs(query(collection(db, "comments"), where("postId", "==", postId), orderBy("createdAt", "asc")));
      const comments = [];
      for (const commDoc of commentsSnapshot.docs) {
        const comm = commDoc.data();
        let commentAuthor = comm.authorEmail;
        if (comm.userId) {
          const profile = await getUserProfileById(comm.userId);
          if (profile) commentAuthor = profile.username || profile.email;
        }
        comments.push({
          id: commDoc.id,
          ...comm,
          authorName: commentAuthor,
          authorUid: comm.userId
        });
      }

      let mediaHtml = '';
      if (post.mediaUrl) {
        const url = post.mediaUrl;
        const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
        if (ytMatch) {
          mediaHtml = `<div class="post-media embed-video"><iframe src="https://www.youtube.com/embed/${ytMatch[1]}" frameborder="0" allowfullscreen></iframe></div>`;
        } else {
          const isImage = /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(url);
          const isVideo = /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url);
          if (isImage) mediaHtml = `<img src="${escapeHtml(url)}" alt="Post media" class="post-media">`;
          else if (isVideo) mediaHtml = `<video controls class="post-media"><source src="${escapeHtml(url)}"></video>`;
          else mediaHtml = `<p><a href="${escapeHtml(url)}" target="_blank" style="color:#0f0;">🔗 Ссылка на материал</a></p>`;
        }
      }

      html += `
        <div class="post-card" data-post-id="${postId}">
          <div class="post-header">
            <div class="post-title">${escapeHtml(post.title)}</div>
            ${admin ? `<button class="delete-post-btn" data-post-id="${postId}">🗑️</button>` : ''}
          </div>
          <div class="post-meta">
            <span class="author-name" data-uid="${post.authorId || ''}" data-email="${escapeHtml(post.authorEmail)}">${escapeHtml(authorName)}</span> | ${post.createdAt ? new Date(post.createdAt.toDate()).toLocaleString() : ''}
          </div>
          <div class="post-content" data-full-content="${escapeHtml(post.content)}">
            ${escapeHtml(post.content)}
          </div>
          ${mediaHtml}
          
          <div class="post-actions">
            <button class="like-btn ${userLiked ? 'liked' : ''}" data-post-id="${postId}">❤️ <span class="likes-count">${likesCount}</span></button>
          </div>
          
          <div class="comments-section">
            <div class="comments-list" data-post-id="${postId}">
              ${comments.map(c => `
                <div class="comment" data-comment-id="${c.id}">
                  <span class="comment-author" data-uid="${c.authorUid || ''}" data-email="${escapeHtml(c.authorEmail)}">${escapeHtml(c.authorName)}</span>
                  <span class="comment-text">${escapeHtml(c.text)}</span>
                  <span class="comment-time">${c.createdAt ? new Date(c.createdAt.toDate()).toLocaleString() : ''}</span>
                  ${(admin || (user && user.uid === c.authorUid)) ? `<button class="comment-delete-btn" data-comment-id="${c.id}">🗑️</button>` : ''}
                </div>
              `).join('')}
            </div>
            ${user ? `<form class="add-comment-form" data-post-id="${postId}"><input type="text" class="comment-input" placeholder="Ваш комментарий..." required><button type="submit">Отправить</button></form>` : '<p class="login-to-comment">Войдите, чтобы комментировать</p>'}
          </div>
        </div>
      `;
    }
    postsContainer.innerHTML = html;
    
    document.querySelectorAll('.post-content').forEach(el => {
      const fullText = el.dataset.fullContent;
      if (fullText.length > 500) {
        const truncated = fullText.substring(0, 500) + '...';
        el.textContent = truncated;
        el.classList.add('collapsed');
        const btn = document.createElement('button');
        btn.className = 'read-more-btn';
        btn.textContent = 'Читать дальше';
        btn.addEventListener('click', () => {
          el.textContent = fullText;
          el.classList.remove('collapsed');
          btn.remove();
        });
        el.parentNode.insertBefore(btn, el.nextSibling);
      }
    });
    
    attachPostEventListeners(admin, user);
    attachModerationListeners(admin, user);
  } catch (error) {
    console.error(error);
    postsContainer.innerHTML = '<p>Ошибка загрузки записей.</p>';
  }
}

function attachPostEventListeners(admin, user) {
  document.querySelectorAll('.like-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      if (!user) { alert('Войдите, чтобы ставить лайки'); return; }
      if (await isUserMuted(user.uid)) { alert('Вы замучены и не можете ставить лайки'); return; }
      
      const postId = btn.dataset.postId;
      const likesCountSpan = btn.querySelector('.likes-count');
      const likeQuery = query(collection(db, "likes"), where("postId", "==", postId), where("userId", "==", user.uid));
      const snapshot = await getDocs(likeQuery);
      if (snapshot.empty) {
        await addDoc(collection(db, "likes"), { postId, userId: user.uid, createdAt: serverTimestamp() });
        btn.classList.add('liked');
        likesCountSpan.textContent = parseInt(likesCountSpan.textContent) + 1;
      } else {
        await deleteDoc(doc(db, "likes", snapshot.docs[0].id));
        btn.classList.remove('liked');
        likesCountSpan.textContent = parseInt(likesCountSpan.textContent) - 1;
      }
    });
  });
  
  document.querySelectorAll('.add-comment-form').forEach(form => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!user) { alert('Войдите, чтобы комментировать'); return; }
      if (await isUserMuted(user.uid)) { alert('Вы замучены и не можете комментировать'); return; }
      
      const postId = form.dataset.postId;
      const input = form.querySelector('.comment-input');
      const text = input.value.trim();
      if (!text) return;
      
      try {
        const docRef = await addDoc(collection(db, "comments"), {
          postId, text,
          authorEmail: user.email,
          userId: user.uid,
          createdAt: serverTimestamp()
        });
        input.value = '';
        
        const commentsList = document.querySelector(`.comments-list[data-post-id="${postId}"]`);
        if (commentsList) {
          const profile = await getUserProfile(user);
          const authorName = profile?.username || user.email;
          const commentHtml = `
            <div class="comment" data-comment-id="${docRef.id}">
              <span class="comment-author" data-uid="${user.uid}" data-email="${escapeHtml(user.email)}">${escapeHtml(authorName)}</span>
              <span class="comment-text">${escapeHtml(text)}</span>
              <span class="comment-time">только что</span>
              ${(admin || (user && user.uid === user.uid)) ? `<button class="comment-delete-btn" data-comment-id="${docRef.id}">🗑️</button>` : ''}
            </div>
          `;
          commentsList.insertAdjacentHTML('beforeend', commentHtml);
          const newDeleteBtn = commentsList.querySelector(`.comment:last-child .comment-delete-btn`);
          if (newDeleteBtn) {
            newDeleteBtn.addEventListener('click', deleteCommentHandler);
          }
        }
      } catch (error) {
        alert('Ошибка: ' + error.message);
      }
    });
  });

  document.querySelectorAll('.delete-post-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      if (!admin) return;
      const postId = btn.dataset.postId;
      if (!confirm('Удалить эту запись навсегда?')) return;
      try {
        await deleteDoc(doc(db, "posts", postId));
        const likesSnapshot = await getDocs(query(collection(db, "likes"), where("postId", "==", postId)));
        likesSnapshot.forEach(async d => await deleteDoc(doc(db, "likes", d.id)));
        const commentsSnapshot = await getDocs(query(collection(db, "comments"), where("postId", "==", postId)));
        commentsSnapshot.forEach(async d => await deleteDoc(doc(db, "comments", d.id)));
        document.querySelector(`.post-card[data-post-id="${postId}"]`)?.remove();
      } catch (error) { alert('Ошибка удаления: ' + error.message); }
    });
  });

  const deleteCommentHandler = async (e) => {
    e.preventDefault();
    const btn = e.currentTarget;
    const commentId = btn.dataset.commentId;
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const commentDoc = await getDoc(doc(db, "comments", commentId));
    if (!commentDoc.exists()) return;
    const comment = commentDoc.data();
    
    if (currentUser.uid !== comment.userId && !isAdmin(currentUser)) return;
    
    try {
      await deleteDoc(doc(db, "comments", commentId));
      btn.closest('.comment')?.remove();
    } catch (error) {
      alert('Ошибка удаления: ' + error.message);
    }
  };

  document.querySelectorAll('.comment-delete-btn').forEach(btn => {
    btn.addEventListener('click', deleteCommentHandler);
  });
}

async function showModModal(uid, email, username) {
  currentTargetUser = { uid, email, username };
  const profile = await getUserProfileById(uid);
  const ip = profile?.ip || 'неизвестен';
  currentTargetUser.ip = ip;
  modalUserInfo.innerHTML = `${escapeHtml(username)} (${escapeHtml(email)})<br>IP: ${ip}`;
  modal.style.display = 'flex';
}

function attachModerationListeners(admin, currentUser) {
  if (!admin && !currentUser) return;
  
  document.querySelectorAll('.comment-author, .author-name').forEach(el => {
    el.addEventListener('click', async (e) => {
      const uid = el.dataset.uid;
      const email = el.dataset.email;
      if (!uid && !email) return;
      
      if (admin) {
        await showModModal(uid, email, el.textContent);
      }
    });
  });
}

closeModalBtn.onclick = () => modal.style.display = 'none';
window.onclick = (e) => { if (e.target == modal) modal.style.display = 'none'; };

modalBanBtn.onclick = async () => {
  if (!currentTargetUser) return;
  const reason = prompt('Причина бана (опционально):');
  
  const banData = {
    uid: currentTargetUser.uid || null,
    email: currentTargetUser.email || null,
    ip: currentTargetUser.ip || null,
    reason: reason || '',
    bannedAt: serverTimestamp(),
    bannedBy: auth.currentUser.email
  };
  await addDoc(collection(db, "bans"), banData);
  alert('Пользователь забанен');
  modal.style.display = 'none';
};

modalMuteBtn.onclick = () => {
  modalMuteDurationDiv.style.display = 'block';
};

applyMuteBtn.onclick = async () => {
  if (!currentTargetUser || !currentTargetUser.uid) return;
  const minutes = parseInt(muteDurationInput.value);
  const expiresAt = new Date(Date.now() + minutes * 60000);
  await addDoc(collection(db, "mutes"), {
    uid: currentTargetUser.uid,
    email: currentTargetUser.email,
    expiresAt: expiresAt,
    mutedBy: auth.currentUser.email,
    createdAt: serverTimestamp()
  });
  alert(`Пользователь замучен на ${minutes} минут`);
  modal.style.display = 'none';
  modalMuteDurationDiv.style.display = 'none';
};

modalDeleteCommentsBtn.onclick = async () => {
  if (!currentTargetUser || !currentTargetUser.uid) return;
  if (!confirm(`Удалить ВСЕ комментарии пользователя ${currentTargetUser.username}?`)) return;
  const snapshot = await getDocs(query(collection(db, "comments"), where("userId", "==", currentTargetUser.uid)));
  snapshot.forEach(async d => await deleteDoc(doc(db, "comments", d.id)));
  alert('Комментарии удалены');
  modal.style.display = 'none';
  loadPosts();
};

document.getElementById('show-bans-btn')?.addEventListener('click', async () => {
  const snapshot = await getDocs(collection(db, "bans"));
  let html = '<h3>Забаненные</h3><ul>';
  snapshot.forEach(doc => {
    const ban = doc.data();
    html += `<li>${ban.email || ban.uid || ban.ip} (${ban.reason}) <button data-ban-id="${doc.id}" class="unban-btn">Разбанить</button></li>`;
  });
  html += '</ul>';
  adminLists.innerHTML = html;
  document.querySelectorAll('.unban-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      await deleteDoc(doc(db, "bans", btn.dataset.banId));
      alert('Бан снят');
      document.getElementById('show-bans-btn').click();
    });
  });
});

document.getElementById('show-mutes-btn')?.addEventListener('click', async () => {
  const snapshot = await getDocs(collection(db, "mutes"));
  let html = '<h3>Замученные</h3><ul>';
  snapshot.forEach(doc => {
    const mute = doc.data();
    const expires = mute.expiresAt.toDate().toLocaleString();
    html += `<li>${mute.email} до ${expires} <button data-mute-id="${doc.id}" class="unmute-btn">Снять мут</button></li>`;
  });
  html += '</ul>';
  adminLists.innerHTML = html;
  document.querySelectorAll('.unmute-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      await deleteDoc(doc(db, "mutes", btn.dataset.muteId));
      alert('Мут снят');
      document.getElementById('show-mutes-btn').click();
    });
  });
});

addPostForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const user = auth.currentUser;
  if (!isAdmin(user)) { alert('Только администратор может публиковать'); return; }
  const title = document.getElementById('post-title').value.trim();
  const content = document.getElementById('post-content').value.trim();
  const mediaUrl = mediaUrlInput.value.trim();
  if (!title || !content) return;
  try {
    await addDoc(collection(db, "posts"), {
      title, content, mediaUrl: mediaUrl || null,
      authorEmail: user.email,
      authorId: user.uid,
      createdAt: serverTimestamp()
    });
    addPostForm.reset();
    mediaPreview.innerHTML = '';
    loadPosts();
  } catch (error) { alert('Ошибка: ' + error.message); }
});

onAuthStateChanged(auth, (user) => {
  renderAuthUI(user);
  loadPosts();
});
