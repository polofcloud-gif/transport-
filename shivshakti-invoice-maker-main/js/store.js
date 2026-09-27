// ============================================================
// store.js — localStorage persistence layer
// ============================================================

import { generateInvoiceNumber, generateId } from './utils.js';

const KEYS = {
  invoices: 'stc_invoices',
  customers: 'stc_customers',
  trucks: 'stc_trucks',
  settings: 'stc_settings'
};

// ── Generic helpers ──────────────────────────────────────────

function getCollection(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch {
    return [];
  }
}

function saveCollection(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

function getObject(key, defaults) {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(key)) };
  } catch {
    return { ...defaults };
  }
}

function saveObject(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

// ── Settings ─────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  invoiceCounter: 0,
  companyName: 'SHIVSHAKTI TRANSPORT COMPANY',
  companyAddress: 'Chalisgaon, Jalgaon - 424101, Maharashtra, India',
  companyMobile: '9370005134 / 8806006621',
  companyEmail: 'shivshaktitansportcom@gmail.com'
};

export const Settings = {
  get() {
    return getObject(KEYS.settings, DEFAULT_SETTINGS);
  },
  save(settings) {
    saveObject(KEYS.settings, settings);
  },
  /**
   * Find the highest invoice number in use, considering both the saved
   * counter and every existing invoice matching STC-<digits>.
   * @returns {number} highest numeric suffix found (0 if none)
   */
  _maxInvoiceNumber() {
    let max = Number(this.get().invoiceCounter) || 0;
    Invoices.getAll().forEach(inv => {
      const m = /^STC-(\d+)$/i.exec((inv.invoiceNumber || '').trim());
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return max;
  },
  /**
   * Preview the next invoice number without consuming it.
   * @returns {string} e.g. "STC-0002"
   */
  peekNextInvoiceNumber() {
    return 'STC-' + String(this._maxInvoiceNumber() + 1).padStart(4, '0');
  },
  /**
   * Assign and consume the next sequential invoice number.
   * @returns {string} e.g. "STC-0002"
   */
  getNextInvoiceNumber() {
    const next = this._maxInvoiceNumber() + 1;
    const settings = this.get();
    settings.invoiceCounter = next;
    this.save(settings);
    return 'STC-' + String(next).padStart(4, '0');
  }
};

// ── Invoices ─────────────────────────────────────────────────

export const Invoices = {
  getAll() {
    return getCollection(KEYS.invoices);
  },
  get(id) {
    return this.getAll().find(inv => inv.id === id);
  },
  save(invoice) {
    const all = this.getAll();
    if (!invoice.id) invoice.id = generateId();
    if (!invoice.invoiceNumber) invoice.invoiceNumber = Settings.getNextInvoiceNumber();
    invoice.updatedAt = new Date().toISOString();
    if (!invoice.createdAt) invoice.createdAt = invoice.updatedAt;

    // Always store truck number in uppercase
    if (invoice.truckNo) {
      invoice.truckNo = invoice.truckNo.toUpperCase();
    }

    const idx = all.findIndex(inv => inv.id === invoice.id);
    if (idx >= 0) {
      all[idx] = invoice;
    } else {
      all.unshift(invoice); // newest first
    }
    saveCollection(KEYS.invoices, all);
    return invoice;
  },
  update(id, data) {
    const all = this.getAll();
    const idx = all.findIndex(inv => inv.id === id);
    if (idx >= 0) {
      if (data.truckNo) data.truckNo = data.truckNo.toUpperCase();
      all[idx] = { ...all[idx], ...data, updatedAt: new Date().toISOString() };
      saveCollection(KEYS.invoices, all);
      return all[idx];
    }
    return null;
  },
  delete(id) {
    const all = this.getAll().filter(inv => inv.id !== id);
    saveCollection(KEYS.invoices, all);
  },
  /**
   * Search invoices by invoice number, sender, receiver, truck no, driver name, or date.
   * @param {string} query
   * @returns {object[]}
   */
  search(query) {
    const q = (query || '').toLowerCase().trim();
    if (!q) return this.getAll();
    return this.getAll().filter(inv => {
      const dateStr = inv.date ? new Date(inv.date).toLocaleDateString('en-IN') : '';
      return (
        (inv.invoiceNumber || '').toLowerCase().includes(q) ||
        (inv.senderName || '').toLowerCase().includes(q) ||
        (inv.receiverName || '').toLowerCase().includes(q) ||
        (inv.truckNo || '').toLowerCase().includes(q) ||
        (inv.driverName || '').toLowerCase().includes(q) ||
        (inv.date || '').toLowerCase().includes(q) ||
        dateStr.toLowerCase().includes(q)
      );
    });
  },
  count() {
    return this.getAll().length;
  },
  todayCount() {
    const today = new Date().toDateString();
    return this.getAll().filter(inv => new Date(inv.date).toDateString() === today).length;
  },
  thisMonthCount() {
    const now = new Date();
    return this.getAll().filter(inv => {
      const d = new Date(inv.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
  },
  totalAmount() {
    return this.getAll().reduce((sum, inv) => sum + (Number(inv.totalAmount) || 0), 0);
  },
  pendingAmount() {
    return this.getAll()
      .filter(inv => inv.status === 'pending')
      .reduce((sum, inv) => sum + (Number(inv.totalAmount) || 0), 0);
  }
};

// ── Customers ────────────────────────────────────────────────

export const Customers = {
  getAll() {
    return getCollection(KEYS.customers);
  },
  get(id) {
    return this.getAll().find(c => c.id === id);
  },
  save(customer) {
    const all = this.getAll();
    if (!customer.id) customer.id = generateId();
    const idx = all.findIndex(c => c.id === customer.id);
    if (idx >= 0) {
      all[idx] = customer;
    } else {
      all.push(customer);
    }
    saveCollection(KEYS.customers, all);
    return customer;
  },
  delete(id) {
    const all = this.getAll().filter(c => c.id !== id);
    saveCollection(KEYS.customers, all);
  },
  search(query) {
    const q = query.toLowerCase();
    return this.getAll().filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.address || '').toLowerCase().includes(q) ||
      (c.mobile || '').includes(q)
    );
  }
};

// ── Trucks ───────────────────────────────────────────────────

export const Trucks = {
  getAll() {
    return getCollection(KEYS.trucks);
  },
  get(id) {
    return this.getAll().find(t => t.id === id);
  },
  getByNumber(truckNo) {
    return this.getAll().find(t => t.truckNo.toUpperCase() === (truckNo || '').toUpperCase());
  },
  save(truck) {
    const all = this.getAll();
    if (!truck.id) truck.id = generateId();
    // Always store truck number in uppercase
    if (truck.truckNo) truck.truckNo = truck.truckNo.toUpperCase();
    const idx = all.findIndex(t => t.id === truck.id);
    if (idx >= 0) {
      all[idx] = truck;
    } else {
      all.push(truck);
    }
    saveCollection(KEYS.trucks, all);
    return truck;
  },
  delete(id) {
    const all = this.getAll().filter(t => t.id !== id);
    saveCollection(KEYS.trucks, all);
  },
  search(query) {
    const q = (query || '').toLowerCase();
    return this.getAll().filter(t =>
      (t.truckNo || '').toLowerCase().includes(q) ||
      (t.ownerName || '').toLowerCase().includes(q) ||
      (t.driverName || '').toLowerCase().includes(q)
    );
  }
};
