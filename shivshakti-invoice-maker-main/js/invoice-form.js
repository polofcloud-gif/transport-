// ============================================================
// invoice-form.js — Invoice Creation / Editing Form
// ============================================================

import { Settings, Invoices, Customers, Trucks } from './store.js';
import { toInputDate, formatCurrency, parseCurrency } from './utils.js';
import { renderInvoice, DEFAULT_TERMS, openDateEditModal, attachInvoiceInteractivity } from './invoice-preview.js';
import { generatePDF, printInvoice } from './invoice-pdf.js';
import { showToast, navigate } from './app.js';
import { TypeHistory } from './type-history.js';

let currentInvoice = null;
let isEditMode = false;

/**
 * Render the invoice form page.
 * @param {string|null} editId — if provided, loads existing invoice for editing
 */
export function renderInvoiceForm(editId = null) {
  const app = document.getElementById('app');
  isEditMode = !!editId;

  if (editId) {
    currentInvoice = Invoices.get(editId);
    if (!currentInvoice) {
      app.innerHTML = '<div class="card"><p>Invoice not found.</p></div>';
      return;
    }
  } else {
    currentInvoice = null;
  }

  const invNumber = isEditMode ? currentInvoice.invoiceNumber : Settings.peekNextInvoiceNumber();
  const invDate = isEditMode ? toInputDate(currentInvoice.date) : toInputDate(new Date());
  const items = isEditMode ? currentInvoice.items : [{ name: '', quantity: '', weightInTons: '', perTonAmount: '', finalAmount: '' }];

  app.innerHTML = `
    <div class="page-header">
      <h1>${isEditMode ? 'Edit Invoice' : 'Create New Invoice'}</h1>
      <p>${isEditMode ? 'Modify invoice details and save changes' : 'Fill in the details below to generate a transport invoice'}</p>
    </div>

    <div class="card" id="invoice-form-card">
      <form id="invoice-form" autocomplete="off">

        <!-- A. Invoice Details -->
        <div class="form-section">
          <div class="form-section-title">📋 Invoice Details</div>
          <div class="form-row">
            <div class="form-group">
              <label for="invoiceNumber">Invoice Number</label>
              <input type="text" id="invoiceNumber" value="${invNumber}" readonly>
            </div>
            <div class="form-group">
              <label for="invoiceDate" style="display:flex; justify-content:space-between; align-items:center;">
                <span>Invoice Date</span>
                <button type="button" class="link-btn" id="set-today-date" style="font-size:11px; padding:0; text-decoration:underline;">Set Today</button>
              </label>
              <input type="date" id="invoiceDate" value="${invDate}" required>
            </div>
            <div class="form-group">
              <label for="invoiceStatus">Status</label>
              <select id="invoiceStatus">
                <option value="pending" ${isEditMode && currentInvoice.status === 'pending' ? 'selected' : ''}>Pending</option>
                <option value="paid" ${isEditMode && currentInvoice.status === 'paid' ? 'selected' : ''}>Paid</option>
                <option value="cancelled" ${isEditMode && currentInvoice.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
              </select>
            </div>
          </div>
        </div>

        <!-- B. Sender Details -->
        <div class="form-section">
          <div class="form-section-title">📦 Bill From (Sender)</div>
          <div class="form-row">
            <div class="form-group autocomplete-wrapper">
              <label for="senderName">Sender Name</label>
              <input type="text" id="senderName" placeholder="Enter sender name" value="${isEditMode ? esc(currentInvoice.senderName) : ''}" required>
              <div class="autocomplete-list" id="senderAC"></div>
            </div>
            <div class="form-group">
              <label for="senderMobile">Sender Mobile</label>
              <input type="tel" id="senderMobile" placeholder="Mobile number" value="${isEditMode ? esc(currentInvoice.senderMobile) : ''}">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="senderAddress">Sender Address</label>
              <textarea id="senderAddress" rows="2" placeholder="Full address">${isEditMode ? esc(currentInvoice.senderAddress) : ''}</textarea>
            </div>
          </div>
        </div>

        <!-- C. Receiver Details -->
        <div class="form-section">
          <div class="form-section-title">📬 Bill To (Receiver)</div>
          <div class="form-row">
            <div class="form-group autocomplete-wrapper">
              <label for="receiverName">Receiver Name</label>
              <input type="text" id="receiverName" placeholder="Enter receiver name" value="${isEditMode ? esc(currentInvoice.receiverName) : ''}" required>
              <div class="autocomplete-list" id="receiverAC"></div>
            </div>
            <div class="form-group">
              <label for="receiverMobile">Receiver Mobile</label>
              <input type="tel" id="receiverMobile" placeholder="Mobile number" value="${isEditMode ? esc(currentInvoice.receiverMobile) : ''}">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="receiverAddress">Receiver Address</label>
              <textarea id="receiverAddress" rows="2" placeholder="Full address">${isEditMode ? esc(currentInvoice.receiverAddress) : ''}</textarea>
            </div>
          </div>
        </div>

        <!-- D. Route Details -->
        <div class="form-section">
          <div class="form-section-title">📍 Route Details</div>
          <div class="form-row">
            <div class="form-group">
              <label for="fromLocation">From (Village/City)</label>
              <input type="text" id="fromLocation" placeholder="Enter origin village or city" value="${isEditMode ? esc(currentInvoice.fromLocation) : ''}">
            </div>
            <div class="form-group">
              <label for="toLocation">To (Village/City)</label>
              <input type="text" id="toLocation" placeholder="Enter destination village or city" value="${isEditMode ? esc(currentInvoice.toLocation) : ''}">
            </div>
          </div>
        </div>

        <!-- E. Truck Details -->
        <div class="form-section">
          <div class="form-section-title">🚛 Truck Details</div>
          <div class="form-row">
            <div class="form-group autocomplete-wrapper">
              <label for="truckNo">Truck No</label>
              <input type="text" id="truckNo" placeholder="e.g. MH-19-AB-1234" value="${isEditMode ? esc((currentInvoice.truckNo || '').toUpperCase()) : ''}" style="text-transform:uppercase;">
              <div class="autocomplete-list" id="truckAC"></div>
            </div>
            <div class="form-group">
              <label for="ownerName">Owner Name</label>
              <input type="text" id="ownerName" placeholder="Truck owner" value="${isEditMode ? esc(currentInvoice.ownerName) : ''}">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="driverName">Driver Name</label>
              <input type="text" id="driverName" placeholder="Driver name" value="${isEditMode ? esc(currentInvoice.driverName) : ''}">
            </div>
            <div class="form-group">
              <label for="driverMobile">Driver Mobile No</label>
              <input type="tel" id="driverMobile" placeholder="Driver mobile" value="${isEditMode ? esc(currentInvoice.driverMobile) : ''}">
            </div>
          </div>
        </div>

        <!-- F. Item Details -->
        <div class="form-section">
          <div class="form-section-title">📦 Transport / Goods Details</div>
          <div class="table-wrapper">
            <table class="items-table" id="items-table">
              <thead>
                <tr>
                  <th style="width:40px">Sr.</th>
                  <th>Item</th>
                  <th style="width:140px">Quantity</th>
                  <th style="width:110px">Wt. in Tons</th>
                  <th style="width:140px">Rate Per Ton (₹)</th>
                  <th style="width:140px">Final Amount (₹)</th>
                  <th style="width:50px"></th>
                </tr>
              </thead>
              <tbody id="items-body">
              </tbody>
            </table>
          </div>
          <div style="margin-top:12px;">
            <button type="button" class="btn btn-outline btn-sm" id="add-item-btn">+ Add Item</button>
          </div>
        </div>

        <!-- G. Charges (No discount) -->
        <div class="form-section">
          <div class="totals-section">
            <div class="totals-box">
              <div class="totals-row">
                <label>Subtotal</label>
                <div class="totals-value" id="subtotalDisplay">₹0</div>
              </div>
              <div class="totals-row">
                <label for="otherCharges">Other Charges (₹)</label>
                <input type="number" id="otherCharges" min="0" step="any" value="${isEditMode ? (currentInvoice.otherCharges || 0) : 0}" placeholder="0">
              </div>
              <div class="totals-row total-final">
                <label>Total Amount</label>
                <div class="totals-value" id="totalDisplay">₹0</div>
              </div>
            </div>
          </div>
        </div>

        <!-- H. Signature & Terms -->
        <div class="form-section">
          <div class="form-section-title">✍️ Digital Signature & Terms</div>
          <div class="form-group" style="margin-bottom:14px; background:var(--surface-alt); padding:12px 14px; border-radius:8px; border:1px solid var(--border);">
            <label style="display:inline-flex; align-items:center; gap:10px; cursor:pointer; font-weight:600; font-size:14px; color:#1e293b; user-select:none;">
              <input type="checkbox" id="digitalSignature" ${!isEditMode || currentInvoice.digitalSignature !== false ? 'checked' : ''} style="width:18px; height:18px; accent-color:#2563eb; cursor:pointer;">
              <span>✍️ Include Digital Signature (Authorized Signatory)</span>
            </label>
            <p style="font-size:12px; color:#64748b; margin-top:4px; margin-left:28px;">Adds official digital signature above the signature line. You can also right-click anywhere on the preview to toggle it.</p>
          </div>
          <div class="form-group">
            <label for="invoiceTerms">Terms & Conditions</label>
            <textarea id="invoiceTerms" rows="6" placeholder="Terms & conditions">${isEditMode ? esc(currentInvoice.terms || DEFAULT_TERMS) : esc(DEFAULT_TERMS)}</textarea>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="btn-group" style="margin-top:24px;">
          <button type="button" class="btn btn-primary btn-lg" id="preview-btn">👁 Preview Invoice</button>
          <button type="button" class="btn btn-success btn-lg" id="save-btn">💾 Save Invoice</button>
          <button type="button" class="btn btn-secondary" id="clear-btn">🗑 Clear Form</button>
        </div>
      </form>
    </div>

    <!-- Preview Area -->
    <div id="preview-area" style="display:none;">
      <div class="preview-container">
        <div class="preview-actions">
          <button type="button" class="btn btn-secondary" id="form-sig-btn">✍️ Toggle Digital Signature</button>
          <button type="button" class="btn btn-secondary" id="form-date-btn">📅 Edit Date</button>
          <button type="button" class="btn btn-primary" id="pdf-btn">📄 Generate PDF</button>
          <button type="button" class="btn btn-secondary" id="print-btn">🖨 Print Invoice</button>
          <button type="button" class="btn btn-secondary" id="close-preview-btn">✕ Close Preview</button>
        </div>
        <div id="preview-content"></div>
      </div>
    </div>
  `;

  // Seed type history from existing invoices
  TypeHistory.seedFromExistingInvoices(Invoices.getAll());

  // Populate items
  const tbody = document.getElementById('items-body');
  items.forEach((item, i) => addItemRow(tbody, item, i));

  // Bind events
  bindFormEvents();
  recalculate();
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function addItemRow(tbody, item = {}, index = null) {
  const idx = index !== null ? index : tbody.rows.length;
  const tr = document.createElement('tr');

  // finalAmount: if item has a value, use it; otherwise empty
  const finalVal = item.finalAmount !== '' && item.finalAmount !== null && item.finalAmount !== undefined && item.finalAmount !== 0
    ? item.finalAmount : '';

  // weightInTons: the numeric field used for calculation
  const weightVal = item.weightInTons !== '' && item.weightInTons !== null && item.weightInTons !== undefined ? item.weightInTons : '';

  tr.innerHTML = `
    <td style="text-align:center; color:#64748b; font-weight:600;">${idx + 1}</td>
    <td><input type="text" class="item-name" value="${esc(item.name || '')}" placeholder="e.g. Starch Powder"></td>
    <td><input type="text" class="item-qty" value="${esc(item.quantity || '')}" placeholder="e.g. 350 Bags"></td>
    <td><input type="number" class="item-weight" min="0" step="any" value="${weightVal}" placeholder="Tons"></td>
    <td><input type="number" class="item-rate" min="0" step="any" value="${item.perTonAmount !== '' && item.perTonAmount !== null && item.perTonAmount !== undefined ? item.perTonAmount : ''}" placeholder="Rate"></td>
    <td><input type="number" class="item-final" min="0" step="any" value="${finalVal}" placeholder="Amount"></td>
    <td><button type="button" class="remove-row-btn" title="Remove item">✕</button></td>
  `;
  tbody.appendChild(tr);

  // Attach type history autocomplete for item name
  const nameInput = tr.querySelector('.item-name');
  if (nameInput) {
    TypeHistory.attachAutocomplete(nameInput, 'itemName');
  }

  // Track whether user manually edited the final amount
  let userEditedFinal = false;

  const weightInput = tr.querySelector('.item-weight');
  const rateInput = tr.querySelector('.item-rate');
  const finalInput = tr.querySelector('.item-final');

  function autoCalcRow() {
    // Only auto-calculate if user has NOT manually edited the final amount
    if (userEditedFinal) return;
    const weight = parseFloat(weightInput.value);
    const rate = parseFloat(rateInput.value);
    if (!isNaN(weight) && !isNaN(rate) && weight > 0 && rate > 0) {
      finalInput.value = (weight * rate).toFixed(2).replace(/\.00$/, '');
    }
    recalculate();
  }

  weightInput.addEventListener('input', () => {
    userEditedFinal = false; // Reset when weight changes
    autoCalcRow();
  });

  rateInput.addEventListener('input', () => {
    userEditedFinal = false; // Reset when rate changes
    autoCalcRow();
  });

  finalInput.addEventListener('input', () => {
    userEditedFinal = true; // User is manually editing final amount
    recalculate();
  });

  tr.querySelector('.remove-row-btn').addEventListener('click', () => {
    tr.remove();
    renumberItems();
    recalculate();
  });
}

function renumberItems() {
  const rows = document.querySelectorAll('#items-body tr');
  rows.forEach((row, i) => {
    row.querySelector('td:first-child').textContent = i + 1;
  });
}

function recalculate() {
  const rows = document.querySelectorAll('#items-body tr');
  let subtotal = 0;
  rows.forEach(row => {
    const finalInput = row.querySelector('.item-final');
    const finalVal = parseFloat(finalInput?.value) || 0;
    subtotal += finalVal;
  });

  const otherCharges = parseFloat(document.getElementById('otherCharges')?.value) || 0;
  const total = subtotal + otherCharges;

  const subtotalEl = document.getElementById('subtotalDisplay');
  const totalEl = document.getElementById('totalDisplay');
  if (subtotalEl) subtotalEl.textContent = formatCurrency(subtotal);
  if (totalEl) totalEl.textContent = formatCurrency(total);
}

function getFormData() {
  const rows = document.querySelectorAll('#items-body tr');
  const items = [];
  rows.forEach(row => {
    const name = row.querySelector('.item-name')?.value || '';
    const quantity = row.querySelector('.item-qty')?.value.trim() || '';   // free text
    const weightVal = row.querySelector('.item-weight')?.value;
    const rateVal = row.querySelector('.item-rate')?.value;
    const finalVal = row.querySelector('.item-final')?.value;

    const weightInTons = weightVal !== '' ? parseFloat(weightVal) : '';
    const perTonAmount = rateVal !== '' ? parseFloat(rateVal) : '';
    const finalAmount = finalVal !== '' ? parseFloat(finalVal) : 0;

    items.push({ name, quantity, weightInTons, perTonAmount, finalAmount });
  });

  const subtotal = items.reduce((s, it) => s + (Number(it.finalAmount) || 0), 0);
  const otherCharges = parseFloat(document.getElementById('otherCharges').value) || 0;
  const totalAmount = subtotal + otherCharges;

  // Force truck number to uppercase
  const truckNo = document.getElementById('truckNo').value.trim().toUpperCase();

  return {
    id: isEditMode ? currentInvoice.id : null,
    invoiceNumber: document.getElementById('invoiceNumber').value,
    date: document.getElementById('invoiceDate').value,
    status: document.getElementById('invoiceStatus').value,
    senderName: document.getElementById('senderName').value.trim(),
    senderAddress: document.getElementById('senderAddress').value.trim(),
    senderMobile: document.getElementById('senderMobile').value.trim(),
    receiverName: document.getElementById('receiverName').value.trim(),
    receiverAddress: document.getElementById('receiverAddress').value.trim(),
    receiverMobile: document.getElementById('receiverMobile').value.trim(),
    fromLocation: document.getElementById('fromLocation').value.trim(),
    toLocation: document.getElementById('toLocation').value.trim(),
    truckNo,
    ownerName: document.getElementById('ownerName').value.trim(),
    driverName: document.getElementById('driverName').value.trim(),
    driverMobile: document.getElementById('driverMobile').value.trim(),
    items,
    subtotal,
    otherCharges,
    totalAmount,
    terms: document.getElementById('invoiceTerms').value.trim(),
    digitalSignature: document.getElementById('digitalSignature') ? document.getElementById('digitalSignature').checked : true
  };
}

function bindFormEvents() {
  // Set Today date shortcut
  document.getElementById('set-today-date')?.addEventListener('click', () => {
    document.getElementById('invoiceDate').value = toInputDate(new Date());
    showToast('Invoice date set to today.', 'success');
  });

  // Add Item
  document.getElementById('add-item-btn').addEventListener('click', () => {
    const tbody = document.getElementById('items-body');
    addItemRow(tbody, {}, tbody.rows.length);
  });

  // Recalc on other charges change
  document.getElementById('otherCharges').addEventListener('input', recalculate);

  // Force truck number uppercase on blur
  const truckInput = document.getElementById('truckNo');
  truckInput.addEventListener('blur', () => {
    truckInput.value = truckInput.value.toUpperCase();
  });

  function renderFormPreview() {
    const data = getFormData();
    const previewContent = document.getElementById('preview-content');
    previewContent.innerHTML = renderInvoice(data);
    attachInvoiceInteractivity(previewContent, data, (updated) => {
      if (document.getElementById('digitalSignature')) {
        document.getElementById('digitalSignature').checked = !!updated.digitalSignature;
      }
      if (updated.date) {
        document.getElementById('invoiceDate').value = toInputDate(updated.date);
      }
      renderFormPreview();
    });
    document.getElementById('preview-area').style.display = 'block';
  }

  // Preview button
  document.getElementById('preview-btn').addEventListener('click', () => {
    renderFormPreview();
    document.getElementById('preview-area').scrollIntoView({ behavior: 'smooth' });
  });

  // Form preview Toggle Digital Signature button
  document.getElementById('form-sig-btn')?.addEventListener('click', () => {
    const sigCheckbox = document.getElementById('digitalSignature');
    if (sigCheckbox) {
      sigCheckbox.checked = !sigCheckbox.checked;
      showToast(sigCheckbox.checked ? '✍️ Digital signature added!' : 'Digital signature removed.', 'success');
      renderFormPreview();
    }
  });

  // Form preview Edit Date button
  document.getElementById('form-date-btn')?.addEventListener('click', () => {
    const currentDate = document.getElementById('invoiceDate').value;
    openDateEditModal(null, currentDate, (newDate) => {
      document.getElementById('invoiceDate').value = toInputDate(newDate);
      renderFormPreview();
    });
  });

  // Close Preview
  document.getElementById('close-preview-btn').addEventListener('click', () => {
    document.getElementById('preview-area').style.display = 'none';
  });

  // Generate PDF
  document.getElementById('pdf-btn').addEventListener('click', () => {
    renderFormPreview();
    const data = getFormData();
    setTimeout(() => generatePDF(data.invoiceNumber), 300);
  });

  // Print
  document.getElementById('print-btn').addEventListener('click', () => {
    renderFormPreview();
    setTimeout(() => printInvoice(), 300);
  });

  // Save
  document.getElementById('save-btn').addEventListener('click', () => {
    const data = getFormData();
    if (!data.senderName || !data.receiverName) {
      showToast('Please enter sender and receiver names.', 'warning');
      return;
    }

    // Auto-save sender and receiver as customers if new
    autoSaveCustomer(data.senderName, data.senderAddress, data.senderMobile);
    autoSaveCustomer(data.receiverName, data.receiverAddress, data.receiverMobile);
    autoSaveTruck(data.truckNo, data.ownerName, data.driverName, data.driverMobile);

    // For new invoices, let the store assign the next sequential number
    // (the displayed number is only a preview of what will be assigned).
    if (!isEditMode) {
      delete data.invoiceNumber;
    }

    const saved = Invoices.save(data);
    TypeHistory.recordInvoice(data);
    showToast(`Invoice ${saved.invoiceNumber} saved successfully!`, 'success');

    // If new, assign the invoice number
    if (!isEditMode) {
      document.getElementById('invoiceNumber').value = saved.invoiceNumber;
      isEditMode = true;
      currentInvoice = saved;
    }
  });

  // Clear Form
  document.getElementById('clear-btn').addEventListener('click', () => {
    if (confirm('Clear all form data? Unsaved changes will be lost.')) {
      navigate('new-invoice');
    }
  });

  // Autocomplete for sender
  setupAutocomplete('senderName', 'senderAC', (customer) => {
    document.getElementById('senderAddress').value = customer.address || '';
    document.getElementById('senderMobile').value = customer.mobile || '';
  });

  // Autocomplete for receiver
  setupAutocomplete('receiverName', 'receiverAC', (customer) => {
    document.getElementById('receiverAddress').value = customer.address || '';
    document.getElementById('receiverMobile').value = customer.mobile || '';
  });

  // Autocomplete for truck
  setupTruckAutocomplete();

  // Autocomplete for routes & personnel from Type History
  TypeHistory.attachAutocomplete(document.getElementById('fromLocation'), 'fromLocation');
  TypeHistory.attachAutocomplete(document.getElementById('toLocation'), 'toLocation');
  TypeHistory.attachAutocomplete(document.getElementById('ownerName'), 'ownerName');
  TypeHistory.attachAutocomplete(document.getElementById('driverName'), 'driverName');
}

function setupAutocomplete(inputId, listId, onSelect) {
  const input = document.getElementById(inputId);
  const list = document.getElementById(listId);

  input.addEventListener('input', () => {
    const val = input.value.trim();
    if (val.length < 1) {
      list.classList.remove('active');
      return;
    }

    const matches = Customers.search(val).slice(0, 8);
    if (matches.length === 0) {
      list.classList.remove('active');
      return;
    }

    list.innerHTML = matches.map(c => `
      <div class="autocomplete-item" data-id="${c.id}">
        <div class="ac-name">${esc(c.name)}</div>
        <div class="ac-detail">${esc(c.address || '')} ${c.mobile ? '| ' + c.mobile : ''}</div>
      </div>
    `).join('');
    list.classList.add('active');

    list.querySelectorAll('.autocomplete-item').forEach(item => {
      item.addEventListener('click', () => {
        const customer = Customers.get(item.dataset.id);
        if (customer) {
          input.value = customer.name;
          onSelect(customer);
        }
        list.classList.remove('active');
      });
    });
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.autocomplete-wrapper')) {
      list.classList.remove('active');
    }
  });
}

