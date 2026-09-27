// ============================================================
// history.js — Invoice History Page with Advanced Search & History
// ============================================================

import { Invoices } from './store.js';
import { formatCurrency, formatDate } from './utils.js';
import { renderInvoice, openDateEditModal, attachInvoiceInteractivity } from './invoice-preview.js';
import { generatePDF, printInvoice } from './invoice-pdf.js';
import { showToast, navigate } from './app.js';
import { SearchHistory, TypeHistory } from './type-history.js';

/**
 * Render the invoice history page.
 */
export function renderHistory() {
  const app = document.getElementById('app');
  const invoices = Invoices.getAll();

  // Pre-seed type history from existing invoices if needed
  TypeHistory.seedFromExistingInvoices(invoices);

  app.innerHTML = `
    <div class="page-header">
      <h1>Invoice History</h1>
      <p>View, search, and manage all your invoices</p>
    </div>

    <div class="card">
      <div class="search-bar">
        <input type="text" id="history-search" placeholder="🔍 Search by invoice no, customer, truck, driver name, route, date..." autocomplete="off">
        <button type="button" class="btn btn-outline" id="save-search-btn" title="Save this search query to favorites">⭐ Save Search</button>
        <button class="btn btn-primary" id="new-invoice-from-history">+ New Invoice</button>
      </div>

      <!-- Search History & Saved Searches Bar -->
      <div class="search-history-container" id="search-history-container">
        <!-- populated dynamically -->
      </div>

      <div id="history-table-container">
        ${renderHistoryTable(invoices)}
      </div>
    </div>

    <!-- Preview Area for printing/PDF from history -->
    <div id="preview-area" style="display:none;">
      <div class="preview-container">
        <div class="preview-actions">
          <button type="button" class="btn btn-secondary" id="history-sig-btn">✍️ Toggle Digital Signature</button>
          <button type="button" class="btn btn-secondary" id="history-date-btn">📅 Edit Date</button>
          <button type="button" class="btn btn-primary" id="history-pdf-btn">📄 Generate PDF</button>
          <button type="button" class="btn btn-secondary" id="history-print-btn">🖨 Print</button>
          <button type="button" class="btn btn-secondary" id="history-close-preview">✕ Close Preview</button>
        </div>
        <div id="preview-content"></div>
      </div>
    </div>
  `;

  renderSearchHistoryChips();
  bindHistoryEvents();
}

function renderSearchHistoryChips() {
  const container = document.getElementById('search-history-container');
  if (!container) return;

  const saved = SearchHistory.getSaved();
  const recent = SearchHistory.getRecent();
  const searchInput = document.getElementById('history-search');
  const currentQuery = (searchInput?.value || '').trim().toLowerCase();

  if (saved.length === 0 && recent.length === 0) {
    container.classList.add('hidden');
    container.innerHTML = '';
    return;
  }

  container.classList.remove('hidden');

  let html = '';

  // 1. Saved Searches Row
  if (saved.length > 0) {
    html += `
      <div class="search-history-row">
        <span class="search-history-label">⭐ Saved:</span>
        <div class="search-chips-wrap">
          ${saved.map(s => {
            const isActive = currentQuery && s.query.toLowerCase() === currentQuery;
            return `
              <span class="search-chip saved ${isActive ? 'active' : ''}" data-query="${escHtml(s.query)}" title="Search for: ${escHtml(s.query)}">
                <span>⭐ ${escHtml(s.label || s.query)}</span>
                <button type="button" class="search-chip-remove" data-remove-saved="${escHtml(s.query)}" title="Remove bookmark">✕</button>
              </span>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  // 2. Recent Searches Row
  if (recent.length > 0) {
    html += `
      <div class="search-history-row">
        <span class="search-history-label">🕒 Recent:</span>
        <div class="search-chips-wrap">
          ${recent.map(r => {
            const isActive = currentQuery && r.toLowerCase() === currentQuery;
            return `
              <span class="search-chip ${isActive ? 'active' : ''}" data-query="${escHtml(r)}" title="Search for: ${escHtml(r)}">
                <span>${escHtml(r)}</span>
                <button type="button" class="search-chip-remove" data-remove-recent="${escHtml(r)}" title="Remove from recent">✕</button>
              </span>
            `;
          }).join('')}
        </div>
        <button type="button" class="search-history-clear-btn" id="clear-search-history-btn">Clear All</button>
      </div>
    `;
  }

  container.innerHTML = html;

  // Bind clicks on chips
  container.querySelectorAll('.search-chip').forEach(chip => {
    chip.addEventListener('click', (e) => {
      if (e.target.classList.contains('search-chip-remove')) return;
      const query = chip.dataset.query;
      if (searchInput) {
        searchInput.value = query;
        applySearch(query);
        renderSearchHistoryChips();
      }
    });
  });

  // Remove saved
  container.querySelectorAll('[data-remove-saved]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const q = btn.dataset.removeSaved;
      SearchHistory.removeSaved(q);
      renderSearchHistoryChips();
    });
  });

  // Remove recent
  container.querySelectorAll('[data-remove-recent]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const q = btn.dataset.removeRecent;
      SearchHistory.removeRecent(q);
      renderSearchHistoryChips();
    });
  });

  // Clear all recent
  container.querySelector('#clear-search-history-btn')?.addEventListener('click', () => {
    SearchHistory.clearRecent();
    renderSearchHistoryChips();
  });
}

