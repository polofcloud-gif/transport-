// ============================================================
// customers.js — Customer Management Page
// ============================================================

import { Customers } from './store.js';
import { showToast } from './app.js';

/**
 * Render the customers management page.
 */
export function renderCustomers() {
  const app = document.getElementById('app');
  const customers = Customers.getAll();

  app.innerHTML = `
    <div class="page-header">
      <h1>Customers</h1>
      <p>Manage sender and receiver information for quick invoice creation</p>
    </div>

    <div class="card">
      <div class="search-bar">
        <input type="text" id="customer-search" placeholder="🔍 Search by name, address, or mobile...">
        <button class="btn btn-primary" id="add-customer-btn">+ Add Customer</button>
      </div>

      <div id="customers-table-container">
        ${renderCustomerTable(customers)}
      </div>
    </div>

    <!-- Add/Edit Customer Modal -->
    <div class="modal-overlay hidden" id="customer-modal">
      <div class="modal">
        <div class="modal-header">
          <h3 id="customer-modal-title">Add Customer</h3>
          <button class="modal-close" id="customer-modal-close">✕</button>
        </div>
        <div class="modal-body">
          <form id="customer-form">
            <input type="hidden" id="customerId">
            <div class="form-group" style="margin-bottom:16px;">
              <label for="customerName">Name *</label>
              <input type="text" id="customerName" required placeholder="Customer name">
            </div>
            <div class="form-group" style="margin-bottom:16px;">
              <label for="customerAddress">Address</label>
              <textarea id="customerAddress" rows="2" placeholder="Full address"></textarea>
            </div>
            <div class="form-group" style="margin-bottom:16px;">
              <label for="customerMobile">Mobile Number</label>
              <input type="tel" id="customerMobile" placeholder="Mobile number">
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="customer-modal-cancel">Cancel</button>
          <button class="btn btn-primary" id="customer-modal-save">Save Customer</button>
        </div>
      </div>
    </div>
  `;

  bindCustomerEvents();
}

function renderCustomerTable(customers) {
  if (customers.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-icon">👥</div>
        <p>No customers saved yet. Add your first customer!</p>
      </div>
    `;
  }

  return `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Sr.</th>
            <th>Name</th>
            <th>Address</th>
            <th>Mobile</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${customers.map((c, i) => `
            <tr>
              <td>${i + 1}</td>
              <td><strong>${escHtml(c.name)}</strong></td>
              <td>${escHtml(c.address || '-')}</td>
              <td>${escHtml(c.mobile || '-')}</td>
              <td>
                <div class="btn-group" style="gap:6px;">
                  <button class="btn btn-sm btn-outline cust-edit" data-id="${c.id}" title="Edit">✏ Edit</button>
                  <button class="btn btn-sm btn-danger cust-delete" data-id="${c.id}" title="Delete">🗑</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function bindCustomerEvents() {
  const modal = document.getElementById('customer-modal');

  // Search
  document.getElementById('customer-search').addEventListener('input', (e) => {
    const q = e.target.value.trim();
    const filtered = q ? Customers.search(q) : Customers.getAll();
    document.getElementById('customers-table-container').innerHTML = renderCustomerTable(filtered);
    bindTableActions();
  });

  // Add button
  document.getElementById('add-customer-btn').addEventListener('click', () => {
    document.getElementById('customer-modal-title').textContent = 'Add Customer';
    document.getElementById('customerId').value = '';
    document.getElementById('customerName').value = '';
    document.getElementById('customerAddress').value = '';
    document.getElementById('customerMobile').value = '';
    modal.classList.remove('hidden');
  });

  // Close modal
  document.getElementById('customer-modal-close').addEventListener('click', () => {
    modal.classList.add('hidden');
  });

  document.getElementById('customer-modal-cancel').addEventListener('click', () => {
    modal.classList.add('hidden');
  });

  // Save
  document.getElementById('customer-modal-save').addEventListener('click', () => {
    const name = document.getElementById('customerName').value.trim();
    if (!name) {
      showToast('Please enter a customer name.', 'warning');
      return;
    }

    const customer = {
      id: document.getElementById('customerId').value || undefined,
      name,
      address: document.getElementById('customerAddress').value.trim(),
      mobile: document.getElementById('customerMobile').value.trim()
    };

    Customers.save(customer);
    modal.classList.add('hidden');
    showToast(`Customer "${name}" saved!`, 'success');
    renderCustomers();
  });

  // Click outside modal to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.add('hidden');
  });

  bindTableActions();
}

function bindTableActions() {
  // Edit
  document.querySelectorAll('.cust-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const customer = Customers.get(btn.dataset.id);
      if (customer) {
        document.getElementById('customer-modal-title').textContent = 'Edit Customer';
        document.getElementById('customerId').value = customer.id;
        document.getElementById('customerName').value = customer.name;
        document.getElementById('customerAddress').value = customer.address || '';
        document.getElementById('customerMobile').value = customer.mobile || '';
        document.getElementById('customer-modal').classList.remove('hidden');
      }
    });
  });

  // Delete
  document.querySelectorAll('.cust-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const customer = Customers.get(btn.dataset.id);
      if (customer && confirm(`Delete customer "${customer.name}"?`)) {
        Customers.delete(btn.dataset.id);
        showToast(`Customer "${customer.name}" deleted.`, 'error');
        renderCustomers();
      }
    });
  });
}

function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}
