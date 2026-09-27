// ============================================================
// invoice-preview.js — A4 Invoice HTML Template Renderer
// ============================================================

import { formatCurrency, formatDate, toInputDate, numberToWords } from './utils.js';
import { Settings, Invoices } from './store.js';
import { showToast } from './app.js';
import { generatePDF, printInvoice } from './invoice-pdf.js';

// Default Terms & Conditions
const DEFAULT_TERMS = `1. The company will not be responsible for damage caused by fire, water, or accidents.
2. If goods are not received, this must be reported within 10 days. If it is not reported within that time, we will not be responsible for those goods.
3. We will not be responsible for breakable items such as glassware and furniture, or for leakage of oil and other substances.
4. For goods that are banned or controlled by the Central or State Government, the person sending the goods will be responsible.
5. Once you are notified that the goods have arrived, take delivery as soon as possible. If you delay and any damage occurs afterward, we will not be responsible.
6. The goods owner must arrange, at their own expense, all legal documents required by government or cooperative bodies for dispatching the goods, and also the insurance. We have no legal responsibility for this.`;

export { DEFAULT_TERMS };

/**
 * Generate the A4 invoice HTML from invoice data.
 * @param {object} data — invoice data object
 * @returns {string} HTML string
 */
export function renderInvoice(data) {
  const settings = Settings.get();

  const items = data.items || [];
  const subtotal = items.reduce((sum, item) => sum + (Number(item.finalAmount) || 0), 0);
  const otherCharges = Number(data.otherCharges) || 0;
  const totalAmount = subtotal + otherCharges;

  const amountWords = totalAmount > 0
    ? `Rupees ${numberToWords(totalAmount)} Only`
    : 'Rupees Zero Only';

  const itemRows = items.map((item, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escapeHtml(item.name || '')}</td>
      <td>${escapeHtml(item.quantity || '')}</td>
      <td>${item.weightInTons !== '' && item.weightInTons !== null && item.weightInTons !== undefined ? item.weightInTons : ''}</td>
      <td>${item.perTonAmount ? formatCurrency(item.perTonAmount) : ''}</td>
      <td>${item.finalAmount ? formatCurrency(item.finalAmount) : ''}</td>
    </tr>
  `).join('');

  // If no items, show an empty row
  const tableBody = items.length > 0 ? itemRows : `
    <tr>
      <td colspan="6" style="text-align:center; color:#94a3b8; padding:20px;">No items added</td>
    </tr>
  `;

  // Ensure truck number is always uppercase
  const truckNo = (data.truckNo || '').toUpperCase();

  // Terms & conditions - use provided or default
  const termsText = data.terms || DEFAULT_TERMS;

  const hasSignature = data.digitalSignature !== false && data.digitalSignature !== undefined && data.digitalSignature !== null
    ? !!data.digitalSignature
    : false;

  return `
    <div class="invoice-page" id="invoice-page" data-id="${escapeHtml(data.id || '')}" data-invnum="${escapeHtml(data.invoiceNumber || '')}">
      <!-- Header Band -->
      <div class="inv-header">
        <div class="inv-header-left">
          <div class="inv-header-logo-row">
            <img src="assets/logo.png" alt="Logo" class="inv-logo">
            <div class="inv-header-info">
              <div class="inv-company-name">${escapeHtml(settings.companyName)}</div>
              <div class="inv-company-address">${escapeHtml(settings.companyAddress)}</div>
              <div class="inv-company-contact">
                Mob: ${escapeHtml(settings.companyMobile)}<br>
                Email: ${escapeHtml(settings.companyEmail)}
              </div>
            </div>
          </div>
        </div>
        <div class="inv-header-right">
          <div class="inv-title">INVOICE</div>
          <div class="inv-meta">
            <strong>Invoice No:</strong> ${escapeHtml(data.invoiceNumber || '')}<br>
            <strong>Date:</strong> <span class="inv-date-editable" id="inv-preview-date" data-id="${escapeHtml(data.id || '')}" data-date="${escapeHtml(data.date || '')}" title="Click or Right-Click to Edit Date">${data.date ? formatDate(data.date) : ''} <span class="edit-icon">✏️</span></span>
          </div>
        </div>
      </div>

      <!-- Body -->
      <div class="inv-body">
        <!-- Bill From / Bill To -->
        <div class="inv-parties">
          <div class="inv-party">
            <div class="inv-party-label">Bill From (Sender)</div>
            <div class="inv-party-name">${escapeHtml(data.senderName || '')}</div>
            <div class="inv-party-detail">
              ${escapeHtml(data.senderAddress || '')}<br>
              ${data.senderMobile ? 'Mob: ' + escapeHtml(data.senderMobile) : ''}
            </div>
          </div>
          <div class="inv-party">
            <div class="inv-party-label">Bill To (Receiver)</div>
            <div class="inv-party-name">${escapeHtml(data.receiverName || '')}</div>
            <div class="inv-party-detail">
              ${escapeHtml(data.receiverAddress || '')}<br>
              ${data.receiverMobile ? 'Mob: ' + escapeHtml(data.receiverMobile) : ''}
            </div>
          </div>
        </div>

        <!-- Truck Details -->
        <div class="inv-truck">
          <div class="inv-truck-label">Truck Details</div>
          <div class="inv-truck-details">
            <div class="inv-truck-item">
              <strong>Truck No</strong>
              <span>${escapeHtml(truckNo)}</span>
            </div>
            <div class="inv-truck-item">
              <strong>Owner Name</strong>
              <span>${escapeHtml(data.ownerName || '')}</span>
            </div>
            <div class="inv-truck-item">
              <strong>Driver Name</strong>
              <span>${escapeHtml(data.driverName || '')}</span>
            </div>
            <div class="inv-truck-item">
              <strong>Driver Mobile No</strong>
              <span>${escapeHtml(data.driverMobile || '')}</span>
            </div>
          </div>
        </div>

        <!-- Items Table -->
        <div class="inv-items">
          <table>
            <thead>
              <tr>
                <th>Sr.</th>
                <th>Item</th>
                <th>Quantity</th>
                <th>Weight in Tons</th>
                <th>Rate Per Ton</th>
                <th>Final Amount</th>
              </tr>
            </thead>
            <tbody>
              ${tableBody}
            </tbody>
          </table>
        </div>

        <!-- Totals -->
        <div class="inv-totals">
          <div class="inv-totals-box">
            <div class="inv-totals-row">
              <span class="inv-totals-label">Subtotal</span>
              <span class="inv-totals-value">${formatCurrency(subtotal)}</span>
            </div>
            ${otherCharges > 0 ? `
            <div class="inv-totals-row">
              <span class="inv-totals-label">Other Charges</span>
              <span class="inv-totals-value">+ ${formatCurrency(otherCharges)}</span>
            </div>` : ''}
            <div class="inv-totals-row inv-grand-total">
              <span class="inv-totals-label">Total Amount</span>
              <span class="inv-totals-value">${formatCurrency(totalAmount)}</span>
            </div>
          </div>
        </div>

        <!-- Amount in Words -->
        <div class="inv-words">
          <div class="inv-words-label">Amount in Words</div>
          <div class="inv-words-text">${escapeHtml(amountWords)}</div>
        </div>

        <!-- Transport Route -->
        <div class="inv-route">
          <div class="inv-route-point">
            <span class="inv-route-label">From (Village/City)</span>
            <span class="inv-route-value">${escapeHtml(data.fromLocation || '—')}</span>
          </div>
          <div class="inv-route-arrow" aria-hidden="true">→</div>
          <div class="inv-route-point">
            <span class="inv-route-label">To (Village/City)</span>
            <span class="inv-route-value">${escapeHtml(data.toLocation || '—')}</span>
          </div>
        </div>

        <!-- Terms & Conditions -->
        <div class="inv-rules">
          <div class="inv-rules-label">Terms & Conditions</div>
          <div class="inv-rules-content">${escapeHtml(termsText)}</div>
        </div>

        <!-- Signatures -->
        <div class="inv-signatures">
          <div class="inv-signature-box inv-driver-sig">
            <div class="inv-signature-company">Driver Signature</div>
            <div class="inv-signature-line">Driver Signature</div>
          </div>
          <div class="inv-signature-box inv-company-sig ${hasSignature ? 'has-signature' : ''}" id="inv-company-sig-box" data-id="${escapeHtml(data.id || '')}" title="Right-click to Add/Remove Digital Signature">
            <div class="inv-signature-company">For ${escapeHtml(settings.companyName)}</div>
            <div class="inv-digital-sig-wrap ${hasSignature ? '' : 'hidden'}" id="inv-digital-sig-wrap">
              <img src="assets/signature.png" alt="Digital Signature" class="inv-digital-sig-img" id="inv-digital-sig-img">
            </div>
            <div class="inv-signature-line">Authorized Signature</div>
          </div>
        </div>
      </div>

      <!-- Footer Line -->
      <div class="inv-footer"></div>
    </div>
  `;
}

/**
 * Open a focused modal to edit the invoice date.
 * @param {string|null} invoiceId - id of the saved invoice, or null for unsaved preview
 * @param {string} currentDate - current date value
 * @param {Function} onSaved - callback receiving (newDate)
 */
export function openDateEditModal(invoiceId, currentDate, onSaved) {
  const inv = invoiceId ? Invoices.get(invoiceId) : null;
  const initialDate = toInputDate(currentDate || (inv ? inv.date : new Date()));

  // Remove any existing date modal
  document.getElementById('date-modal-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'date-modal-overlay';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="date-modal-title">
      <div class="modal-header" id="date-modal-title">📅 Edit Invoice Date${inv ? ' — ' + inv.invoiceNumber : ''}</div>
      <div class="modal-body">
        <div class="form-group">
          <label for="modal-date-input">Select Date</label>
          <input type="date" id="modal-date-input" value="${initialDate}">
        </div>
        <div style="display:flex; gap:8px; margin-top:10px;">
          <button type="button" class="btn btn-sm btn-outline" id="date-btn-today">Today</button>
          <button type="button" class="btn btn-sm btn-outline" id="date-btn-yesterday">Yesterday</button>
        </div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" id="date-cancel-btn">Cancel</button>
        <button type="button" class="btn btn-primary" id="date-save-btn">💾 Save Date</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  document.getElementById('date-cancel-btn').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  const dateInput = document.getElementById('modal-date-input');
  dateInput.focus();

  document.getElementById('date-btn-today').addEventListener('click', () => {
    dateInput.value = toInputDate(new Date());
  });

  document.getElementById('date-btn-yesterday').addEventListener('click', () => {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    dateInput.value = toInputDate(y);
  });

  const save = () => {
    const newDate = dateInput.value;
    if (!newDate) {
      showToast('Please select a valid date.', 'warning');
      return;
    }
    if (invoiceId) {
      Invoices.update(invoiceId, { date: newDate });
    }
    showToast('Invoice date updated successfully!', 'success');
    close();
    if (typeof onSaved === 'function') {
      onSaved(newDate);
    }
  };

  document.getElementById('date-save-btn').addEventListener('click', save);
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
    if (e.key === 'Enter') {
      e.preventDefault();
      save();
    }
  });
}

/**
 * Remove any open context menu from the DOM.
 */
export function removeContextMenu() {
  document.querySelector('.custom-context-menu')?.remove();
}

/**
 * Attach right-click context menu and interactive handlers to an invoice preview element.
 * @param {HTMLElement} container - container containing the invoice HTML
 * @param {object} invoiceData - current invoice data object
 * @param {Function} onUpdate - callback when invoiceData changes (e.g. signature toggled or date edited)
 */
export function attachInvoiceInteractivity(container, invoiceData, onUpdate) {
  if (!container) return;

  const page = container.querySelector('.invoice-page') || container;

  // 1. Right Click Context Menu
  page.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    removeContextMenu();

    const hasSig = invoiceData.digitalSignature !== false && invoiceData.digitalSignature !== undefined && invoiceData.digitalSignature !== null
      ? !!invoiceData.digitalSignature
      : false;

    const menu = document.createElement('div');
    menu.className = 'custom-context-menu';
    menu.innerHTML = `
      <button type="button" class="context-menu-item" id="ctx-toggle-signature">
        ✍️ ${hasSig ? 'Remove Digital Signature' : 'Add Digital Signature'}
      </button>
      <button type="button" class="context-menu-item" id="ctx-edit-date">
        📅 Edit Date
      </button>
      <div class="context-menu-divider"></div>
      <button type="button" class="context-menu-item" id="ctx-print">
        🖨️ Print Invoice
      </button>
      <button type="button" class="context-menu-item" id="ctx-pdf">
        📄 Download PDF
      </button>
    `;

    document.body.appendChild(menu);

    // Position menu within viewport
    const menuWidth = 220;
    const menuHeight = 160;
    let posX = e.clientX;
    let posY = e.clientY;

    if (posX + menuWidth > window.innerWidth) posX = window.innerWidth - menuWidth - 10;
    if (posY + menuHeight > window.innerHeight) posY = window.innerHeight - menuHeight - 10;

    menu.style.left = `${posX}px`;
    menu.style.top = `${posY}px`;

    // Handle button clicks in context menu
    menu.querySelector('#ctx-toggle-signature').addEventListener('click', () => {
      removeContextMenu();
      toggleSignature();
    });

    menu.querySelector('#ctx-edit-date').addEventListener('click', () => {
      removeContextMenu();
      triggerEditDate();
    });

    menu.querySelector('#ctx-print').addEventListener('click', () => {
      removeContextMenu();
      printInvoice();
    });

    menu.querySelector('#ctx-pdf').addEventListener('click', () => {
      removeContextMenu();
      generatePDF(invoiceData.invoiceNumber);
    });
  });

  // 2. Click on Date to edit
  const dateEl = container.querySelector('#inv-preview-date');
  if (dateEl) {
    dateEl.addEventListener('click', (e) => {
      e.stopPropagation();
      triggerEditDate();
    });
  }

  // 3. Click on Signature Box to toggle
  const sigBox = container.querySelector('#inv-company-sig-box');
  if (sigBox) {
    sigBox.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSignature();
    });
  }

  function toggleSignature() {
    const current = invoiceData.digitalSignature !== false && invoiceData.digitalSignature !== undefined && invoiceData.digitalSignature !== null
      ? !!invoiceData.digitalSignature
      : false;
    const next = !current;
    invoiceData.digitalSignature = next;

    if (invoiceData.id) {
      Invoices.update(invoiceData.id, { digitalSignature: next });
    }

    showToast(next ? '✍️ Digital signature added!' : 'Digital signature removed.', 'success');

    if (typeof onUpdate === 'function') {
      onUpdate(invoiceData);
    }
  }

  function triggerEditDate() {
    openDateEditModal(invoiceData.id, invoiceData.date, (newDate) => {
      invoiceData.date = newDate;
      if (typeof onUpdate === 'function') {
        onUpdate(invoiceData);
      }
    });
  }
}

// Global click and Escape listeners to close context menu
document.addEventListener('click', (e) => {
  if (!e.target.closest('.custom-context-menu')) {
    removeContextMenu();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    removeContextMenu();
  }
});

/**
 * Escape HTML special characters.
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
