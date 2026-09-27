// ============================================================
// users.js — Multi-user account store (client-side)
// ============================================================

const USERS_KEY = 'stc_users';
const SESSION_KEY = 'stc_auth_session';
const LEGACY_CRED_KEY = 'stc_auth_cred';

export const DEFAULT_PASSWORD = 'admin';

export const RECOVERY_QUESTIONS = [
  'Which city is the company based in?',
  'What is your primary transport vehicle or truck number?',
  'What is your transport name ?',
  'What is your transport address?',
  'What is your favorite vehicle brand or model?'
];

export const DEFAULT_QUESTION = RECOVERY_QUESTIONS[0];
const DEFAULT_ANSWER = 'chalisgaon';

/** The four admin accounts shipped with the app. */
const SEED_ADMINS = [
  { username: 'pol', name: 'Pol' },
  { username: 'admin2', name: 'Admin 2' },
  { username: 'admin3', name: 'Admin 3' },
  { username: 'admin4', name: 'Admin 4' }
];

// ── Hashing ──────────────────────────────────────────────────

export async function hash(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(text)));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function norm(s) {
  return String(s || '').trim().toLowerCase();
}

function id() {
  return 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ── Storage ──────────────────────────────────────────────────

function read() {
  try {
    const list = JSON.parse(localStorage.getItem(USERS_KEY));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function write(list) {
  localStorage.setItem(USERS_KEY, JSON.stringify(list));
}

/**
 * Create the four default admins on first run and migrate any
 * single-user credential saved by the older password gate.
 */
export async function ensureSeeded() {
  let list = read();
  if (list.length) {
    let modified = false;
    list.forEach(u => {
      if (u.username === 'admin') {
        u.username = 'pol';
        if (u.name === 'Owner (Admin)' || !u.name) u.name = 'Pol';
        modified = true;
      }
    });
    if (modified) write(list);
    return list;
  }

  const defaultHash = await hash(DEFAULT_PASSWORD);
  const answerHash = await hash(DEFAULT_ANSWER);

  let legacy = null;
  try {
    legacy = JSON.parse(localStorage.getItem(LEGACY_CRED_KEY));
  } catch { /* ignore */ }

  list = await Promise.all(SEED_ADMINS.map(async (seed, i) => ({
    id: id() + i,
    username: seed.username,
    name: seed.name,
    role: 'admin',
    active: true,
    hash: defaultHash,
    question: DEFAULT_QUESTION,
    answerHash,
    mustChangePassword: true,
    createdAt: new Date().toISOString()
  })));

  // Preserve the password the owner already set with the old gate.
  if (legacy && legacy.hash) {
    const match = list.find(u => u.username === norm(legacy.username));
    if (match) {
      match.hash = legacy.hash;
      match.mustChangePassword = false;
    } else {
      list.unshift({
        id: id(), username: norm(legacy.username), name: 'Pol',
        role: 'admin', active: true, hash: legacy.hash,
        question: DEFAULT_QUESTION, answerHash, mustChangePassword: false,
        createdAt: new Date().toISOString()
      });
    }
  }

  write(list);
  return list;
}

export const Users = {
  getAll() {
    return read();
  },
  get(userId) {
    return read().find(u => u.id === userId) || null;
  },
  getByUsername(username) {
    const u = norm(username);
    // Support matching both 'pol' and legacy 'admin' seamlessly
    return read().find(x => x.username === u || (u === 'admin' && x.username === 'pol')) || null;
  },
  activeAdminCount() {
    return read().filter(u => u.active && u.role === 'admin').length;
  },

  /** Create a new user. @returns {Promise<{ok:boolean,error?:string}>} */
  async create({ username, name, role = 'user', password, question, answer }) {
    const uname = norm(username);
    if (!uname) return { ok: false, error: 'Username is required.' };
    if (!/^[a-z0-9._-]{3,20}$/.test(uname)) {
      return { ok: false, error: 'Username: 3-20 characters, letters/numbers/._- only.' };
    }
    if (this.getByUsername(uname)) return { ok: false, error: 'That username already exists.' };
    if (!password || password.length < 4) return { ok: false, error: 'Password must be at least 4 characters.' };

    const list = read();
    list.push({
      id: id(),
      username: uname,
      name: (name || '').trim() || uname,
      role: role === 'admin' ? 'admin' : 'user',
      active: true,
      hash: await hash(password),
      question: (question || '').trim() || DEFAULT_QUESTION,
      answerHash: await hash(norm(answer || DEFAULT_ANSWER)),
      mustChangePassword: false,
      createdAt: new Date().toISOString()
    });
    write(list);
    return { ok: true };
  },

  /** Update name / role / active / optional new password + recovery. */
  async update(userId, { name, role, active, password, question, answer }) {
    const list = read();
    const u = list.find(x => x.id === userId);
    if (!u) return { ok: false, error: 'User not found.' };

    const nextRole = role === undefined ? u.role : (role === 'admin' ? 'admin' : 'user');
    const nextActive = active === undefined ? u.active : !!active;
    const losesAdmin = (u.role === 'admin' && u.active) && (nextRole !== 'admin' || !nextActive);
    if (losesAdmin && this.activeAdminCount() <= 1) {
      return { ok: false, error: 'At least one active admin must remain.' };
    }

    if (name !== undefined) u.name = (name || '').trim() || u.username;
    u.role = nextRole;
    u.active = nextActive;
    if (password) {
      if (password.length < 4) return { ok: false, error: 'Password must be at least 4 characters.' };
      u.hash = await hash(password);
      u.mustChangePassword = false;
    }
    if (question !== undefined && question.trim()) u.question = question.trim();
    if (answer) u.answerHash = await hash(norm(answer));
    u.updatedAt = new Date().toISOString();

    write(list);
    return { ok: true };
  },

  delete(userId) {
    const u = this.get(userId);
    if (!u) return { ok: false, error: 'User not found.' };
    if (u.active && u.role === 'admin' && this.activeAdminCount() <= 1) {
      return { ok: false, error: 'At least one active admin must remain.' };
    }
    write(read().filter(x => x.id !== userId));
    return { ok: true };
  },

  /** @returns {Promise<{ok:boolean, user?:object, error?:string}>} */
  async verify(username, password) {
    const u = this.getByUsername(username);
    if (!u) return { ok: false, error: 'Incorrect username or password.' };
    if (!u.active) return { ok: false, error: 'This account has been deactivated.' };
    if ((await hash(password)) !== u.hash) return { ok: false, error: 'Incorrect username or password.' };
    return { ok: true, user: u };
  },

  /** Verify the security answer for password recovery. */
  async verifyAnswer(username, answer) {
    const u = this.getByUsername(username);
    if (!u) return { ok: false, error: 'No account found with that username.' };
    if (!u.active) return { ok: false, error: 'This account has been deactivated. Ask an admin for help.' };
    if ((await hash(norm(answer))) !== u.answerHash) {
      return { ok: false, error: 'That answer does not match our records.' };
    }
    return { ok: true, user: u };
  }
};

// ── Session ──────────────────────────────────────────────────

function readSession() {
  const raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    if (s && s.username === 'admin') s.username = 'pol';
    return s && s.username ? s : null;
  } catch {
    // Legacy session flag ("1") from the single-user gate
    return raw === '1' ? { username: 'pol' } : null;
  }
}

export function currentUser() {
  const s = readSession();
  if (!s) return null;
  const u = Users.getByUsername(s.username);
  return u && u.active ? u : null;
}

export function isAuthenticated() {
  return !!currentUser();
}

export function isAdmin() {
  return currentUser()?.role === 'admin';
}

export function startSession(username, remember) {
  const payload = JSON.stringify({ username: norm(username), at: Date.now() });
  if (remember) localStorage.setItem(SESSION_KEY, payload);
  else sessionStorage.setItem(SESSION_KEY, payload);
}

export function endSession() {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}
