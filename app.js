// app.js
// Lógica principal del Tablero de Aportes, Presupuestos y Categorías Dinámicas de Socios
// Vinculado a la base de datos de Railway

const PARTNERS = ["Franco", "David", "Gabriel", "Sandra"];
const TARGET_PER_PARTNER = 50000; // En USD
const TOTAL_PROJECT_TARGET = TARGET_PER_PARTNER * PARTNERS.length; // 200,000 USD

let state = {
  transactions: [],
  budgets: [],
  categories: [],
  dolarBlue: { compra: 0, venta: 0, promedio: 0 },
  activeTab: 'tab-aportes',
  searchQuery: ''
};

// Al iniciar la aplicación
document.addEventListener("DOMContentLoaded", async () => {
  initEventListeners();
  await loadDolarBlue();
  await loadState();
});

// 1. OBTENER VALOR DEL DÓLAR BLUE (API)
async function loadDolarBlue() {
  const widgetValue = document.getElementById("widget-dolar-value");
  try {
    widgetValue.textContent = "Cargando...";
    const response = await fetch("https://dolarapi.com/v1/dolares/blue");
    if (!response.ok) throw new Error("Error en API");
    
    const data = await response.json();
    const promedio = Math.round((data.compra + data.venta) / 2);
    state.dolarBlue = {
      compra: data.compra,
      venta: data.venta,
      promedio: promedio,
      fecha: new Date(data.fechaActualizacion).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    
    widgetValue.innerHTML = `Promedio: <strong>$${promedio}</strong> <span style="font-size:0.75rem;color:var(--text-muted)">(${state.dolarBlue.fecha} hs)</span>`;
  } catch (e) {
    console.error("Fallo al cargar cotización de Dólar Blue:", e);
    widgetValue.innerHTML = `<span class="text-danger">Error de red</span>`;
    state.dolarBlue = { compra: 1350, venta: 1350, promedio: 1350 }; // Respaldo
  }
}

// 2. CARGAR EL ESTADO DESDE EL STORAGE
async function loadState() {
  const loader = document.createElement("div");
  loader.id = "global-loading";
  loader.style.cssText = "position:fixed;top:20px;right:20px;background:var(--primary);padding:8px 16px;border-radius:20px;font-size:0.8rem;z-index:9999;";
  loader.textContent = "Sincronizando con base de datos...";
  document.body.appendChild(loader);

  const labelStatus = document.getElementById("widget-cloud-status");

  try {
    // Obtener transacciones, presupuestos y categorías en paralelo
    const [transactions, budgets, categories] = await Promise.all([
      window.AppStorage.getData(),
      window.AppStorage.getBudgets(),
      window.AppStorage.getCategories()
    ]);
    
    state.transactions = transactions;
    state.budgets = budgets;
    state.categories = categories;
    
    labelStatus.innerHTML = `Base de datos: <span class="text-success">Online (PG)</span>`;
  } catch (e) {
    console.error("Error al cargar estado del backend:", e);
    labelStatus.innerHTML = `Base de datos: <span class="text-danger">Offline</span>`;
    alert("No se pudo conectar con el servidor de bases de datos.");
  } finally {
    const el = document.getElementById("global-loading");
    if (el) el.remove();
  }

  // Cargar selectores dinámicos de categorías
  populateCategoryDropdowns();
  
  // Cargar opciones en el select de transacciones (asociar a presupuesto)
  loadBudgetSelectOptions();

  // Cargar sugerencias de proveedores autogeneradas
  populateProviderSuggestions();

  // Renderizar componentes
  renderAll();
}

// Llena los selectores con las categorías dinámicas de la DB
function populateCategoryDropdowns() {
  const selectTx = document.getElementById("tx-phase");
  const selectBg = document.getElementById("bg-phase");
  const filterTx = document.getElementById("filter-fase");
  const filterBg = document.getElementById("filter-budget-fase");

  const cats = state.categories.map(c => c.name);

  // Mantener los valores actuales seleccionados
  const currentTxVal = selectTx.value;
  const currentBgVal = selectBg.value;
  const currentFilterTxVal = filterTx.value;
  const currentFilterBgVal = filterBg.value;

  // Llenar selectores de creación
  selectTx.innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join('');
  selectBg.innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join('');

  // Llenar selectores de filtro (con opción vacía "Todos")
  filterTx.innerHTML = '<option value="">Todos los Rubros</option>' + cats.map(c => `<option value="${c}">${c.split(':')[0]}</option>`).join('');
  filterBg.innerHTML = '<option value="">Todos los Rubros</option>' + cats.map(c => `<option value="${c}">${c.split(':')[0]}</option>`).join('');

  // Restaurar selecciones anteriores si siguen existiendo
  if (cats.includes(currentTxVal)) selectTx.value = currentTxVal;
  if (cats.includes(currentBgVal)) selectBg.value = currentBgVal;
  if (cats.includes(currentFilterTxVal)) filterTx.value = currentFilterTxVal;
  if (cats.includes(currentFilterBgVal)) filterBg.value = currentFilterBgVal;
}

// Carga las opciones de presupuestos activos en el formulario de aportes
function loadBudgetSelectOptions() {
  const select = document.getElementById("tx-budget-id");
  select.innerHTML = '<option value="">Ninguno / Aporte de Capital General</option>';
  
  // Agrupar por fase/categoría para orden
  const phases = {};
  state.budgets.forEach(b => {
    if (!phases[b.phase]) phases[b.phase] = [];
    phases[b.phase].push(b);
  });

  for (const phaseName in phases) {
    const group = document.createElement("optgroup");
    group.label = phaseName;
    phases[phaseName].forEach(b => {
      const option = document.createElement("option");
      option.value = b.id;
      const amtFormatted = b.currency === "USD" ? `u$s ${b.amount}` : `$ ${b.amount} ARS`;
      option.textContent = `${b.concept} (${amtFormatted})`;
      group.appendChild(option);
    });
    select.appendChild(group);
  }
}

// Sugerencias inteligentes de proveedores basadas en los existentes
function populateProviderSuggestions() {
  const datalist = document.getElementById("provider-suggestions");
  datalist.innerHTML = "";

  const providers = new Set();
  state.transactions.forEach(t => { if (t.provider) providers.add(t.provider.trim()); });
  state.budgets.forEach(b => { if (b.provider) providers.add(b.provider.trim()); });

  providers.forEach(p => {
    const option = document.createElement("option");
    option.value = p;
    datalist.appendChild(option);
  });
}

// 3. RENDERIZADO GLOBAL
function renderAll() {
  renderAdminUI();
  calculateAndRenderDashboard();
  renderPartners();
  renderTransactions();
  calculateAndRenderBudgetDashboard();
  renderBudgets();
  toggleTabButtons();
}

// 4. CALCULAR Y RENDERIZAR DASHBOARD GENERAL (SOCIOS)
function calculateAndRenderDashboard() {
  let totalUSDCollected = 0;
  let totalARSCollected = 0;
  let totalUSDDirect = 0;
  
  const partnerStats = {};
  PARTNERS.forEach(p => {
    partnerStats[p] = { usdDirect: 0, arsTotal: 0, usdEquiv: 0, totalUsdValue: 0 };
  });

  state.transactions.forEach(tx => {
    const amount = parseFloat(tx.amount);
    const rate = parseFloat(tx.rate || 1);
    
    if (tx.currency === "USD") {
      totalUSDDirect += amount;
      totalUSDCollected += amount;
      if (partnerStats[tx.partner]) {
        partnerStats[tx.partner].usdDirect += amount;
        partnerStats[tx.partner].totalUsdValue += amount;
      }
    } else {
      const usdEquiv = amount / rate;
      totalARSCollected += amount;
      totalUSDCollected += usdEquiv;
      if (partnerStats[tx.partner]) {
        partnerStats[tx.partner].arsTotal += amount;
        partnerStats[tx.partner].usdEquiv += usdEquiv;
        partnerStats[tx.partner].totalUsdValue += usdEquiv;
      }
    }
  });

  state.partnerStats = partnerStats;

  const progressPercent = Math.min((totalUSDCollected / TOTAL_PROJECT_TARGET) * 100, 100).toFixed(1);
  
  document.getElementById("dash-progress-fill").style.width = `${progressPercent}%`;
  document.getElementById("dash-progress-text").textContent = `${progressPercent}%`;
  
  document.getElementById("dash-total-usd").textContent = formatCurrency(totalUSDCollected, "USD");
  document.getElementById("dash-target-usd").textContent = formatCurrency(TOTAL_PROJECT_TARGET, "USD");
  
  document.getElementById("dash-usd-direct").textContent = formatCurrency(totalUSDDirect, "USD");
  document.getElementById("dash-ars-equiv").textContent = `${formatCurrency(totalARSCollected, "ARS")} (equiv. ${formatCurrency(totalUSDCollected - totalUSDDirect, "USD")})`;
}

// 5. RENDERIZAR TARJETAS DE SOCIOS
function renderPartners() {
  const container = document.getElementById("partners-grid");
  container.innerHTML = "";

  PARTNERS.forEach(partnerName => {
    const stats = state.partnerStats[partnerName] || { usdDirect: 0, arsTotal: 0, totalUsdValue: 0 };
    const remaining = Math.max(TARGET_PER_PARTNER - stats.totalUsdValue, 0);
    const percentage = Math.min((stats.totalUsdValue / TARGET_PER_PARTNER) * 100, 100).toFixed(1);
    const isCompleted = stats.totalUsdValue >= TARGET_PER_PARTNER;

    const card = document.createElement("div");
    card.className = `partner-card ${isCompleted ? "completed" : ""}`;
    card.innerHTML = `
      <div class="partner-card-header">
        <span class="partner-name">${partnerName}</span>
        <span class="partner-percentage">${percentage}%</span>
      </div>
      <div class="progress-container" style="height: 6px; margin: 5px 0;">
        <div class="progress-bar-fill" style="width: ${percentage}%; background: ${isCompleted ? 'var(--success)' : 'var(--primary)'}"></div>
      </div>
      <div class="partner-metrics">
        <div class="metric-row">
          <span class="metric-label">Aportado (USD equiv.)</span>
          <span class="metric-val ${isCompleted ? 'completed' : ''}">${formatCurrency(stats.totalUsdValue, "USD")}</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Saldo Pendiente</span>
          <span class="metric-val ${isCompleted ? 'completed' : ''} ${isCompleted ? '' : 'remaining'}">${isCompleted ? "Completado" : formatCurrency(remaining, "USD")}</span>
        </div>
      </div>
      <div class="partner-mini-history">
        <div class="partner-mini-history-title">Desglose de aportes:</div>
        <div class="partner-currencies">
          <span>Dólares: <strong class="text-success">${formatCurrency(stats.usdDirect, "USD")}</strong></span>
          <span>Pesos: <strong class="text-primary">${formatCurrency(stats.arsTotal, "ARS")}</strong></span>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

// Helper para buscador global
function matchesSearch(text, query) {
  if (!query) return true;
  if (!text) return false;
  return text.toLowerCase().includes(query.toLowerCase());
}

// 6. RENDERIZAR TABLA E HISTORIAL DE MOVIMIENTOS
function renderTransactions() {
  const filterSocio = document.getElementById("filter-socio").value;
  const filterMoneda = document.getElementById("filter-moneda").value;
  const filterFase = document.getElementById("filter-fase").value;
  
  const tableBody = document.getElementById("history-table-body");
  const mobileList = document.getElementById("mobile-history-list");
  
  tableBody.innerHTML = "";
  mobileList.innerHTML = "";

  const filtered = state.transactions.filter(tx => {
    if (filterSocio && tx.partner !== filterSocio) return false;
    if (filterMoneda && tx.currency !== filterMoneda) return false;
    if (filterFase && tx.phase !== filterFase) return false;
    
    // Filtro del buscador global
    if (state.searchQuery) {
      const searchTarget = `${tx.partner} ${tx.concept} ${tx.provider || ''} ${tx.phase} ${tx.currency} ${tx.amount}`;
      return matchesSearch(searchTarget, state.searchQuery);
    }

    return true;
  }).sort((a, b) => new Date(b.date) - new Date(a.date));

  if (filtered.length === 0) {
    const noRecordsHtml = `<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:30px;">No se encontraron registros de aportes.</td></tr>`;
    tableBody.innerHTML = noRecordsHtml;
    mobileList.innerHTML = `<div style="text-align:center;color:var(--text-muted);padding:30px 10px;font-size:0.9rem;">No hay registros.</div>`;
    return;
  }

  filtered.forEach(tx => {
    const amount = parseFloat(tx.amount);
    const rate = parseFloat(tx.rate || 1);
    const usdEquiv = tx.currency === "USD" ? amount : amount / rate;
    const dateFormatted = formatDate(tx.date);
    
    // Buscar si está asociado a un presupuesto
    const associatedBudget = state.budgets.find(b => b.id === tx.budget_id);
    const budgetConceptHtml = associatedBudget 
      ? `<br><span style="font-size:0.75rem;color:var(--success-light)">📌 Presupuesto: ${associatedBudget.concept}</span>` 
      : "";

    // Fila de Tabla (Desktop)
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${dateFormatted}</td>
      <td><strong>${tx.partner}</strong></td>
      <td><span class="widget-pill btn-secondary" style="padding:4px 8px;font-size:0.75rem;">${tx.phase.split(':')[0]}</span></td>
      <td>${tx.concept}${budgetConceptHtml}</td>
      <td>${tx.provider ? `<strong>${tx.provider}</strong>` : `<span class="text-muted">-</span>`}</td>
      <td class="${tx.currency === "USD" ? "text-success" : "text-primary"}" style="font-weight:600">
        ${formatCurrency(amount, tx.currency)}
      </td>
      <td>${tx.currency === "ARS" ? `$${formatNumber(rate)}` : "-"}</td>
      <td style="font-weight:600">${formatCurrency(usdEquiv, "USD")}</td>
      ${window.AppStorage.isAdmin() ? `
        <td style="text-align:right">
          <button class="btn btn-secondary btn-small" onclick="editTransaction('${tx.id}')">Editar</button>
          <button class="btn btn-danger btn-small" onclick="deleteTransaction('${tx.id}')" style="margin-left:4px">X</button>
        </td>
      ` : ""}
    `;
    tableBody.appendChild(tr);

    // Tarjeta (Móvil)
    const mobileCard = document.createElement("div");
    mobileCard.className = "mobile-tx-card";
    mobileCard.innerHTML = `
      <div class="mobile-tx-header">
        <span class="mobile-tx-partner">${tx.partner}</span>
        <span class="mobile-tx-amount currency-${tx.currency.toLowerCase()}">
          ${formatCurrency(amount, tx.currency)}
        </span>
      </div>
      <div class="mobile-tx-concept">
        <strong>${tx.phase.split(':')[0]}:</strong> ${tx.concept}
        ${tx.provider ? `<div style="font-size:0.8rem;color:var(--text-muted);margin-top:2px;">Proveedor: <strong>${tx.provider}</strong></div>` : ''}
        ${associatedBudget ? `<div style="font-size:0.75rem;color:var(--success-light);margin-top:2px;">📌 Relativo a: ${associatedBudget.concept}</div>` : ""}
      </div>
      <div class="mobile-tx-footer">
        <span>${dateFormatted}</span>
        <span>Equiv: <strong>${formatCurrency(usdEquiv, "USD")}</strong></span>
        ${tx.currency === "ARS" ? `<span>Dólar: $${formatNumber(rate)}</span>` : ""}
      </div>
      ${window.AppStorage.isAdmin() ? `
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:5px;border-top:1px solid rgba(255,255,255,0.04);padding-top:8px;">
          <button class="btn btn-secondary btn-small" onclick="editTransaction('${tx.id}')">Editar</button>
          <button class="btn btn-danger btn-small" onclick="deleteTransaction('${tx.id}')">Borrar</button>
        </div>
      ` : ""}
    `;
    mobileList.appendChild(mobileCard);
  });
}

// 7. CALCULAR Y RENDERIZAR DASHBOARD DE PRESUPUESTOS
function calculateAndRenderBudgetDashboard() {
  let totalBudgetUSD = 0;
  let totalSpentUSD = 0;

  // 1. Sumar presupuestos convertidos a USD (usando la cotización promedio de hoy)
  const rateToday = state.dolarBlue.promedio || 1545;
  state.budgets.forEach(b => {
    const amt = parseFloat(b.amount);
    if (b.currency === "USD") {
      totalBudgetUSD += amt;
    } else {
      totalBudgetUSD += (amt / rateToday);
    }
  });

  // 2. Sumar aportes que están vinculados a presupuestos
  state.transactions.forEach(tx => {
    if (tx.budget_id) {
      const amt = parseFloat(tx.amount);
      const rate = parseFloat(tx.rate || 1);
      if (tx.currency === "USD") {
        totalSpentUSD += amt;
      } else {
        totalSpentUSD += (amt / rate);
      }
    }
  });

  const pending = Math.max(totalBudgetUSD - totalSpentUSD, 0);
  const deviation = totalSpentUSD - totalBudgetUSD;

  // Actualizar UI
  document.getElementById("budget-total-usd").textContent = formatCurrency(totalBudgetUSD, "USD");
  document.getElementById("budget-spent-usd").textContent = formatCurrency(totalSpentUSD, "USD");
  document.getElementById("budget-pending-usd").textContent = formatCurrency(pending, "USD");
  
  const devElement = document.getElementById("budget-deviation-usd");
  devElement.textContent = formatCurrency(Math.abs(deviation), "USD");
  if (deviation > 0) {
    devElement.className = "sub-stat-val text-danger";
    devElement.textContent = `+${formatCurrency(deviation, "USD")} (Excedido)`;
  } else if (deviation < 0) {
    devElement.className = "sub-stat-val text-success";
    devElement.textContent = `-${formatCurrency(Math.abs(deviation), "USD")} (Bajo Estimado)`;
  } else {
    devElement.className = "sub-stat-val text-muted";
    devElement.textContent = `u$s 0 (Equilibrado)`;
  }

  // Barra de progreso del presupuesto financiado
  const progressPercent = totalBudgetUSD > 0 
    ? Math.min((totalSpentUSD / totalBudgetUSD) * 100, 100).toFixed(1) 
    : 0;
  document.getElementById("budget-progress-fill").style.width = `${progressPercent}%`;
}

// 8. RENDERIZAR TABLA E HISTORIAL DE PRESUPUESTOS (TAB 2)
function renderBudgets() {
  const filterFase = document.getElementById("filter-budget-fase").value;
  const tableBody = document.getElementById("budget-table-body");
  const mobileList = document.getElementById("mobile-budget-list");

  tableBody.innerHTML = "";
  mobileList.innerHTML = "";

  const filtered = state.budgets.filter(b => {
    if (filterFase && b.phase !== filterFase) return false;
    
    // Filtro del buscador global
    if (state.searchQuery) {
      const searchTarget = `${b.concept} ${b.provider || ''} ${b.phase} ${b.currency} ${b.amount}`;
      return matchesSearch(searchTarget, state.searchQuery);
    }

    return true;
  }).sort((a, b) => new Date(b.date) - new Date(a.date));

  if (filtered.length === 0) {
    const noRecordsHtml = `<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:30px;">No se encontraron ítems de presupuesto cargados.</td></tr>`;
    tableBody.innerHTML = noRecordsHtml;
    mobileList.innerHTML = `<div style="text-align:center;color:var(--text-muted);padding:30px 10px;font-size:0.9rem;">No hay presupuestos.</div>`;
    return;
  }

  const rateToday = state.dolarBlue.promedio || 1545;

  filtered.forEach(b => {
    const amount = parseFloat(b.amount);
    
    // Convertir presupuesto a USD
    const budgetUSD = b.currency === "USD" ? amount : (amount / rateToday);

    // Sumar aportes asociados
    let spentUSD = 0;
    state.transactions.forEach(tx => {
      if (tx.budget_id === b.id) {
        const amt = parseFloat(tx.amount);
        const rate = parseFloat(tx.rate || 1);
        if (tx.currency === "USD") {
          spentUSD += amt;
        } else {
          spentUSD += (amt / rate);
        }
      }
    });

    const remainingUSD = budgetUSD - spentUSD;
    const progressPercent = Math.min((spentUSD / budgetUSD) * 100, 100).toFixed(1);
    const dateFormatted = formatDate(b.date);

    // Determinar estilo de desviación
    let badgeHtml = "";
    if (remainingUSD < -1) {
      badgeHtml = `<span class="badge-desviacion overspent">Exceso +${formatCurrency(Math.abs(remainingUSD), "USD")}</span>`;
    } else if (remainingUSD > 1) {
      badgeHtml = `<span class="badge-desviacion text-muted">Faltan ${formatCurrency(remainingUSD, "USD")}</span>`;
    } else {
      badgeHtml = `<span class="badge-desviacion underspent">Completado</span>`;
    }

    // Fila de Tabla (Desktop)
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${b.concept}</strong><br><span style="font-size:0.75rem;color:var(--text-muted)">Fecha: ${dateFormatted}</span></td>
      <td><span class="widget-pill btn-secondary" style="padding:4px 8px;font-size:0.75rem;">${b.phase.split(':')[0]}</span></td>
      <td>${b.provider ? `<strong>${b.provider}</strong>` : `<span class="text-muted">-</span>`}</td>
      <td style="font-weight:600">${formatCurrency(amount, b.currency)}</td>
      <td class="text-success" style="font-weight:600">${formatCurrency(spentUSD, "USD")}</td>
      <td>${badgeHtml}</td>
      <td>
        <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:3px">${progressPercent}%</div>
        <div class="progress-container" style="height: 5px; margin: 0; width: 100px;">
          <div class="progress-bar-fill" style="width: ${progressPercent}%; background: ${remainingUSD <= 0 ? 'var(--success)' : 'var(--primary)'}"></div>
        </div>
      </td>
      ${window.AppStorage.isAdmin() ? `
        <td style="text-align:right">
          <button class="btn btn-secondary btn-small" onclick="editBudget('${b.id}')">Editar</button>
          <button class="btn btn-danger btn-small" onclick="deleteBudget('${b.id}')" style="margin-left:4px">X</button>
        </td>
      ` : ""}
    `;
    tableBody.appendChild(tr);

    // Tarjeta (Móvil)
    const mobileCard = document.createElement("div");
    mobileCard.className = "mobile-tx-card";
    mobileCard.innerHTML = `
      <div class="mobile-tx-header">
        <span class="mobile-tx-partner">${b.concept}</span>
        <span class="mobile-tx-amount currency-usd">
          Pres: ${formatCurrency(amount, b.currency)}
        </span>
      </div>
      <div class="mobile-tx-concept">
        <strong>${b.phase.split(':')[0]}</strong>
        ${b.provider ? `<div style="font-size:0.85rem;color:var(--text-muted);margin:2px 0;">Proveedor: <strong>${b.provider}</strong></div>` : ''}
        <div style="margin-top: 5px; display:flex; justify-content:space-between; align-items:center;">
          <span>Financiado: <strong>${formatCurrency(spentUSD, "USD")}</strong> (${progressPercent}%)</span>
          ${badgeHtml}
        </div>
      </div>
      <div class="mobile-tx-footer">
        <span>Fecha: ${dateFormatted}</span>
      </div>
      ${window.AppStorage.isAdmin() ? `
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:5px;border-top:1px solid rgba(255,255,255,0.04);padding-top:8px;">
          <button class="btn btn-secondary btn-small" onclick="editBudget('${b.id}')">Editar</button>
          <button class="btn btn-danger btn-small" onclick="deleteBudget('${b.id}')">Borrar</button>
        </div>
      ` : ""}
    `;
    mobileList.appendChild(mobileCard);
  });
}

// Toggle de visibilidad de botones según la pestaña
function toggleTabButtons() {
  const btnAddTx = document.getElementById("btn-add-tx");
  const btnAddBudget = document.getElementById("btn-add-budget");
  const isAdmin = window.AppStorage.isAdmin();

  if (isAdmin) {
    if (state.activeTab === 'tab-aportes') {
      btnAddTx.classList.remove("hidden");
      btnAddBudget.classList.add("hidden");
    } else {
      btnAddTx.classList.add("hidden");
      btnAddBudget.classList.remove("hidden");
    }
  }
}

// 9. ACCIONES DE PRESEPUESTOS (AGREGAR / EDITAR / ELIMINAR)
async function saveBudget(event) {
  event.preventDefault();
  if (!window.AppStorage.isAdmin()) return alert("No tienes permisos de administrador.");

  const id = document.getElementById("bg-id").value;
  const concept = document.getElementById("bg-concept").value.trim();
  const provider = document.getElementById("bg-provider").value.trim();
  const phase = document.getElementById("bg-phase").value;
  const currency = document.getElementById("bg-currency").value;
  const amount = parseFloat(document.getElementById("bg-amount").value);
  const date = document.getElementById("bg-date").value;

  if (!concept) return alert("Por favor ingresa un concepto");
  if (!amount || amount <= 0) return alert("Por favor ingresa un monto válido mayor a 0");
  if (!date) return alert("Por favor selecciona una fecha");

  const submitBtn = document.getElementById("bg-submit-btn");
  submitBtn.classList.add("loading");

  try {
    const bgData = { concept, provider, phase, currency, amount, date };

    if (id) {
      await window.AppStorage.updateBudget(id, bgData);
    } else {
      bgData.id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9);
      await window.AppStorage.addBudget(bgData);
    }

    closeModal("modal-budget");
    await loadState();
  } catch (e) {
    alert(e.message);
  } finally {
    submitBtn.classList.remove("loading");
  }
}

window.deleteBudget = async function(id) {
  if (!window.AppStorage.isAdmin()) return;
  if (!confirm("¿Estás seguro de que deseas eliminar este presupuesto? Se desasociarán todos los aportes vinculados a él.")) return;

  try {
    await window.AppStorage.deleteBudget(id);
    await loadState();
  } catch (e) {
    alert(e.message);
  }
};

window.editBudget = function(id) {
  if (!window.AppStorage.isAdmin()) return;

  const bg = state.budgets.find(b => b.id === id);
  if (!bg) return;

  document.getElementById("bg-id").value = bg.id;
  document.getElementById("bg-concept").value = bg.concept;
  document.getElementById("bg-provider").value = bg.provider || "";
  document.getElementById("bg-phase").value = bg.phase;
  document.getElementById("bg-currency").value = bg.currency;
  document.getElementById("bg-amount").value = bg.amount;
  document.getElementById("bg-date").value = bg.date;

  document.getElementById("modal-bg-title").textContent = "Editar Presupuesto";
  openModal("modal-budget");
};

// 10. GESTIONAR ROL DE ADMINISTRADOR EN PANTALLA
function renderAdminUI() {
  const isAdmin = window.AppStorage.isAdmin();
  
  const adminElements = document.querySelectorAll(".admin-only");
  adminElements.forEach(el => {
    if (isAdmin) el.classList.remove("hidden");
    else el.classList.add("hidden");
  });

  const adminBadge = document.getElementById("admin-status-badge");
  const loginActionBtn = document.getElementById("login-action-btn");
  
  if (isAdmin) {
    adminBadge.classList.add("active");
    adminBadge.innerHTML = `<span style="display:inline-block;width:8px;height:8px;background:var(--success);border-radius:50%"></span> Administrador`;
    loginActionBtn.innerHTML = `Salir Modo Admin`;
  } else {
    adminBadge.classList.remove("active");
    adminBadge.textContent = "Modo Socio (Solo Lectura)";
    loginActionBtn.innerHTML = `Entrar como Admin`;
  }
}

// 11. ACCIONES DE TRANSACCIONES (AGREGAR / EDITAR / ELIMINAR APORTES)
async function saveTransaction(event) {
  event.preventDefault();
  if (!window.AppStorage.isAdmin()) return alert("No tienes permisos de administrador.");

  const id = document.getElementById("tx-id").value;
  const partner = document.getElementById("tx-partner").value;
  const currency = document.getElementById("tx-currency").value;
  const amount = parseFloat(document.getElementById("tx-amount").value);
  const rateInput = document.getElementById("tx-rate").value;
  const rate = currency === "ARS" ? parseFloat(rateInput) : 1;
  const budget_id = document.getElementById("tx-budget-id").value;
  const concept = document.getElementById("tx-concept").value.trim();
  const provider = document.getElementById("tx-provider").value.trim();
  let phase = document.getElementById("tx-phase").value;
  const date = document.getElementById("tx-date").value;

  if (!amount || amount <= 0) return alert("Por favor ingresa un monto válido mayor a 0");
  if (currency === "ARS" && (!rate || rate <= 0)) return alert("Por favor ingresa una cotización de dólar válida");
  if (!concept) return alert("Por favor ingresa un concepto");
  if (!date) return alert("Por favor selecciona una fecha");

  // Si se asocia a un presupuesto, heredar la fase del presupuesto para consistencia
  if (budget_id) {
    const associatedBudget = state.budgets.find(b => b.id === budget_id);
    if (associatedBudget) {
      phase = associatedBudget.phase;
    }
  }

  const submitBtn = document.getElementById("tx-submit-btn");
  submitBtn.classList.add("loading");

  try {
    const txData = {
      partner,
      currency,
      amount,
      rate,
      concept,
      provider,
      phase,
      date,
      budget_id: budget_id || null
    };

    if (id) {
      await window.AppStorage.updateTransaction(id, txData);
    } else {
      txData.id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9);
      await window.AppStorage.addTransaction(txData);
    }

    closeModal("modal-transaction");
    await loadState();
  } catch (e) {
    alert(e.message);
  } finally {
    submitBtn.classList.remove("loading");
  }
}

window.deleteTransaction = async function(id) {
  if (!window.AppStorage.isAdmin()) return;
  if (!confirm("¿Estás seguro de que deseas eliminar este aporte?")) return;

  try {
    await window.AppStorage.deleteTransaction(id);
    await loadState();
  } catch (e) {
    alert(e.message);
  }
};

window.editTransaction = function(id) {
  if (!window.AppStorage.isAdmin()) return;
  
  const tx = state.transactions.find(t => t.id === id);
  if (!tx) return;

  document.getElementById("tx-id").value = tx.id;
  document.getElementById("tx-partner").value = tx.partner;
  document.getElementById("tx-currency").value = tx.currency;
  document.getElementById("tx-amount").value = tx.amount;
  document.getElementById("tx-rate").value = tx.rate;
  document.getElementById("tx-budget-id").value = tx.budget_id || "";
  document.getElementById("tx-concept").value = tx.concept;
  document.getElementById("tx-provider").value = tx.provider || "";
  document.getElementById("tx-phase").value = tx.phase || "";
  document.getElementById("tx-date").value = tx.date;

  toggleRateVisibility();

  document.getElementById("modal-tx-title").textContent = "Editar Aporte";
  openModal("modal-transaction");
};

// 12. GESTIONAR PIN DE ADMIN DESDE LA WEB (CAMBIAR PIN)
async function savePinConfig(event) {
  event.preventDefault();
  if (!window.AppStorage.isAdmin()) return alert("No autorizado.");

  const newPin = document.getElementById("cfg-new-pin").value.trim();
  if (!newPin || newPin.length < 4) {
    return alert("El PIN debe tener al menos 4 caracteres.");
  }

  const submitBtn = document.getElementById("cfg-pin-submit-btn");
  submitBtn.classList.add("loading");

  try {
    await window.AppStorage.updatePin(newPin);
    closeModal("modal-pin-config");
    alert("PIN actualizado exitosamente.");
  } catch (e) {
    alert(e.message);
  } finally {
    submitBtn.classList.remove("loading");
  }
}

// ================= GESTIÓN DE CATEGORÍAS (RUBROS) =================

// Renderiza la lista de categorías en el modal de ajustes
function renderCategoriesConfigList() {
  const container = document.getElementById("categories-config-list");
  container.innerHTML = "";

  state.categories.forEach(cat => {
    const item = document.createElement("div");
    item.className = "category-config-item";
    item.innerHTML = `
      <span class="category-config-name">${cat.name}</span>
      <button class="btn btn-danger btn-small" onclick="deleteCategory('${cat.id}')" style="padding: 4px 8px;">Eliminar</button>
    `;
    container.appendChild(item);
  });
}

// Crea una categoría nueva
async function addCategory(event) {
  event.preventDefault();
  if (!window.AppStorage.isAdmin()) return;

  const input = document.getElementById("cfg-new-category");
  const name = input.value.trim();
  if (!name) return;

  const submitBtn = document.getElementById("cfg-category-submit-btn");
  submitBtn.classList.add("loading");

  try {
    await window.AppStorage.addCategory(name);
    input.value = "";
    await loadState(); // Recargar base de datos
    renderCategoriesConfigList(); // Renderizar lista interna del modal
  } catch (e) {
    alert(e.message);
  } finally {
    submitBtn.classList.remove("loading");
  }
}

// Elimina una categoría
window.deleteCategory = async function(id) {
  if (!window.AppStorage.isAdmin()) return;
  if (!confirm("¿Estás seguro de que deseas eliminar este rubro? No borrará transacciones existentes, pero ya no aparecerá como opción en los formularios.")) return;

  try {
    await window.AppStorage.deleteCategory(id);
    await loadState();
    renderCategoriesConfigList();
  } catch (e) {
    alert(e.message);
  }
};

// 13. GESTIONAR MODAL Y EVENTOS
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add("active");
    if (modalId === "modal-categories") {
      renderCategoriesConfigList();
    }
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove("active");
    if (modalId === "modal-transaction") {
      document.getElementById("tx-form").reset();
      document.getElementById("tx-id").value = "";
      document.getElementById("modal-tx-title").textContent = "Nuevo Aporte";
      document.getElementById("tx-rate").value = state.dolarBlue.promedio;
      toggleRateVisibility();
    } else if (modalId === "modal-budget") {
      document.getElementById("budget-form").reset();
      document.getElementById("bg-id").value = "";
      document.getElementById("modal-bg-title").textContent = "Nuevo Presupuesto Estimado";
    } else if (modalId === "modal-categories") {
      document.getElementById("cfg-new-category").value = "";
    }
  }
}

function toggleRateVisibility() {
  const currency = document.getElementById("tx-currency").value;
  const rateGroup = document.getElementById("tx-rate-group");
  const rateInput = document.getElementById("tx-rate");
  
  if (currency === "ARS") {
    rateGroup.classList.remove("hidden");
    rateInput.setAttribute("required", "true");
    if (!rateInput.value || parseFloat(rateInput.value) === 0) {
      rateInput.value = state.dolarBlue.promedio || 1350;
    }
  } else {
    rateGroup.classList.add("hidden");
    rateInput.removeAttribute("required");
    rateInput.value = "1";
  }
}

// 14. INICIO DE SESIÓN DE ADMINISTRADOR
async function handleAdminLogin(event) {
  event.preventDefault();
  const pinInput = document.getElementById("login-pin").value;
  
  const success = await window.AppStorage.login(pinInput);
  if (success) {
    closeModal("modal-login");
    renderAll();
    alert("¡Sesión de Administrador iniciada!");
  } else {
    alert("PIN incorrecto. Inténtalo de nuevo.");
  }
}

function handleLoginAction() {
  if (window.AppStorage.isAdmin()) {
    window.AppStorage.logout();
    renderAll();
    alert("Cerraste sesión de administrador.");
  } else {
    document.getElementById("login-pin").value = "";
    openModal("modal-login");
  }
}

// 15. HELPERS DE FORMATEO
function formatCurrency(amount, currency) {
  if (currency === "USD") {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
  } else {
    return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(amount);
  }
}

// Elimina decimales feos si son enteros
function formatNumber(num) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(num);
}

function formatDate(dateStr) {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// 16. REGISTRAR LOS LISTENERS DE EVENTOS
function initEventListeners() {
  // Transacciones
  document.getElementById("tx-form").addEventListener("submit", saveTransaction);
  document.getElementById("tx-currency").addEventListener("change", toggleRateVisibility);
  
  // Presupuestos
  document.getElementById("budget-form").addEventListener("submit", saveBudget);
  
  // Cambiar PIN
  document.getElementById("pin-config-form").addEventListener("submit", savePinConfig);

  // Crear Categorías
  document.getElementById("category-add-form").addEventListener("submit", addCategory);
  
  // Login
  document.getElementById("login-form").addEventListener("submit", handleAdminLogin);
  document.getElementById("login-action-btn").addEventListener("click", handleLoginAction);
  
  // Botones de Modales
  document.getElementById("btn-add-tx").addEventListener("click", () => {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById("tx-date").value = today;
    document.getElementById("tx-rate").value = state.dolarBlue.promedio || 1350;
    toggleRateVisibility();
    openModal("modal-transaction");
  });
  
  document.getElementById("btn-add-budget").addEventListener("click", () => {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById("bg-date").value = today;
    openModal("modal-budget");
  });

  document.getElementById("btn-pin-settings").addEventListener("click", () => {
    document.getElementById("cfg-new-pin").value = "";
    openModal("modal-pin-config");
  });

  document.getElementById("btn-category-settings").addEventListener("click", () => {
    openModal("modal-categories");
  });

  // Buscador Global
  document.getElementById("global-search").addEventListener("input", (e) => {
    state.searchQuery = e.target.value;
    renderTransactions();
    renderBudgets();
  });

  // Filtros
  document.getElementById("filter-socio").addEventListener("change", renderTransactions);
  document.getElementById("filter-moneda").addEventListener("change", renderTransactions);
  document.getElementById("filter-fase").addEventListener("change", renderTransactions);
  document.getElementById("filter-budget-fase").addEventListener("change", renderBudgets);

  // Navegación de pestañas (Tabs)
  const tabButtons = document.querySelectorAll(".tab-btn");
  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      // Toggle clase activa en los botones
      tabButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      // Mostrar/Ocultar contenido
      const tabId = btn.getAttribute("data-tab");
      state.activeTab = tabId;
      
      document.querySelectorAll(".tab-content").forEach(content => {
        content.classList.add("hidden");
      });
      document.getElementById(tabId).classList.remove("hidden");

      // Actualizar visibilidad de botones sticky
      toggleTabButtons();
    });
  });

  // Cerrar modales con clic en la X u overlay
  const closeButtons = document.querySelectorAll(".modal-close");
  closeButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const modal = btn.closest(".modal-overlay");
      if (modal) closeModal(modal.id);
    });
  });

  const overlays = document.querySelectorAll(".modal-overlay");
  overlays.forEach(overlay => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        closeModal(overlay.id);
      }
    });
  });
  
  const modalContainers = document.querySelectorAll(".modal-container");
  modalContainers.forEach(container => {
    container.addEventListener("click", (e) => {
      e.stopPropagation();
    });
  });
}
