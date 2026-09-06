// --- Default App State ---
const DEFAULT_STATE = {
  drawerBalance: 0,
  inventory: { tobacco: 0, rollingPaper: 0, filters: 0, lighters: 0 },
  prices: {
    tobacco:      { buy: 70,      sell: 90 },
    filters:      { buy: 1 , sell: 3  },
    rollingPaper: { buy: 0.667,  sell: 2  },
    lighters:     { buy: 3.33 ,       sell: 5 }
  },
  history: []
};

let state = JSON.parse(localStorage.getItem('inventory_app_data')) || DEFAULT_STATE;

// Migration check if upgrading existing saved state
if (!state.prices) {
  state.prices = DEFAULT_STATE.prices;
}

let selectedAction = null;
let selectedItem = null;
let editingPriceItem = null;

function saveState() {
  localStorage.setItem('inventory_app_data', JSON.stringify(state));
  render();
}

function render() {
  document.getElementById('drawer-balance').innerText = `₪${state.drawerBalance.toFixed(2)}`;
  
  for (const item in state.inventory) {
    const el = document.getElementById(`stock-${item}`);
    if (el) el.innerText = state.inventory[item];

    const priceEl = document.getElementById(`price-tag-${item}`);
    if (priceEl && state.prices[item]) {
      priceEl.innerText = `Buy: ₪${state.prices[item].buy.toFixed(2)} | Sell: ₪${state.prices[item].sell.toFixed(2)}`;
    }
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

// --- EDIT PRICE MODAL LOGIC ---
function openPriceModal(item) {
  editingPriceItem = item;
  document.getElementById('price-modal-title').innerText = `Edit Prices: ${item}`;
  document.getElementById('edit-buy-price').value = state.prices[item].buy.toFixed(2);
  document.getElementById('edit-sell-price').value = state.prices[item].sell.toFixed(2);
  document.getElementById('price-modal').classList.remove('hidden');
}

function closePriceModal() {
  document.getElementById('price-modal').classList.add('hidden');
  editingPriceItem = null;
}

document.getElementById('save-price-btn').addEventListener('click', () => {
  if (!editingPriceItem) return;

  const buyVal = parseFloat(document.getElementById('edit-buy-price').value) || 0;
  const sellVal = parseFloat(document.getElementById('edit-sell-price').value) || 0;

  state.prices[editingPriceItem] = { buy: buyVal, sell: sellVal };
  saveState();
  closePriceModal();
});

// --- ACTION POP-UP STEPS ---
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

// Bubble Clicks
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
  if (!selectedItem || !state.prices[selectedItem]) return;

  const qty = parseFloat(document.getElementById('action-qty').value) || 0;
  const unitPrice = selectedAction === 'buy' ? state.prices[selectedItem].buy : state.prices[selectedItem].sell;
  const total = qty * unitPrice;

  document.getElementById('action-amount').value = total.toFixed(2);
  document.getElementById('price-hint').innerText = `Unit price: ₪${unitPrice.toFixed(2)}`;
}

// Submit Action
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

// Delete Entry Logic
function deleteAction(id) {
  if (!confirm('Delete this action and revert changes?')) return;

  const index = state.history.findIndex(entry => entry.id === id);
  if (index === -1) return;

  const entry = state.history[index];
  state.drawerBalance -= entry.amount;

  if (entry.item && state.inventory[entry.item] !== undefined) {
    if (entry.type === 'buy') {
      state.inventory[entry.item] -= entry.qty;
    } else if (entry.type === 'sell') {
      state.inventory[entry.item] += entry.qty;
    }
  }

  state.history.splice(index, 1);
  saveState();
}

document.getElementById('open-modal-btn').onclick = openModal;
render();
