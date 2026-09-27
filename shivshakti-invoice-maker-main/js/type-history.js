// ============================================================
// type-history.js — Search & Input Type History Manager
// ============================================================

const KEYS = {
  searchRecent: 'stc_search_recent',
  searchSaved: 'stc_search_saved',
  typeHistory: 'stc_type_history'
};

// ── Search History Manager ───────────────────────────────────

export const SearchHistory = {
  getRecent() {
    try {
      const data = JSON.parse(localStorage.getItem(KEYS.searchRecent));
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  },

  addRecent(query) {
    const q = (query || '').trim();
    if (!q || q.length < 2) return;

    let list = this.getRecent().filter(item => item.toLowerCase() !== q.toLowerCase());
    list.unshift(q);
    if (list.length > 8) list = list.slice(0, 8); // keep last 8
    localStorage.setItem(KEYS.searchRecent, JSON.stringify(list));
  },

  removeRecent(query) {
    const q = (query || '').trim().toLowerCase();
    const list = this.getRecent().filter(item => item.toLowerCase() !== q);
    localStorage.setItem(KEYS.searchRecent, JSON.stringify(list));
  },

  clearRecent() {
    localStorage.removeItem(KEYS.searchRecent);
  },

  getSaved() {
    try {
      const data = JSON.parse(localStorage.getItem(KEYS.searchSaved));
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  },

  isSaved(query) {
    const q = (query || '').trim().toLowerCase();
    if (!q) return false;
    return this.getSaved().some(s => s.query.toLowerCase() === q);
  },

  saveSearch(query, label = '') {
    const q = (query || '').trim();
    if (!q) return false;

    let list = this.getSaved().filter(s => s.query.toLowerCase() !== q.toLowerCase());
    list.unshift({
      query: q,
      label: (label || '').trim() || q,
      savedAt: new Date().toISOString()
    });
    localStorage.setItem(KEYS.searchSaved, JSON.stringify(list));
    return true;
  },

  removeSaved(query) {
    const q = (query || '').trim().toLowerCase();
    const list = this.getSaved().filter(s => s.query.toLowerCase() !== q);
    localStorage.setItem(KEYS.searchSaved, JSON.stringify(list));
  }
};

// ── Type History Manager ─────────────────────────────────────

export const TypeHistory = {
  _getAll() {
    try {
      const data = JSON.parse(localStorage.getItem(KEYS.typeHistory));
      return data && typeof data === 'object' ? data : {};
    } catch {
      return {};
    }
  },

  _saveAll(data) {
    localStorage.setItem(KEYS.typeHistory, JSON.stringify(data));
  },

  get(category) {
    const all = this._getAll();
    return Array.isArray(all[category]) ? all[category] : [];
  },

  record(category, value) {
    const val = (value || '').trim();
    if (!val || val.length < 2) return;

    const all = this._getAll();
    let list = Array.isArray(all[category]) ? all[category] : [];

    // Remove existing case-insensitive match and put at top
    list = list.filter(item => item.toLowerCase() !== val.toLowerCase());
    list.unshift(val);

    if (list.length > 25) list = list.slice(0, 25); // keep up to 25 items per category
    all[category] = list;
    this._saveAll(all);
  },

  recordInvoice(invoice) {
    if (!invoice) return;

    if (invoice.fromLocation) this.record('fromLocation', invoice.fromLocation);
    if (invoice.toLocation) this.record('toLocation', invoice.toLocation);
    if (invoice.senderName) this.record('senderName', invoice.senderName);
    if (invoice.senderAddress) this.record('senderAddress', invoice.senderAddress);
    if (invoice.senderMobile) this.record('senderMobile', invoice.senderMobile);
    if (invoice.receiverName) this.record('receiverName', invoice.receiverName);
    if (invoice.receiverAddress) this.record('receiverAddress', invoice.receiverAddress);
    if (invoice.receiverMobile) this.record('receiverMobile', invoice.receiverMobile);
    if (invoice.truckNo) this.record('truckNo', invoice.truckNo.toUpperCase());
    if (invoice.ownerName) this.record('ownerName', invoice.ownerName);
    if (invoice.driverName) this.record('driverName', invoice.driverName);
    if (invoice.driverMobile) this.record('driverMobile', invoice.driverMobile);

    if (Array.isArray(invoice.items)) {
      invoice.items.forEach(it => {
        if (it && it.name) this.record('itemName', it.name);
      });
    }
  },

  seedFromExistingInvoices(invoices) {
    if (!Array.isArray(invoices)) return;
    invoices.forEach(inv => this.recordInvoice(inv));
  },

  search(category, prefix) {
    const p = (prefix || '').trim().toLowerCase();
    const list = this.get(category);
    if (!p) return list.slice(0, 8);
    return list.filter(item => item.toLowerCase().includes(p)).slice(0, 8);
  },

  clear(category) {
    const all = this._getAll();
    if (category) {
      delete all[category];
    } else {
      Object.keys(all).forEach(k => delete all[k]);
    }
    this._saveAll(all);
  },

  /**
   * Attach smart type history autocomplete to an HTML input element.
   * @param {HTMLInputElement} input
   * @param {string} category
   * @param {Function} [onSelect]
   */
  attachAutocomplete(input, category, onSelect) {
    if (!input) return;

    // Ensure parent has autocomplete-wrapper class
    let wrapper = input.parentElement;
    if (!wrapper.classList.contains('autocomplete-wrapper')) {
      wrapper.classList.add('autocomplete-wrapper');
    }

    // Check if dropdown container already exists
    let list = wrapper.querySelector('.type-history-dropdown');
    if (!list) {
      list = document.createElement('div');
      list.className = 'autocomplete-list type-history-dropdown';
      wrapper.appendChild(list);
    }

    const showSuggestions = () => {
      const val = input.value.trim();
      const matches = this.search(category, val);

      if (matches.length === 0) {
        list.classList.remove('active');
        list.innerHTML = '';
        return;
      }

      list.innerHTML = `
        <div class="ac-header" style="padding:6px 12px; font-size:11px; font-weight:700; color:var(--text-light); text-transform:uppercase; letter-spacing:0.5px; background:var(--surface-alt); border-bottom:1px solid var(--border);">
          🕒 Recent Type History
        </div>
        ${matches.map(m => `
          <div class="autocomplete-item" data-value="${escapeHtml(m)}">
            <div class="ac-name">${escapeHtml(m)}</div>
          </div>
        `).join('')}
      `;
      list.classList.add('active');

      list.querySelectorAll('.autocomplete-item').forEach(item => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          const selectedVal = item.dataset.value;
          input.value = selectedVal;
          list.classList.remove('active');
          if (typeof onSelect === 'function') onSelect(selectedVal);
          input.dispatchEvent(new Event('input', { bubbles: true }));
        });
      });
    };

    input.addEventListener('focus', showSuggestions);
    input.addEventListener('input', showSuggestions);

    document.addEventListener('click', (e) => {
      if (!wrapper.contains(e.target)) {
        list.classList.remove('active');
      }
    });
  }
};

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
