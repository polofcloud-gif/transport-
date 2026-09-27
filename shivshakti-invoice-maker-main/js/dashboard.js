// ============================================================
// dashboard.js — Dashboard Page
// ============================================================

import { Invoices } from './store.js';
import { formatCurrency } from './utils.js';
import { navigate } from './app.js';

/**
 * Render the dashboard page with stats and quick actions.
 */
export function renderDashboard() {
  const app = document.getElementById('app');

  const totalInvoices = Invoices.count();
  const todayInvoices = Invoices.todayCount();
  const monthInvoices = Invoices.thisMonthCount();
  const totalAmount = Invoices.totalAmount();
  const pendingAmount = Invoices.pendingAmount();

  app.innerHTML = `
    <div class="page-header">
      <h1>Dashboard</h1>
      <p>Overview of your transport business invoicing</p>
    </div>

    <!-- Stats Grid -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon blue">📄</div>
        <div class="stat-info">
          <div class="stat-value">${totalInvoices}</div>
          <div class="stat-label">Total Invoices</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green">📋</div>
        <div class="stat-info">
          <div class="stat-value">${todayInvoices}</div>
          <div class="stat-label">Today's Invoices</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon yellow">📅</div>
        <div class="stat-info">
          <div class="stat-value">${monthInvoices}</div>
          <div class="stat-label">This Month</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon blue">💰</div>
        <div class="stat-info">
          <div class="stat-value">${formatCurrency(totalAmount)}</div>
          <div class="stat-label">Total Billing</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon red">⏳</div>
        <div class="stat-info">
          <div class="stat-value">${formatCurrency(pendingAmount)}</div>
          <div class="stat-label">Pending Amount</div>
        </div>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="card">
      <div class="card-title">Quick Actions</div>
      <div class="actions-grid">
        <div class="action-card" data-nav="new-invoice">
          <span class="action-icon">➕</span>
          <span>Create New Invoice</span>
        </div>
        <div class="action-card" data-nav="history">
          <span class="action-icon">📜</span>
          <span>Invoice History</span>
        </div>
        <div class="action-card" data-nav="customers">
          <span class="action-icon">👥</span>
          <span>Customers</span>
        </div>
        <div class="action-card" data-nav="trucks">
          <span class="action-icon">🚛</span>
          <span>Trucks</span>
        </div>
      </div>
    </div>

    <!-- Recent Invoices -->
    <div class="card" style="margin-top:20px;">
      <div class="card-title">Recent Invoices</div>
      ${renderRecentInvoices()}
    </div>
  `;

  // Bind quick action clicks
  app.querySelectorAll('.action-card[data-nav]').forEach(card => {
    card.addEventListener('click', () => {
      navigate(card.dataset.nav);
    });
  });

  // Bind recent invoice actions
  app.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      if (action === 'view') navigate(`view-invoice/${id}`);
      if (action === 'edit') navigate(`edit-invoice/${id}`);
    });
  });
}

function renderRecentInvoices() {
  const invoices = Invoices.getAll().slice(0, 5);
  if (invoices.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-icon">📄</div>
        <p>No invoices yet. Create your first invoice!</p>
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
            <th>Amount</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${invoices.map(inv => `
            <tr>
              <td><strong>${escHtml(inv.invoiceNumber)}</strong></td>
              <td>${formatDateShort(inv.date)}</td>
              <td>${escHtml(inv.senderName || '')}</td>
              <td>${escHtml(inv.receiverName || '')}</td>
              <td><strong>${formatCurrency(inv.totalAmount)}</strong></td>
              <td><span class="badge badge-${inv.status || 'pending'}">${capitalize(inv.status || 'pending')}</span></td>
              <td>
                <button class="btn btn-sm btn-secondary" data-action="view" data-id="${inv.id}">View</button>
                <button class="btn btn-sm btn-outline" data-action="edit" data-id="${inv.id}">Edit</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function formatDateShort(date) {
  if (!date) return '';
  const d = new Date(date);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
