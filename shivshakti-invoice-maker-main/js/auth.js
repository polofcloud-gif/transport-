// ============================================================
// auth.js — Login screen, password change & recovery UI
// ============================================================

import { showToast, navigate } from './app.js';
import {
  Users, ensureSeeded, currentUser, isAuthenticated, isAdmin,
  startSession, endSession, DEFAULT_PASSWORD, DEFAULT_QUESTION, RECOVERY_QUESTIONS
} from './users.js';

export { isAuthenticated, isAdmin, currentUser };

export function getUsername() {
  return currentUser()?.username || '';
}

export function logout() {
  endSession();
  applyAuthUI();
  renderLogin();
}

// ── UI helpers ───────────────────────────────────────────────

export function applyAuthUI() {
  const user = currentUser();
  document.body.classList.toggle('locked', !user);
  document.body.classList.toggle('is-admin', user?.role === 'admin');
  const label = document.getElementById('sidebar-user');
  if (label) label.textContent = user ? `${user.name} (${user.role})` : '';
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str == null ? '' : String(str);
  return d.innerHTML;
}

/** Build a standard modal overlay; returns { overlay, close }. */
export function buildModal(title, bodyHtml, actionsHtml) {
  document.querySelector('.modal-overlay.auth-modal')?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay auth-modal';
  overlay.innerHTML = `
    <div class="modal-card">
      <div class="modal-header">${title}</div>
      <div class="modal-body">${bodyHtml}</div>
      <div class="modal-actions">${actionsHtml}</div>
    </div>
  `;
  document.body.appendChild(overlay);
  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  };
  function onKey(e) { if (e.key === 'Escape') close(); }
  document.addEventListener('keydown', onKey);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  return { overlay, close };
}

// ── Login screen ─────────────────────────────────────────────

