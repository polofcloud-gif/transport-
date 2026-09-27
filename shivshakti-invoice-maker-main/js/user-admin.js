// ============================================================
// user-admin.js — User management screen (admins only)
// ============================================================

import { showToast } from './app.js';
import { Users, currentUser, isAdmin, DEFAULT_QUESTION, RECOVERY_QUESTIONS } from './users.js';
import { buildModal } from './auth.js';

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str == null ? '' : String(str);
  return d.innerHTML;
}

export function renderUsers() {
  const app = document.getElementById('app');

  if (!isAdmin()) {
    app.innerHTML = `
      <div class="page-header"><h1>Users</h1></div>
      <div class="card"><div class="empty-state">
        <div class="empty-icon">🔒</div>
        <p>Only admin accounts can manage users.</p>
      </div></div>`;
    return;
  }

  app.innerHTML = `
    <div class="page-header">
      <h1>User Management</h1>
      <p>Create, edit and deactivate invoice app users</p>
    </div>

    <div class="card">
      <div class="search-bar">
        <input type="text" id="user-search" placeholder="🔍 Search by username or name...">
        <button class="btn btn-primary" id="add-user-btn">+ Add User</button>
      </div>
      <div id="users-table-container">${renderTable(Users.getAll())}</div>
    </div>
  `;

  document.getElementById('add-user-btn').addEventListener('click', () => openUserModal(null));
  document.getElementById('user-search').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    const list = Users.getAll().filter(u =>
      u.username.includes(q) || (u.name || '').toLowerCase().includes(q));
    document.getElementById('users-table-container').innerHTML = renderTable(list);
    bindRowActions();
  });

  bindRowActions();
}

function renderTable(users) {
  if (!users.length) {
    return `<div class="empty-state"><div class="empty-icon">👤</div><p>No users found.</p></div>`;
  }
  const me = currentUser();
  return `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr><th>Sr.</th><th>Username</th><th>Name</th><th>Role</th><th>Status</th><th>Actions</th></tr>
        </thead>
        <tbody>
          ${users.map((u, i) => `
            <tr>
              <td>${i + 1}</td>
              <td><strong>${esc(u.username)}</strong>${u.id === me?.id ? ' <span class="badge">you</span>' : ''}</td>
              <td>${esc(u.name || '-')}</td>
              <td>${u.role === 'admin' ? '🛡 Admin' : '👤 User'}</td>
              <td>${u.active ? '<span class="status-badge active">Active</span>' : '<span class="status-badge inactive">Inactive</span>'}</td>
              <td>
                <div class="btn-group" style="gap:6px;">
                  <button class="btn btn-sm btn-outline user-edit" data-id="${u.id}" title="Edit user">✏ Edit</button>
                  <button class="btn btn-sm ${u.active ? 'btn-secondary' : 'btn-primary'} user-toggle" data-id="${u.id}" title="${u.active ? 'Deactivate' : 'Activate'}">${u.active ? '🚫 Deactivate' : '✅ Activate'}</button>
                  <button class="btn btn-sm btn-danger user-delete" data-id="${u.id}" title="Delete user">🗑</button>
                </div>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function bindRowActions() {
  document.querySelectorAll('.user-edit').forEach(b =>
    b.addEventListener('click', () => openUserModal(b.dataset.id)));

  document.querySelectorAll('.user-toggle').forEach(b =>
    b.addEventListener('click', async () => {
      const u = Users.get(b.dataset.id);
      if (!u) return;
      const res = await Users.update(u.id, { active: !u.active });
      if (!res.ok) return showToast(res.error, 'error');
      showToast(`${u.username} ${u.active ? 'deactivated' : 'activated'}.`, u.active ? 'warning' : 'success');
      renderUsers();
    }));

  document.querySelectorAll('.user-delete').forEach(b =>
    b.addEventListener('click', () => {
      const u = Users.get(b.dataset.id);
      if (!u) return;
      if (u.id === currentUser()?.id) return showToast('You cannot delete your own account.', 'error');
      if (!confirm(`Delete user "${u.username}"?`)) return;
      const res = Users.delete(u.id);
      if (!res.ok) return showToast(res.error, 'error');
      showToast(`User "${u.username}" deleted.`, 'error');
      renderUsers();
    }));
}

function openUserModal(userId) {
  const u = userId ? Users.get(userId) : null;

  const { overlay, close } = buildModal(u ? `✏ Edit User — ${esc(u.username)}` : '➕ Add User', `
    <div class="form-group">
      <label for="u-username">Username</label>
      <input type="text" id="u-username" value="${esc(u?.username || '')}" ${u ? 'disabled' : ''} placeholder="e.g. rahul">
    </div>
    <div class="form-group">
      <label for="u-name">Full Name</label>
      <input type="text" id="u-name" value="${esc(u?.name || '')}" placeholder="Display name">
    </div>
    <div class="form-group">
      <label for="u-role">Role</label>
      <select id="u-role">
        <option value="user" ${u?.role !== 'admin' ? 'selected' : ''}>User — invoices only</option>
        <option value="admin" ${u?.role === 'admin' ? 'selected' : ''}>Admin — full access</option>
      </select>
    </div>
    <div class="form-group">
      <label for="u-active">Status</label>
      <select id="u-active">
        <option value="1" ${!u || u.active ? 'selected' : ''}>Active</option>
        <option value="0" ${u && !u.active ? 'selected' : ''}>Deactivated</option>
      </select>
    </div>
    <div class="form-group">
      <label for="u-password">${u ? 'New Password <span style="font-weight:400;opacity:.7">(leave blank to keep)</span>' : 'Password'}</label>
      <input type="password" id="u-password" placeholder="At least 4 characters" autocomplete="new-password">
    </div>
    <div class="form-group">
      <label for="u-question">Recovery Question</label>
      <select id="u-question" style="width:100%; padding:9px 12px; border:1px solid #cbd5e1; border-radius:8px; font-size:14px; background:#fff; color:#0f172a;">
        ${RECOVERY_QUESTIONS.map(q => `<option value="${esc(q)}" ${q === (u?.question || DEFAULT_QUESTION) ? 'selected' : ''}>${esc(q)}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label for="u-answer">Recovery Answer ${u ? '<span style="font-weight:400;opacity:.7">(leave blank to keep)</span>' : ''}</label>
      <input type="text" id="u-answer" placeholder="Secret answer">
    </div>
    <div class="login-error" id="u-error" hidden></div>
  `, `
    <button class="btn btn-secondary" id="u-cancel">Cancel</button>
    <button class="btn btn-primary" id="u-save">💾 Save User</button>
  `);

  overlay.querySelector('#u-cancel').addEventListener('click', close);

  overlay.querySelector('#u-save').addEventListener('click', async () => {
    const errBox = overlay.querySelector('#u-error');
    errBox.hidden = true;
    const show = (m) => { errBox.textContent = m; errBox.hidden = false; };

    const payload = {
      username: overlay.querySelector('#u-username').value,
      name: overlay.querySelector('#u-name').value,
      role: overlay.querySelector('#u-role').value,
      active: overlay.querySelector('#u-active').value === '1',
      password: overlay.querySelector('#u-password').value,
      question: overlay.querySelector('#u-question').value,
      answer: overlay.querySelector('#u-answer').value
    };

    const res = u ? await Users.update(u.id, payload) : await Users.create(payload);
    if (!res.ok) return show(res.error);

    close();
    showToast(u ? 'User updated.' : 'User created.', 'success');
    renderUsers();
  });
}
