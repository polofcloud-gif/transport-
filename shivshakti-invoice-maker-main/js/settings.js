// ============================================================
// settings.js — Backup & restore (JSON export / import)
// ============================================================

import { showToast } from './app.js';
import { Invoices, Customers, Trucks, Settings } from './store.js';
import { isAdmin } from './users.js';
import { SearchHistory, TypeHistory } from './type-history.js';

const BACKUP_VERSION = 1;

/** Build the backup object from localStorage data. */
export function buildBackup() {
  return {
    app: 'shivshakti-transport-invoice',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      invoices: Invoices.getAll(),
      customers: Customers.getAll(),
      trucks: Trucks.getAll(),
      settings: Settings.get(),
      searchHistory: {
        recent: SearchHistory.getRecent(),
        saved: SearchHistory.getSaved()
      },
      typeHistory: TypeHistory._getAll()
    }
  };
}

function downloadBackup() {
  const backup = buildBackup();
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `stc-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('Backup file downloaded', 'success');
}

/**
 * Restore a backup.
 * @param {object} backup parsed JSON
 * @param {'replace'|'merge'} mode
 */
export function restoreBackup(backup, mode = 'replace') {
  const d = backup && backup.data;
  if (!d || (!Array.isArray(d.invoices) && !Array.isArray(d.customers) && !Array.isArray(d.trucks))) {
    return { ok: false, error: 'This file is not a valid backup.' };
  }

  const mergeById = (existing, incoming) => {
    const map = new Map(existing.map(x => [x.id, x]));
    (incoming || []).forEach(x => { if (x && x.id) map.set(x.id, x); else if (x) map.set(Math.random(), x); });
    return Array.from(map.values());
  };

  const invoices = mode === 'merge' ? mergeById(Invoices.getAll(), d.invoices) : (d.invoices || []);
  const customers = mode === 'merge' ? mergeById(Customers.getAll(), d.customers) : (d.customers || []);
  const trucks = mode === 'merge' ? mergeById(Trucks.getAll(), d.trucks) : (d.trucks || []);

  localStorage.setItem('stc_invoices', JSON.stringify(invoices));
  localStorage.setItem('stc_customers', JSON.stringify(customers));
  localStorage.setItem('stc_trucks', JSON.stringify(trucks));
  if (d.settings) Settings.save({ ...Settings.get(), ...d.settings });

  if (d.searchHistory) {
    if (Array.isArray(d.searchHistory.recent)) localStorage.setItem('stc_search_recent', JSON.stringify(d.searchHistory.recent));
    if (Array.isArray(d.searchHistory.saved)) localStorage.setItem('stc_search_saved', JSON.stringify(d.searchHistory.saved));
  }
  if (d.typeHistory && typeof d.typeHistory === 'object') {
    localStorage.setItem('stc_type_history', JSON.stringify(d.typeHistory));
  }

  return {
    ok: true,
    counts: { invoices: invoices.length, customers: customers.length, trucks: trucks.length }
  };
}

export function renderSettings() {
  const app = document.getElementById('app');
  const counts = {
    invoices: Invoices.getAll().length,
    customers: Customers.getAll().length,
    trucks: Trucks.getAll().length
  };

  const recentSearches = SearchHistory.getRecent();
  const savedSearches = SearchHistory.getSaved();
  const typeHist = TypeHistory._getAll();
  const typeEntriesCount = Object.values(typeHist).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);

  app.innerHTML = `
    <div class="page-header">
      <h1>Settings & Backup</h1>
      <p>Export all your data, manage history, or restore backups</p>
    </div>

    <!-- Search & Type History Management Card -->
    <div class="card">
      <h3 class="card-title">🔍 Search & Type History</h3>
      <p class="muted-text">Manage your saved invoice searches and auto-saved typing suggestions (routes, item names, drivers, owners).</p>
      
      <div style="display:flex; gap:16px; flex-wrap:wrap; margin:16px 0;">
        <div style="background:var(--surface-alt); padding:12px 18px; border-radius:8px; border:1px solid var(--border); min-width:140px;">
          <div style="font-size:11px; color:var(--text-light); text-transform:uppercase; font-weight:700;">Saved Searches</div>
          <div style="font-size:22px; font-weight:800; color:var(--primary); margin-top:4px;">⭐ ${savedSearches.length}</div>
        </div>
        <div style="background:var(--surface-alt); padding:12px 18px; border-radius:8px; border:1px solid var(--border); min-width:140px;">
          <div style="font-size:11px; color:var(--text-light); text-transform:uppercase; font-weight:700;">Recent Searches</div>
          <div style="font-size:22px; font-weight:800; color:var(--text); margin-top:4px;">🕒 ${recentSearches.length}</div>
        </div>
        <div style="background:var(--surface-alt); padding:12px 18px; border-radius:8px; border:1px solid var(--border); min-width:140px;">
          <div style="font-size:11px; color:var(--text-light); text-transform:uppercase; font-weight:700;">Typed Autocompletes</div>
          <div style="font-size:22px; font-weight:800; color:#10b981; margin-top:4px;">⌨️ ${typeEntriesCount}</div>
        </div>
      </div>

      <div class="btn-group" style="gap:10px; flex-wrap:wrap;">
        <button type="button" class="btn btn-outline btn-sm" id="clear-recent-searches-btn">Clear Recent Searches</button>
        <button type="button" class="btn btn-outline btn-sm" id="clear-saved-searches-btn">Clear Saved Searches</button>
        <button type="button" class="btn btn-outline btn-sm" id="clear-type-history-btn">Clear Auto-Type History</button>
        <button type="button" class="btn btn-secondary btn-sm" id="clear-all-history-btn">Clear All History</button>
      </div>
    </div>

    <div class="card">
      <h3 class="card-title">📦 Export Backup</h3>
      <p class="muted-text">Saves <strong>${counts.invoices}</strong> invoices, <strong>${counts.customers}</strong> customers, <strong>${counts.trucks}</strong> trucks, and your search & type history into a single JSON file on this device.</p>
      <button class="btn btn-primary" id="export-btn">⬇ Download Backup (JSON)</button>
    </div>

    <div class="card">
      <h3 class="card-title">♻ Restore Backup</h3>
      <p class="muted-text">Choose a backup file created by this app.</p>
      <div class="form-group" style="max-width:420px;">
        <label for="restore-mode">Restore mode</label>
        <select id="restore-mode">
          <option value="replace">Replace — wipe current data and use the backup</option>
          <option value="merge">Merge — keep current data and add/update from backup</option>
        </select>
      </div>
      <input type="file" id="restore-file" accept="application/json,.json" style="margin:8px 0 14px;">
      <div>
        <button class="btn btn-secondary" id="restore-btn">⬆ Restore From File</button>
      </div>
    </div>

    ${isAdmin() ? `
    <div class="card">
      <h3 class="card-title">👥 Users</h3>
      <p class="muted-text">Create, edit or deactivate accounts that can sign in to this app.</p>
      <a class="btn btn-outline" href="#users">Open User Management</a>
    </div>` : ''}
  `;

  // Search & Type history button events
  document.getElementById('clear-recent-searches-btn')?.addEventListener('click', () => {
    SearchHistory.clearRecent();
    showToast('Recent searches cleared.', 'success');
    renderSettings();
  });

  document.getElementById('clear-saved-searches-btn')?.addEventListener('click', () => {
    if (confirm('Clear all saved bookmarked searches?')) {
      localStorage.removeItem('stc_search_saved');
      showToast('Saved searches cleared.', 'success');
      renderSettings();
    }
  });

  document.getElementById('clear-type-history-btn')?.addEventListener('click', () => {
    if (confirm('Clear all auto-saved typing suggestions?')) {
      TypeHistory.clear();
      showToast('Auto-type history cleared.', 'success');
      renderSettings();
    }
  });

  document.getElementById('clear-all-history-btn')?.addEventListener('click', () => {
    if (confirm('Clear ALL search history and typing suggestions?')) {
      SearchHistory.clearRecent();
      localStorage.removeItem('stc_search_saved');
      TypeHistory.clear();
      showToast('All search and typing history cleared.', 'success');
      renderSettings();
    }
  });

  document.getElementById('export-btn').addEventListener('click', downloadBackup);

  document.getElementById('restore-btn').addEventListener('click', () => {
    const input = document.getElementById('restore-file');
    const file = input.files && input.files[0];
    if (!file) return showToast('Please choose a backup file first.', 'warning');

    const mode = document.getElementById('restore-mode').value;
    if (mode === 'replace' && !confirm('Replace ALL current invoices, customers and trucks with this backup?')) return;

    const reader = new FileReader();
    reader.onload = () => {
      let parsed;
      try {
        parsed = JSON.parse(reader.result);
      } catch {
        return showToast('That file is not valid JSON.', 'error');
      }
      const res = restoreBackup(parsed, mode);
      if (!res.ok) return showToast(res.error, 'error');
      showToast(`Restored ${res.counts.invoices} invoices, ${res.counts.customers} customers, ${res.counts.trucks} trucks.`, 'success');
      renderSettings();
    };
    reader.onerror = () => showToast('Could not read that file.', 'error');
    reader.readAsText(file);
  });
}
