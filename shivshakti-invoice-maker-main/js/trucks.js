// ============================================================
// trucks.js — Truck Database Management Page
// ============================================================

import { Trucks } from './store.js';
import { showToast } from './app.js';

/**
 * Render the trucks management page.
 */
export function renderTrucks() {
  const app = document.getElementById('app');
  const trucks = Trucks.getAll();

  app.innerHTML = `
    <div class="page-header">
      <h1>Truck Database</h1>
      <p>Manage truck details for quick invoice creation</p>
    </div>

    <div class="card">
      <div class="search-bar">
        <input type="text" id="truck-search" placeholder="🔍 Search by truck no, owner, or driver...">
        <button class="btn btn-primary" id="add-truck-btn">+ Add Truck</button>
      </div>

      <div id="trucks-table-container">
        ${renderTruckTable(trucks)}
      </div>
    </div>

    <!-- Add/Edit Truck Modal -->
    <div class="modal-overlay hidden" id="truck-modal">
      <div class="modal">
        <div class="modal-header">
          <h3 id="truck-modal-title">Add Truck</h3>
          <button class="modal-close" id="truck-modal-close">✕</button>
        </div>
        <div class="modal-body">
          <form id="truck-form">
            <input type="hidden" id="truckId">
            <div class="form-group" style="margin-bottom:16px;">
              <label for="truckNumber">Truck No *</label>
              <input type="text" id="truckNumber" required placeholder="e.g. MH-19-AB-1234" style="text-transform:uppercase;">
            </div>
            <div class="form-group" style="margin-bottom:16px;">
              <label for="truckOwner">Owner Name</label>
              <input type="text" id="truckOwner" placeholder="Truck owner name">
            </div>
            <div class="form-group" style="margin-bottom:16px;">
              <label for="truckDriver">Driver Name</label>
              <input type="text" id="truckDriver" placeholder="Driver name">
            </div>
            <div class="form-group" style="margin-bottom:16px;">
              <label for="truckDriverMobile">Driver Mobile No</label>
              <input type="tel" id="truckDriverMobile" placeholder="Driver mobile number">
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="truck-modal-cancel">Cancel</button>
          <button class="btn btn-primary" id="truck-modal-save">Save Truck</button>
        </div>
      </div>
    </div>
  `;

  bindTruckEvents();
}

function renderTruckTable(trucks) {
  if (trucks.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-icon">🚛</div>
        <p>No trucks saved yet. Add your first truck!</p>
      </div>
    `;
  }

  return `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Sr.</th>
            <th>Truck No</th>
            <th>Owner Name</th>
            <th>Driver Name</th>
            <th>Driver Mobile</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${trucks.map((t, i) => `
            <tr>
              <td>${i + 1}</td>
              <td><strong>${escHtml((t.truckNo || '').toUpperCase())}</strong></td>
              <td>${escHtml(t.ownerName || '-')}</td>
              <td>${escHtml(t.driverName || '-')}</td>
              <td>${escHtml(t.driverMobile || '-')}</td>
              <td>
                <div class="btn-group" style="gap:6px;">
                  <button class="btn btn-sm btn-outline truck-edit" data-id="${t.id}" title="Edit">✏ Edit</button>
                  <button class="btn btn-sm btn-danger truck-delete" data-id="${t.id}" title="Delete">🗑</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function bindTruckEvents() {
  const modal = document.getElementById('truck-modal');

  // Search
  document.getElementById('truck-search').addEventListener('input', (e) => {
    const q = e.target.value.trim();
    const filtered = q ? Trucks.search(q) : Trucks.getAll();
    document.getElementById('trucks-table-container').innerHTML = renderTruckTable(filtered);
    bindTableActions();
  });

  // Add button
  document.getElementById('add-truck-btn').addEventListener('click', () => {
    document.getElementById('truck-modal-title').textContent = 'Add Truck';
    document.getElementById('truckId').value = '';
    document.getElementById('truckNumber').value = '';
    document.getElementById('truckOwner').value = '';
    document.getElementById('truckDriver').value = '';
    document.getElementById('truckDriverMobile').value = '';
    modal.classList.remove('hidden');
  });

  // Close modal
  document.getElementById('truck-modal-close').addEventListener('click', () => {
    modal.classList.add('hidden');
  });

  document.getElementById('truck-modal-cancel').addEventListener('click', () => {
    modal.classList.add('hidden');
  });

  // Save
  document.getElementById('truck-modal-save').addEventListener('click', () => {
    const truckNo = document.getElementById('truckNumber').value.trim().toUpperCase();
    if (!truckNo) {
      showToast('Please enter a truck number.', 'warning');
      return;
    }

    const truck = {
      id: document.getElementById('truckId').value || undefined,
      truckNo,
      ownerName: document.getElementById('truckOwner').value.trim(),
      driverName: document.getElementById('truckDriver').value.trim(),
      driverMobile: document.getElementById('truckDriverMobile').value.trim()
    };

    Trucks.save(truck);
    modal.classList.add('hidden');
    showToast(`Truck "${truckNo}" saved!`, 'success');
    renderTrucks();
  });

  // Click outside modal to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.add('hidden');
  });

  bindTableActions();
}

function bindTableActions() {
  // Edit
  document.querySelectorAll('.truck-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const truck = Trucks.get(btn.dataset.id);
      if (truck) {
        document.getElementById('truck-modal-title').textContent = 'Edit Truck';
        document.getElementById('truckId').value = truck.id;
        document.getElementById('truckNumber').value = truck.truckNo;
        document.getElementById('truckOwner').value = truck.ownerName || '';
        document.getElementById('truckDriver').value = truck.driverName || '';
        document.getElementById('truckDriverMobile').value = truck.driverMobile || '';
        document.getElementById('truck-modal').classList.remove('hidden');
      }
    });
  });

  // Delete
  document.querySelectorAll('.truck-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const truck = Trucks.get(btn.dataset.id);
      if (truck && confirm(`Delete truck "${truck.truckNo}"?`)) {
        Trucks.delete(btn.dataset.id);
        showToast(`Truck "${truck.truckNo}" deleted.`, 'error');
        renderTrucks();
      }
    });
  });
}

function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}