function setupTruckAutocomplete() {
  const input = document.getElementById('truckNo');
  const list = document.getElementById('truckAC');

  input.addEventListener('input', () => {
    const val = input.value.trim();
    if (val.length < 1) {
      list.classList.remove('active');
      return;
    }

    const matches = Trucks.search(val).slice(0, 8);
    if (matches.length === 0) {
      list.classList.remove('active');
      return;
    }

    list.innerHTML = matches.map(t => `
      <div class="autocomplete-item" data-id="${t.id}">
        <div class="ac-name">${esc(t.truckNo)}</div>
        <div class="ac-detail">${esc(t.ownerName || '')} | ${esc(t.driverName || '')}</div>
      </div>
    `).join('');
    list.classList.add('active');

    list.querySelectorAll('.autocomplete-item').forEach(item => {
      item.addEventListener('click', () => {
        const truck = Trucks.get(item.dataset.id);
        if (truck) {
          input.value = truck.truckNo;
          document.getElementById('ownerName').value = truck.ownerName || '';
          document.getElementById('driverName').value = truck.driverName || '';
          document.getElementById('driverMobile').value = truck.driverMobile || '';
        }
        list.classList.remove('active');
      });
    });
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.autocomplete-wrapper')) {
      list.classList.remove('active');
    }
  });
}

function autoSaveCustomer(name, address, mobile) {
  if (!name) return;
  const existing = Customers.getAll().find(c => c.name.toLowerCase() === name.toLowerCase());
  if (!existing) {
    Customers.save({ name, address: address || '', mobile: mobile || '' });
  }
}

function autoSaveTruck(truckNo, ownerName, driverName, driverMobile) {
  if (!truckNo) return;
  const existing = Trucks.getByNumber(truckNo);
  if (!existing) {
    Trucks.save({ truckNo: truckNo.toUpperCase(), ownerName: ownerName || '', driverName: driverName || '', driverMobile: driverMobile || '' });
  }
}
