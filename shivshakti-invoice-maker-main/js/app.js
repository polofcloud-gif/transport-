// ============================================================
// app.js — SPA Router & Application Entry Point
// ============================================================

import { renderDashboard } from './dashboard.js';
import { renderInvoiceForm } from './invoice-form.js';
import { renderHistory, renderInvoiceView } from './history.js';
import { renderCustomers } from './customers.js';
import { renderTrucks } from './trucks.js';
import { isAuthenticated, renderLogin, applyAuthUI, logout, openPasswordModal } from './auth.js';
import { renderSettings } from './settings.js';
import { renderUsers } from './user-admin.js';

// ── Toast Notification System ────────────────────────────────

/**
 * Show a toast notification.
 * @param {string} message
 * @param {'success'|'error'|'warning'|''} type
 */
export function showToast(message, type = '') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
    toast.style.transition = '0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ── Navigation ───────────────────────────────────────────────

/**
 * Navigate to a page by updating the hash.
 * @param {string} page — e.g. 'dashboard', 'new-invoice', 'edit-invoice/abc123'
 */
export function navigate(page) {
  // If already on this page, re-render it (hashchange won't fire for the same hash)
  if (window.location.hash.slice(1) === page) {
    route();
  } else {
    window.location.hash = page;
  }
}

// ── Router ───────────────────────────────────────────────────

function route() {
  applyAuthUI();

  if (!isAuthenticated()) {
    renderLogin();
    return;
  }

  const hash = window.location.hash.slice(1) || 'dashboard';
  const parts = hash.split('/');
  const page = parts[0];
  const param = parts[1];

  // Update active nav link
  document.querySelectorAll('.sidebar-nav a').forEach(a => {
    const linkPage = a.getAttribute('href')?.slice(1);
    a.classList.toggle('active', linkPage === page);
  });

  // Close mobile sidebar
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.sidebar-overlay');
  sidebar?.classList.remove('open');
  overlay?.classList.remove('active');

  // Scroll to top
  window.scrollTo(0, 0);

  // Route to page
  switch (page) {
    case 'dashboard':
      renderDashboard();
      break;
    case 'new-invoice':
      renderInvoiceForm(null);
      break;
    case 'edit-invoice':
      renderInvoiceForm(param);
      break;
    case 'view-invoice':
      renderInvoiceView(param);
      break;
    case 'history':
      renderHistory();
      break;
    case 'customers':
      renderCustomers();
      break;
    case 'trucks':
      renderTrucks();
      break;
    case 'settings':
      renderSettings();
      break;
    case 'users':
      renderUsers();
      break;
    default:
      renderDashboard();
  }
}

// ── Sidebar Toggle (Mobile) ─────────────────────────────────

function initSidebar() {
  const toggle = document.getElementById('sidebar-toggle');
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.sidebar-overlay');

  toggle?.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('active');
  });

  overlay?.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
  });
}

// ── Initialize ───────────────────────────────────────────────

function initAccountButtons() {
  document.getElementById('logout-btn')?.addEventListener('click', () => {
    logout();
    showToast('You have been logged out', 'success');
  });
  document.getElementById('change-password-btn')?.addEventListener('click', openPasswordModal);
}

function init() {
  initSidebar();
  initAccountButtons();
  window.addEventListener('hashchange', route);
  route();
}

// Wait for DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