export async function renderLogin() {
  await ensureSeeded();
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="login-screen">
      <form class="login-card" id="login-form" autocomplete="on">
        <img src="assets/logo.png" alt="Company logo" class="login-logo">
        <h1 class="login-title">SHIVSHAKTI<br>TRANSPORT COMPANY</h1>
        <p class="login-sub">Invoice Generator — Secure Sign In</p>

        <div class="form-group">
          <label for="login-user">Username</label>
          <input type="text" id="login-user" name="username" autocomplete="username" placeholder="Enter username (e.g. Pol)" required>
        </div>
        <div class="form-group">
          <label for="login-pass">Password</label>
          <input type="password" id="login-pass" name="password" autocomplete="current-password" placeholder="Enter password" required>
        </div>

        <label class="login-remember">
          <input type="checkbox" id="login-remember">
          <span>Remember me on this device</span>
        </label>

        <div class="login-error" id="login-error" hidden></div>

        <button type="submit" class="btn btn-primary btn-lg login-btn">🔐 Sign In</button>

        <button type="button" class="link-btn" id="forgot-link">Forgot password?</button>

        <p class="login-hint">Admin account: <strong>Pol</strong> (or <strong>admin2</strong>, <strong>admin3</strong>, <strong>admin4</strong>) — default password <strong>${DEFAULT_PASSWORD}</strong>. Change it after signing in.</p>
      </form>
    </div>
  `;

  const errBox = document.getElementById('login-error');

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    errBox.hidden = true;
    const username = document.getElementById('login-user').value;
    const password = document.getElementById('login-pass').value;
    const remember = document.getElementById('login-remember').checked;

    const res = await Users.verify(username, password);
    if (res.ok) {
      startSession(res.user.username, remember);
      applyAuthUI();
      showToast(`Welcome back, ${res.user.name}!`, 'success');
      navigate('dashboard');
    } else {
      errBox.textContent = res.error;
      errBox.hidden = false;
      document.getElementById('login-pass').value = '';
    }
  });

  document.getElementById('forgot-link').addEventListener('click', openRecoveryModal);
  document.getElementById('login-user').focus();
}

// ── Change password modal ────────────────────────────────────

export function openPasswordModal() {
  const user = currentUser();
  if (!user) return;

  const { overlay, close } = buildModal('🔑 Change Password', `
    <div class="form-group">
      <label>Signed in as</label>
      <input type="text" value="${esc(user.username)}" disabled>
    </div>
    <div class="form-group">
      <label for="pw-current">Current Password</label>
      <input type="password" id="pw-current" placeholder="Current password" autocomplete="current-password">
    </div>
    <div class="form-group">
      <label for="pw-new">New Password</label>
      <input type="password" id="pw-new" placeholder="At least 4 characters" autocomplete="new-password">
    </div>
    <div class="form-group">
      <label for="pw-confirm">Confirm New Password</label>
      <input type="password" id="pw-confirm" placeholder="Repeat new password" autocomplete="new-password">
    </div>
    <div class="form-group">
      <label for="pw-question">Recovery Question</label>
      <select id="pw-question" style="width:100%; padding:9px 12px; border:1px solid #cbd5e1; border-radius:8px; font-size:14px; background:#fff; color:#0f172a;">
        ${RECOVERY_QUESTIONS.map(q => `<option value="${esc(q)}" ${q === (user.question || DEFAULT_QUESTION) ? 'selected' : ''}>${esc(q)}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label for="pw-answer">Recovery Answer <span style="font-weight:400;opacity:.7">(leave blank to keep current)</span></label>
      <input type="text" id="pw-answer" placeholder="Secret answer">
    </div>
    <div class="login-error" id="pw-error" hidden></div>
  `, `
    <button class="btn btn-secondary" id="pw-cancel">Cancel</button>
    <button class="btn btn-primary" id="pw-save">💾 Save Password</button>
  `);

  overlay.querySelector('#pw-cancel').addEventListener('click', close);

  overlay.querySelector('#pw-save').addEventListener('click', async () => {
    const errBox = overlay.querySelector('#pw-error');
    errBox.hidden = true;
    const show = (msg) => { errBox.textContent = msg; errBox.hidden = false; };

    const current = overlay.querySelector('#pw-current').value;
    const next = overlay.querySelector('#pw-new').value;
    const confirmPw = overlay.querySelector('#pw-confirm').value;
    const question = overlay.querySelector('#pw-question').value;
    const answer = overlay.querySelector('#pw-answer').value;

    const check = await Users.verify(user.username, current);
    if (!check.ok) return show('Current password is incorrect.');
    if (next !== confirmPw) return show('New passwords do not match.');
    if (!next) return show('Please enter a new password.');

    const res = await Users.update(user.id, { password: next, question, answer });
    if (!res.ok) return show(res.error);

    close();
    showToast('Password updated successfully', 'success');
  });

  overlay.querySelector('#pw-current').focus();
}

// ── Forgot password (recovery) flow ──────────────────────────

export function openRecoveryModal() {
  const { overlay, close } = buildModal('🔒 Password Recovery', `
    <p class="modal-note">Enter your username to answer your recovery question.</p>
    <div class="form-group">
      <label for="rec-user">Username</label>
      <input type="text" id="rec-user" placeholder="Your username">
    </div>
    <div id="rec-step2" hidden>
      <div class="form-group">
        <label id="rec-question-label">Recovery Question</label>
        <input type="text" id="rec-answer" placeholder="Your secret answer">
      </div>
      <div class="form-group">
        <label for="rec-new">New Password</label>
        <input type="password" id="rec-new" placeholder="At least 4 characters" autocomplete="new-password">
      </div>
      <div class="form-group">
        <label for="rec-confirm">Confirm New Password</label>
        <input type="password" id="rec-confirm" placeholder="Repeat new password" autocomplete="new-password">
      </div>
    </div>
    <div class="login-error" id="rec-error" hidden></div>
  `, `
    <button class="btn btn-secondary" id="rec-cancel">Cancel</button>
    <button class="btn btn-primary" id="rec-next">Continue →</button>
  `);

  const errBox = overlay.querySelector('#rec-error');
  const show = (msg) => { errBox.textContent = msg; errBox.hidden = false; };
  const nextBtn = overlay.querySelector('#rec-next');
  overlay.querySelector('#rec-cancel').addEventListener('click', close);

  nextBtn.addEventListener('click', async () => {
    errBox.hidden = true;
    const username = overlay.querySelector('#rec-user').value;
    const step2 = overlay.querySelector('#rec-step2');

    if (step2.hidden) {
      const user = Users.getByUsername(username);
      if (!user) return show('No account found with that username.');
      if (!user.active) return show('This account is deactivated. Ask an admin to reactivate it.');
      overlay.querySelector('#rec-question-label').textContent = user.question || DEFAULT_QUESTION;
      step2.hidden = false;
      overlay.querySelector('#rec-user').disabled = true;
      nextBtn.textContent = '🔓 Reset Password';
      overlay.querySelector('#rec-answer').focus();
      return;
    }

    const answer = overlay.querySelector('#rec-answer').value;
    const next = overlay.querySelector('#rec-new').value;
    const confirmPw = overlay.querySelector('#rec-confirm').value;

    const check = await Users.verifyAnswer(username, answer);
    if (!check.ok) return show(check.error);
    if (!next || next.length < 4) return show('New password must be at least 4 characters.');
    if (next !== confirmPw) return show('New passwords do not match.');

    const res = await Users.update(check.user.id, { password: next });
    if (!res.ok) return show(res.error);

    close();
    showToast('Password reset — you can sign in now', 'success');
  });

  overlay.querySelector('#rec-user').focus();
}
