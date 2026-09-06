// ====================================================
// PRICE CONFIGURATION
// ====================================================
const PRICES = {
  tobacco:      { buy: 70, sell: 90 },
  filters:      { buy: 1 , sell: 3  },
  rollingPaper: { buy: 0.66667 ,  sell: 2  },
  lighters:     { buy: 3.33334,   sell: 5 }
};

// --- App State ---
const DEFAULT_STATE = {
  drawerBalance: 0,
  inventory: { tobacco: 0, rollingPaper: 0, filters: 0, lighters: 0 },
  history: []
};

let state = JSON.parse(localStorage.getItem('inventory_app_data')) || DEFAULT_STATE;
let selectedAction = null;
let selectedItem = null;

function saveState() {
  localStorage.setItem('inventory_app_data', JSON.stringify(state));
  render();
}

function render() {
  document.getElementById('drawer-balance').innerText = `₪${state.drawerBalance.toFixed(2)}`;
  
  for (const item in state.inventory) {
    const el = document.getElementById(`stock-${item}`);
    if (el) el.innerText = state.inventory[item];
  }

  const historyList = document.getElementById('history-list');
  historyList.innerHTML = state.history.map(entry => `
    <li class="history-item">
      <span>
        <strong>${entry.date} - ${entry.type.toUpperCase()}</strong>: 
        ${entry.details} (${entry.amount >= 0 ? '+' : ''}₪${entry.amount.toFixed(2)})
      </span>
      <button onclick="deleteAction(${entry.id})" class="delete-btn" title="Delete entry">🗑️</button>
    </li>
  `).reverse().join('');
}

// Delete & Revert Action
function deleteAction(id) {
  if (!confirm('Delete this action and revert changes?')) return;

  const index = state.history.findIndex(entry => entry.id === id);
  if (index === -1) return;

  const entry = state.history[index];

  // Revert cash drawer balance
  state.drawerBalance -= entry.amount;

  // Revert inventory stock changes if applicable
  if (entry.item && state.inventory[entry.item] !== undefined) {
    if (entry.type === 'buy') {
      state.inventory[entry.item] -= entry.qty;
    } else if (entry.type === 'sell') {
      state.inventory[entry.item] += entry.qty;
    }
  }

  // Remove log entry
  state.history.splice(index, 1);
  saveState();
}

// Step Navigation Controls
function goToStep(stepId) {
  ['step-action-select', 'step-item-select', 'step-details'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
  document.getElementById(stepId).classList.remove('hidden');
}

function openModal() {
  selectedAction = null;
  selectedItem = null;
  goToStep('step-action-select');
  document.getElementById('modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
}

// Selection Handlers
document.querySelectorAll('#step-action-select .bubble-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    selectedAction = btn.dataset.action;
    if (selectedAction === 'invest' || selectedAction === 'borrow') {
      setupMoneyStep();
    } else {
      document.getElementById('item-step-title').innerText = 
        selectedAction === 'buy' ? 'Buy Goods: Select Item' : 'Sell Goods: Select Item';
      goToStep('step-item-select');
    }
  });
});

document.querySelectorAll('#step-item-select .bubble-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    selectedItem = btn.dataset.item;
    setupItemDetailsStep();
  });
});

function setupMoneyStep() {
  document.getElementById('qty-container').classList.add('hidden');
  document.getElementById('price-hint').innerText = '';
  document.getElementById('action-amount').value = '';
  document.getElementById('details-title').innerText = 
    selectedAction === 'invest' ? 'Invest Money' : 'Borrow Money';
  goToStep('step-details');
}

function setupItemDetailsStep() {
  document.getElementById('qty-container').classList.remove('hidden');
  document.getElementById('action-qty').value = 1;
  document.getElementById('details-title').innerText = `${selectedAction.toUpperCase()}: ${selectedItem}`;
  calculateTotal();
  goToStep('step-details');
}

document.getElementById('action-qty').addEventListener('input', calculateTotal);

function calculateTotal() {
  if (!selectedItem || !PRICES[selectedItem]) return;

  const qty = parseFloat(document.getElementById('action-qty').value) || 0;
  const unitPrice = selectedAction === 'buy' ? PRICES[selectedItem].buy : PRICES[selectedItem].sell;
  const total = qty * unitPrice;

  document.getElementById('action-amount').value = total.toFixed(2);
  document.getElementById('price-hint').innerText = `Unit price: ₪${unitPrice.toFixed(2)}`;
}

// Record Action Submit
document.getElementById('submit-action-btn').addEventListener('click', () => {
  const qty = parseInt(document.getElementById('action-qty').value) || 0;
  const amount = parseFloat(document.getElementById('action-amount').value) || 0;
  const date = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  let netCashChange = 0;
  let details = '';

  if (selectedAction === 'invest') {
    netCashChange = amount;
    details = `Invested cash`;
  } else if (selectedAction === 'borrow') {
    netCashChange = -amount;
    details = `Borrowed cash`;
  } else if (selectedAction === 'buy') {
    netCashChange = -amount;
    state.inventory[selectedItem] += qty;
    details = `Bought ${qty}x ${selectedItem}`;
  } else if (selectedAction === 'sell') {
    netCashChange = amount;
    state.inventory[selectedItem] -= qty;
    details = `Sold ${qty}x ${selectedItem}`;
  }

  state.drawerBalance += netCashChange;
  
  // Save entry with unique timestamp ID and stock details
  state.history.push({
    id: Date.now(),
    date,
    type: selectedAction,
    item: selectedItem,
    qty: qty,
    details,
    amount: netCashChange
  });

  saveState();
  closeModal();
});

document.getElementById('open-modal-btn').onclick = openModal;
render();