function renderHistoryTable(invoices) {
  if (invoices.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-icon">📜</div>
        <p>No invoices found. Create your first invoice!</p>
      </div>
    `;
  }

  return `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Invoice No</th>
            <th>Date</th>
            <th>Sender</th>
            <th>Receiver</th>
            <th>Truck No</th>
            <th>Driver</th>
            <th>Total Amount</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${invoices.map(inv => `
            <tr data-id="${inv.id}">
              <td><strong>${escHtml(inv.invoiceNumber)}</strong></td>
              <td>
                <span class="inv-date-editable" data-id="${inv.id}" title="Click to Edit Date">
                  ${formatDate(inv.date)} <span class="edit-icon">✏️</span>
                </span>
              </td>
              <td>${escHtml(inv.senderName || '')}</td>
              <td>${escHtml(inv.receiverName || '')}</td>
              <td>${escHtml((inv.truckNo || '').toUpperCase())}</td>
              <td>${escHtml(inv.driverName || '')}</td>
              <td><strong>${formatCurrency(inv.totalAmount)}</strong></td>
              <td><span class="badge badge-${inv.status || 'pending'}">${capitalize(inv.status || 'pending')}</span></td>
              <td>
                <div class="btn-group" style="gap:6px;">
                  <button class="btn btn-sm btn-secondary hist-view" data-id="${inv.id}" title="View">👁</button>
                  <button class="btn btn-sm btn-outline hist-edit" data-id="${inv.id}" title="Edit Form">✏</button>
                  <button class="btn btn-sm btn-secondary hist-date" data-id="${inv.id}" title="Edit Date">📅</button>
                  <button class="btn btn-sm btn-secondary hist-route" data-id="${inv.id}" title="Edit Route (From / To)">📍</button>
                  <button class="btn btn-sm btn-secondary hist-print" data-id="${inv.id}" title="Print">🖨</button>
                  <button class="btn btn-sm btn-secondary hist-pdf" data-id="${inv.id}" title="PDF">📄</button>
                  <button class="btn btn-sm btn-danger hist-delete" data-id="${inv.id}" title="Delete">🗑</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

let activePreviewInvoice = null;
let searchTimer = null;

function applySearch(query) {
  const q = (query || '').toLowerCase().trim();
  const all = Invoices.getAll();
  const filtered = q ? all.filter(inv => {
    const invoiceNo = (inv.invoiceNumber || '').toLowerCase();
    const sender = (inv.senderName || '').toLowerCase();
    const receiver = (inv.receiverName || '').toLowerCase();
    const truckNo = (inv.truckNo || '').toLowerCase();
    const driverName = (inv.driverName || '').toLowerCase();
    const fromLoc = (inv.fromLocation || '').toLowerCase();
    const toLoc = (inv.toLocation || '').toLowerCase();
    const dateStr = inv.date ? formatDate(inv.date).toLowerCase() : '';
    const rawDate = (inv.date || '').toLowerCase();

    return invoiceNo.includes(q) ||
      sender.includes(q) ||
      receiver.includes(q) ||
      truckNo.includes(q) ||
      driverName.includes(q) ||
      fromLoc.includes(q) ||
      toLoc.includes(q) ||
      dateStr.includes(q) ||
      rawDate.includes(q);
  }) : all;

  const tableContainer = document.getElementById('history-table-container');
  if (tableContainer) {
    tableContainer.innerHTML = renderHistoryTable(filtered);
    bindTableActions();
  }
}

function bindHistoryEvents() {
  const searchInput = document.getElementById('history-search');

  // Live input search
  searchInput.addEventListener('input', (e) => {
    const val = e.target.value;
    applySearch(val);

    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      if (val.trim().length >= 2) {
        SearchHistory.addRecent(val.trim());
        renderSearchHistoryChips();
      }
    }, 700);
  });

  // Enter key press saves search to recent immediately
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const val = searchInput.value.trim();
      if (val.length >= 2) {
        clearTimeout(searchTimer);
        SearchHistory.addRecent(val);
        renderSearchHistoryChips();
      }
    }
  });

  // Save current search button
  document.getElementById('save-search-btn')?.addEventListener('click', () => {
    const val = searchInput.value.trim();
    if (!val) {
      showToast('Please type a search query first to save it.', 'warning');
      searchInput.focus();
      return;
    }

    const label = prompt(`Enter a name/tag for saved search "${val}":`, val);
    if (label !== null) {
      SearchHistory.saveSearch(val, label.trim() || val);
      showToast(`⭐ Search "${val}" saved to favorites!`, 'success');
      renderSearchHistoryChips();
    }
  });

  // New invoice button
  document.getElementById('new-invoice-from-history').addEventListener('click', () => {
    navigate('new-invoice');
  });

  // Close preview
  document.getElementById('history-close-preview')?.addEventListener('click', () => {
    document.getElementById('preview-area').style.display = 'none';
    activePreviewInvoice = null;
  });

  // Generate PDF from history preview
  document.getElementById('history-pdf-btn')?.addEventListener('click', () => {
    if (activePreviewInvoice) {
      generatePDF(activePreviewInvoice.invoiceNumber);
    } else {
      const invNo = document.getElementById('invoice-page')?.querySelector('.inv-meta')?.textContent || 'Invoice';
      generatePDF(invNo.match(/STC-\d+/)?.[0] || 'Invoice');
    }
  });

  // Print from history preview
  document.getElementById('history-print-btn')?.addEventListener('click', () => {
    printInvoice();
  });

  // Toggle Digital Signature from history preview top button
  document.getElementById('history-sig-btn')?.addEventListener('click', () => {
    if (!activePreviewInvoice) return;
    const current = activePreviewInvoice.digitalSignature !== false && activePreviewInvoice.digitalSignature !== undefined && activePreviewInvoice.digitalSignature !== null
      ? !!activePreviewInvoice.digitalSignature
      : false;
    const next = !current;
    activePreviewInvoice.digitalSignature = next;
    Invoices.update(activePreviewInvoice.id, { digitalSignature: next });
    showToast(next ? '✍️ Digital signature added!' : 'Digital signature removed.', 'success');
    renderActiveHistoryPreview();
  });

  // Edit Date from history preview top button
  document.getElementById('history-date-btn')?.addEventListener('click', () => {
    if (!activePreviewInvoice) return;
    openDateEditModal(activePreviewInvoice.id, activePreviewInvoice.date, (newDate) => {
      activePreviewInvoice.date = newDate;
      renderActiveHistoryPreview();
      applySearch(searchInput?.value || '');
    });
  });

  bindTableActions();
}

function renderActiveHistoryPreview() {
  if (!activePreviewInvoice) return;
  const previewContent = document.getElementById('preview-content');
  if (!previewContent) return;
  previewContent.innerHTML = renderInvoice(activePreviewInvoice);
  attachInvoiceInteractivity(previewContent, activePreviewInvoice, (updated) => {
    activePreviewInvoice = updated;
    renderActiveHistoryPreview();
  });
}

function openHistoryPreview(inv) {
  activePreviewInvoice = inv;
  renderActiveHistoryPreview();
  const previewArea = document.getElementById('preview-area');
  previewArea.style.display = 'block';
  previewArea.scrollIntoView({ behavior: 'smooth' });
}

function bindTableActions() {
  // View
  document.querySelectorAll('.hist-view').forEach(btn => {
    btn.addEventListener('click', () => navigate(`view-invoice/${btn.dataset.id}`));
  });

  // Edit Form
  document.querySelectorAll('.hist-edit').forEach(btn => {
    btn.addEventListener('click', () => navigate(`edit-invoice/${btn.dataset.id}`));
  });

  // Edit Date directly from table row button
  document.querySelectorAll('.hist-date').forEach(btn => {
    btn.addEventListener('click', () => {
      const inv = Invoices.get(btn.dataset.id);
      if (inv) {
        openDateEditModal(inv.id, inv.date, () => {
          renderHistory();
        });
      }
    });
  });

  // Click on date text in table row
  document.querySelectorAll('.table-wrapper .inv-date-editable').forEach(span => {
    span.addEventListener('click', () => {
      const invId = span.dataset.id;
      const inv = Invoices.get(invId);
      if (inv) {
        openDateEditModal(inv.id, inv.date, () => {
          renderHistory();
        });
      }
    });
  });

  // Print
  document.querySelectorAll('.hist-print').forEach(btn => {
    btn.addEventListener('click', () => {
      const inv = Invoices.get(btn.dataset.id);
      if (inv) {
        openHistoryPreview(inv);
        setTimeout(() => printInvoice(), 300);
      }
    });
  });

  // PDF
  document.querySelectorAll('.hist-pdf').forEach(btn => {
    btn.addEventListener('click', () => {
      const inv = Invoices.get(btn.dataset.id);
      if (inv) {
        openHistoryPreview(inv);
        setTimeout(() => generatePDF(inv.invoiceNumber), 300);
      }
    });
  });

  // Edit Route
  document.querySelectorAll('.hist-route').forEach(btn => {
    btn.addEventListener('click', () => {
      openRouteModal(btn.dataset.id, 'history');
    });
  });

  // Delete
  document.querySelectorAll('.hist-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const inv = Invoices.get(btn.dataset.id);
      if (inv && confirm(`Delete invoice ${inv.invoiceNumber}? This cannot be undone.`)) {
        Invoices.delete(btn.dataset.id);
        showToast(`Invoice ${inv.invoiceNumber} deleted.`, 'error');
        renderHistory();
      }
    });
  });
}

/**
 * Render invoice view page (standalone view).
 */
export function renderInvoiceView(id) {
  const app = document.getElementById('app');
  let inv = Invoices.get(id);
  if (!inv) {
    app.innerHTML = '<div class="card"><p>Invoice not found.</p></div>';
    return;
  }

  app.innerHTML = `
    <div class="page-header">
      <h1>Invoice ${escHtml(inv.invoiceNumber)}</h1>
      <p>Preview and manage this invoice</p>
    </div>

    <div class="preview-container">
      <div class="preview-actions">
        <button class="btn btn-secondary" id="view-sig-btn">✍️ Toggle Digital Signature</button>
        <button class="btn btn-secondary" id="view-date-btn">📅 Edit Date</button>
        <button class="btn btn-primary" id="view-pdf-btn">📄 Generate PDF</button>
        <button class="btn btn-secondary" id="view-print-btn">🖨 Print Invoice</button>
        <button class="btn btn-outline" id="view-edit-btn">✏ Edit Form</button>
        <button class="btn btn-secondary" id="view-route-btn">📍 Edit Route</button>
        <button class="btn btn-secondary" id="view-back-btn">← Back to History</button>
      </div>
      <div id="preview-content">
        ${renderInvoice(inv)}
      </div>
    </div>
  `;

  function refreshView() {
    const previewContent = document.getElementById('preview-content');
    if (!previewContent) return;
    previewContent.innerHTML = renderInvoice(inv);
    attachInvoiceInteractivity(previewContent, inv, (updated) => {
      inv = updated;
      refreshView();
    });
  }

  refreshView();

  // Toggle Digital Signature button
  document.getElementById('view-sig-btn').addEventListener('click', () => {
    const current = inv.digitalSignature !== false && inv.digitalSignature !== undefined && inv.digitalSignature !== null
      ? !!inv.digitalSignature
      : false;
    const next = !current;
    inv.digitalSignature = next;
    Invoices.update(id, { digitalSignature: next });
    showToast(next ? '✍️ Digital signature added!' : 'Digital signature removed.', 'success');
    refreshView();
  });

  // Edit Date button
  document.getElementById('view-date-btn').addEventListener('click', () => {
    openDateEditModal(id, inv.date, (newDate) => {
      inv.date = newDate;
      refreshView();
    });
  });

  document.getElementById('view-pdf-btn').addEventListener('click', () => {
    generatePDF(inv.invoiceNumber);
  });

  document.getElementById('view-print-btn').addEventListener('click', () => {
    printInvoice();
  });

  document.getElementById('view-edit-btn').addEventListener('click', () => {
    navigate(`edit-invoice/${id}`);
  });

  document.getElementById('view-route-btn').addEventListener('click', () => {
    openRouteModal(id, 'view');
  });

  document.getElementById('view-back-btn').addEventListener('click', () => {
    navigate('history');
  });
}

/**
 * Open a modal to quickly edit only the From/To route of a saved invoice.
 * @param {string} invId
 * @param {'history'|'view'} context — where the modal was opened from
 */
function openRouteModal(invId, context) {
  const inv = Invoices.get(invId);
  if (!inv) return;

  // Remove any existing modal
  document.getElementById('route-modal-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'route-modal-overlay';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="route-modal-title">
      <div class="modal-header" id="route-modal-title">📍 Edit Route — ${escHtml(inv.invoiceNumber)}</div>
      <div class="modal-body">
        <div class="form-group">
          <label for="route-from">From (Village/City)</label>
          <input type="text" id="route-from" placeholder="Enter origin village or city" value="${escHtml(inv.fromLocation || '')}">
        </div>
        <div class="form-group">
          <label for="route-to">To (Village/City)</label>
          <input type="text" id="route-to" placeholder="Enter destination village or city" value="${escHtml(inv.toLocation || '')}">
        </div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" id="route-cancel-btn">Cancel</button>
        <button type="button" class="btn btn-primary" id="route-save-btn">💾 Save Route</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();

  document.getElementById('route-cancel-btn').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  const fromInput = document.getElementById('route-from');
  fromInput.focus();
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
    if (e.key === 'Enter' && (e.target.id === 'route-from' || e.target.id === 'route-to')) {
      e.preventDefault();
      document.getElementById('route-save-btn').click();
    }
  });

  document.getElementById('route-save-btn').addEventListener('click', () => {
    const fromLocation = fromInput.value.trim();
    const toLocation = document.getElementById('route-to').value.trim();

    Invoices.update(invId, { fromLocation, toLocation });
    showToast(`Route updated for invoice ${inv.invoiceNumber}.`, 'success');
    close();

    if (context === 'view') {
      const updated = Invoices.get(invId);
      const previewContent = document.getElementById('preview-content');
      if (updated && previewContent) {
        previewContent.innerHTML = renderInvoice(updated);
        attachInvoiceInteractivity(previewContent, updated, (up) => {
          previewContent.innerHTML = renderInvoice(up);
        });
      }
    } else {
      const all = Invoices.getAll();
      const q = (document.getElementById('history-search')?.value || '').toLowerCase().trim();
      const filtered = q ? Invoices.search(q) : all;
      document.getElementById('history-table-container').innerHTML = renderHistoryTable(filtered);
      bindTableActions();
    }
  });
}

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
