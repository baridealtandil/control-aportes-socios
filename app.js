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
    
    widgetValue.innerHTML = `<strong>$${formatNumber(promedio)}</strong> <span style="font-size:0.75rem;color:var(--text-muted);margin-left:4px;">(Promedio entre compra $${formatNumber(data.compra)} y venta $${formatNumber(data.venta)})</span>`;
  } catch (e) {
    console.error("Fallo al cargar cotización de Dólar Blue:", e);
    widgetValue.innerHTML = `<span class="text-danger">Error de red</span>`;
    state.dolarBlue = { compra: 1545, venta: 1545, promedio: 1545 }; // Respaldo
  }
}

// 2. CARGAR EL ESTADO DESDE EL STORAGE
async function loadState() {
  const loader = document.createElement("div");
  loader.id = "global-loading";
  loader.style.cssText = "position:fixed;top:20px;right:20px;background:var(--primary);padding:8px 16px;border-radius:20px;font-size:0.8rem;z-index:9999;";
  loader.textContent = "Sincronizando con base de datos...";
  document.body.appendChild(loader);

  try {
    // Obtener transacciones, presupuestos, categorías y meta global en paralelo
    const [transactions, budgets, categories, targetBudget] = await Promise.all([
      window.AppStorage.getData(),
      window.AppStorage.getBudgets(),
      window.AppStorage.getCategories(),
      window.AppStorage.getTargetBudget()
    ]);
    
    state.transactions = transactions;
    state.budgets = budgets;
    state.categories = categories;
    state.targetBudget = targetBudget;
  } catch (e) {
    console.error("Error al cargar estado del backend:", e);
    alert("No se pudo conectar con el servidor de bases de datos.");
  } finally {
    const el = document.getElementById("global-loading");
    if (el) el.remove();
  }

  // Cargar selectores dinámicos de categorías
  renderCategories();
  
  // Cargar opciones en el select de transacciones (asociar a presupuesto)
  loadBudgetSelectOptions();

  // Cargar sugerencias de proveedores autogeneradas
  populateProviderSuggestions();

  // Renderizar componentes
  renderAll();
}

function renderCategories() {
  const selectTx = document.getElementById("tx-phase");
  const selectBg = document.getElementById("bg-phase");
  const filterTx = document.getElementById("filter-fase");
  const filterBg = document.getElementById("filter-budget-fase");

  const PHASE_ORDER = [
    "Fase 1: Obra Civil y Estructuras",
    "Fase 2: Insonorización, Pisos y Climatización",
    "Fase 3: Equipamiento de Frío y Cocina",
    "Fase 4: Tecnología, Audio, Luces y POS",
    "Fase 5: Mobiliario, Ambientación y Apertura"
  ];

  // Filtrar duplicados y ordenar por fase oficial
  const uniqueCatsMap = {};
  state.categories.forEach(c => {
    if (c && c.name) uniqueCatsMap[c.name.trim()] = true;
  });

  let cats = Object.keys(uniqueCatsMap);
  cats.sort((a, b) => {
    const getIndex = (name) => {
      const idx = PHASE_ORDER.findIndex(p => name.startsWith(p.split(':')[0]));
      return idx === -1 ? 99 : idx;
    };
    return getIndex(a) - getIndex(b);
  });

  // Mantener los valores actuales seleccionados
  const currentTxVal = selectTx.value;
  const currentBgVal = selectBg.value;
  const currentFilterTxVal = filterTx.value;
  const currentFilterBgVal = filterBg.value;

  // Llenar selectores de creación con el nombre completo
  selectTx.innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join('');
  selectBg.innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join('');

  // Llenar selectores de filtro con el nombre completo de la fase
  filterTx.innerHTML = '<option value="">Todos los Rubros</option>' + cats.map(c => `<option value="${c}">${c}</option>`).join('');
  filterBg.innerHTML = '<option value="">Todos los Rubros</option>' + cats.map(c => `<option value="${c}">${c}</option>`).join('');

  // Restaurar selecciones anteriores si siguen existiendo
  if (cats.includes(currentTxVal)) selectTx.value = currentTxVal;
  if (cats.includes(currentBgVal)) selectBg.value = currentBgVal;
  if (cats.includes(currentFilterTxVal)) filterTx.value = currentFilterTxVal;
  if (cats.includes(currentFilterBgVal)) filterBg.value = currentFilterBgVal;
}

const populateCategoryDropdowns = renderCategories;

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
      const amtFormatted = b.currency === "USD" ? `USD ${formatNumber(b.amount)}` : `$ ${formatNumber(b.amount)} ARS`;
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
  renderEqualizationTable();
  renderCaja();
  renderTransactions();
  calculateAndRenderBudgetDashboard();
  renderBudgets();
  toggleTabButtons();
}

// 4. CALCULAR Y RENDERIZAR DASHBOARD GENERAL (100% BASE PESOS ARS)
function calculateAndRenderDashboard() {
  let totalUSDCollected = 0;
  let totalARSCollected = 0;
  let totalUSDDirect = 0;
  
  const partnerStats = {};
  PARTNERS.forEach(p => {
    partnerStats[p] = { usdDirect: 0, arsTotal: 0, usdEquiv: 0, totalUsdValue: 0, arsEquivOfUsd: 0, totalArsValue: 0 };
  });

  const rateToday = state.dolarBlue.promedio || 1545;

  state.transactions.forEach(tx => {
    const amount = parseFloat(tx.amount);
    const rate = parseFloat(tx.rate || 1);
    const rateUsed = rate > 1 ? rate : rateToday;
    
    if (tx.currency === "USD") {
      totalUSDDirect += amount;
      totalUSDCollected += amount;
      const arsEquiv = amount * rateUsed;
      totalARSCollected += arsEquiv;
      if (partnerStats[tx.partner]) {
        partnerStats[tx.partner].usdDirect += amount;
        partnerStats[tx.partner].totalUsdValue += amount;
        partnerStats[tx.partner].arsEquivOfUsd += arsEquiv;
        partnerStats[tx.partner].totalArsValue += arsEquiv;
      }
    } else {
      const usdEquiv = amount / rateUsed;
      totalARSCollected += amount;
      totalUSDCollected += usdEquiv;
      if (partnerStats[tx.partner]) {
        partnerStats[tx.partner].arsTotal += amount;
        partnerStats[tx.partner].usdEquiv += usdEquiv;
        partnerStats[tx.partner].totalUsdValue += usdEquiv;
        partnerStats[tx.partner].totalArsValue += amount;
      }
    }
  });

  state.partnerStats = partnerStats;

  const targetBudget = state.targetBudget || 300000000; // $300.000.000 ARS
  const progressPercent = Math.min((totalARSCollected / targetBudget) * 100, 100).toFixed(1);
  
  const fillElem = document.getElementById("dash-progress-fill");
  if (fillElem) fillElem.style.width = `${progressPercent}%`;
  const textElem = document.getElementById("dash-progress-text");
  if (textElem) textElem.textContent = `${progressPercent}%`;
  
  const dashTotalArs = document.getElementById("dash-total-ars");
  if (dashTotalArs) dashTotalArs.textContent = formatCurrency(totalARSCollected, "ARS");
  
  const dashTargetArs = document.getElementById("dash-target-ars");
  if (dashTargetArs) dashTargetArs.textContent = formatCurrency(targetBudget, "ARS");
  
  const dashUsdRef = document.getElementById("dash-usd-ref");
  if (dashUsdRef) dashUsdRef.textContent = `USD ${formatNumber(Math.round(totalUSDCollected))}`;
  
  const dashUsdDirect = document.getElementById("dash-usd-direct");
  if (dashUsdDirect) dashUsdDirect.textContent = formatCurrency(totalUSDDirect, "USD");
  
  const dashUsdDirectArs = document.getElementById("dash-usd-direct-ars");
  if (dashUsdDirectArs) dashUsdDirectArs.textContent = `Equiv. ${formatCurrency(totalUSDDirect * rateToday, "ARS")}`;
}

// 5. RENDERIZAR TARJETAS DE SOCIOS (CON METAS Y APORTES EN PESOS ARS)
function renderPartners() {
  const container = document.getElementById("partners-grid");
  if (!container) return;
  container.innerHTML = "";

  PARTNERS.forEach(partnerName => {
    const stats = state.partnerStats[partnerName] || { usdDirect: 0, arsTotal: 0, totalUsdValue: 0, arsEquivOfUsd: 0, totalArsValue: 0 };
    const totalArsVal = stats.totalArsValue || (stats.arsTotal + stats.arsEquivOfUsd);
    const remaining = Math.max(TARGET_PER_PARTNER - totalArsVal, 0);
    const percentage = Math.min((totalArsVal / TARGET_PER_PARTNER) * 100, 100).toFixed(1);
    const isCompleted = totalArsVal >= TARGET_PER_PARTNER;

    // Líneas de detalle de monedas con equivalente
    const usdLine = stats.usdDirect > 0
      ? `<span>Dólares: <strong class="text-success">${formatCurrency(stats.usdDirect, "USD")}</strong>
           <span style="font-size:0.75rem;color:var(--text-muted)"> ≈ ${formatCurrency(stats.arsEquivOfUsd, "ARS")}</span></span>`
      : `<span>Dólares: <strong style="color:var(--text-muted)">$ 0 USD</strong></span>`;

    const arsLine = stats.arsTotal > 0
      ? `<span>Pesos: <strong class="text-primary">${formatCurrency(stats.arsTotal, "ARS")}</strong></span>`
      : `<span>Pesos: <strong style="color:var(--text-muted)">$ 0 ARS</strong></span>`;

    const card = document.createElement("div");
    card.className = `partner-card ${isCompleted ? "completed" : ""}`;
    card.style.cursor = "pointer";
    card.title = "Haz clic para ver el detalle de aportes con fechas";
    card.onclick = () => showPartnerHistory(partnerName);

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
          <span class="metric-label">Aportado ($ARS)</span>
          <span class="metric-val ${isCompleted ? 'completed' : ''}">${formatCurrency(totalArsVal, "ARS")}</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Saldo Pendiente ($ARS)</span>
          <span class="metric-val ${isCompleted ? 'completed' : ''} ${isCompleted ? '' : 'remaining'}">${isCompleted ? "Completado" : formatCurrency(remaining, "ARS")}</span>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; padding-top:6px; border-top:1px solid rgba(255,255,255,0.06); font-size:0.78rem; color:var(--text-muted);">
          <span>Ref. USD: <strong>USD ${formatNumber(Math.round(stats.totalUsdValue))}</strong></span>
          <span style="color:var(--primary-light);">Ver detalle ➔</span>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

// Modal de detalle e historial de aportes con fechas de un socio
function showPartnerHistory(partnerName) {
  const modalName = document.getElementById("modal-partner-name");
  const modalSummary = document.getElementById("modal-partner-summary");
  const modalList = document.getElementById("modal-partner-tx-list");

  if (!modalName || !modalList) return;

  const stats = state.partnerStats[partnerName] || { usdDirect: 0, arsTotal: 0, totalUsdValue: 0, arsEquivOfUsd: 0 };
  const txs = state.transactions.filter(t => t.partner === partnerName)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  modalName.textContent = `Aportes de ${partnerName}`;

  // Calcular equivalencias exactas por cada transacción
  let directUsd = 0;
  let directUsdArsEquiv = 0;
  let totalArs = 0;
  let totalArsUsdEquiv = 0;

  txs.forEach(tx => {
    const amt = parseFloat(tx.amount);
    const rate = parseFloat(tx.rate || 1);
    const rateUsed = rate > 1 ? rate : (state.dolarBlue.promedio || 1545);
    
    if (tx.currency === 'USD') {
      directUsd += amt;
      directUsdArsEquiv += (amt * rateUsed);
    } else {
      totalArs += amt;
      totalArsUsdEquiv += (amt / rateUsed);
    }
  });

  const totalUsdCombined = directUsd + totalArsUsdEquiv;

  modalSummary.innerHTML = `
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px;">
      <!-- BLOQUE USD -->
      <div style="background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.2); border-radius:12px; padding:12px;">
        <div style="font-size:0.78rem; color:var(--text-muted); margin-bottom:4px;">Aporte Dólares (USD)</div>
        <div style="font-size:1.3rem; font-weight:700; color:#10b981; font-family:'Outfit',sans-serif;">
          USD ${formatNumber(directUsd)}
        </div>
        <div style="font-size:0.78rem; color:var(--text-muted); margin-top:4px;">
          ${directUsd > 0 ? `≈ $ ${formatNumber(directUsdArsEquiv)} ARS` : 'Sin aportes en USD'}
        </div>
      </div>

      <!-- BLOQUE ARS -->
      <div style="background:rgba(99,102,241,0.08); border:1px solid rgba(99,102,241,0.2); border-radius:12px; padding:12px;">
        <div style="font-size:0.78rem; color:var(--text-muted); margin-bottom:4px;">Aporte Pesos (ARS)</div>
        <div style="font-size:1.3rem; font-weight:700; color:var(--primary-light); font-family:'Outfit',sans-serif;">
          $ ${formatNumber(totalArs)} ARS
        </div>
        <div style="font-size:0.78rem; color:var(--text-muted); margin-top:4px;">
          ${totalArs > 0 ? `≈ USD ${formatNumber(totalArsUsdEquiv)}` : 'Sin aportes en ARS'}
        </div>
      </div>
    </div>

    <div style="background:rgba(255,255,255,0.03); border-radius:8px; padding:8px 12px; font-size:0.76rem; color:var(--text-muted); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
      <span>ℹ️ Los montos en otra moneda son solo equivalencias al tipo de cambio (no se suman).</span>
      <span style="color:var(--text-main); font-weight:600;">Total: USD ${formatNumber(totalUsdCombined)}</span>
    </div>
  `;

  modalList.innerHTML = "";

  if (txs.length === 0) {
    modalList.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:20px;">Sin aportes registrados para este socio.</div>`;
  } else {
    txs.forEach(tx => {
      const amt = parseFloat(tx.amount);
      const rate = parseFloat(tx.rate || 1);
      const rateUsed = rate > 1 ? rate : (state.dolarBlue.promedio || 1545);
      const dateFormatted = formatDate(tx.date);
      
      const associatedBudget = state.budgets.find(b => b.id === tx.budget_id);
      const budgetText = associatedBudget ? `📌 Presupuesto: ${associatedBudget.concept}` : 'Aporte de Capital General';
      
      const equivText = tx.currency === 'USD'
        ? `≈ $ ${formatNumber(amt * rateUsed)} ARS`
        : `≈ USD ${formatNumber(amt / rateUsed)}`;

      const card = document.createElement("div");
      card.style.cssText = "background:rgba(255,255,255,0.04); border:1px solid var(--border-color); border-radius:10px; padding:12px; font-size:0.85rem;";
      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <span style="color:var(--text-muted); font-size:0.8rem; font-weight:500;">📅 ${dateFormatted}</span>
          <strong style="font-size:0.95rem; color:${tx.currency === 'USD' ? '#34d399' : 'var(--primary-light)'}">
            ${formatCurrency(amt, tx.currency)}
          </strong>
        </div>
        <div style="font-weight:600; color:var(--text-main); margin-bottom:2px;">${tx.concept}</div>
        <div style="font-size:0.78rem; color:var(--text-muted); display:flex; justify-content:space-between; flex-wrap:wrap; gap:4px; margin-top:4px;">
          <span>${tx.provider ? `Proveedor: <strong>${tx.provider}</strong>` : ''}</span>
          <span>${equivText} <span style="font-size:0.7rem;">(Dólar: $${formatNumber(rateUsed)})</span></span>
        </div>
        <div style="font-size:0.75rem; color:var(--success-light); margin-top:4px;">${budgetText}</div>
      `;
      modalList.appendChild(card);
    });
  }

  openModal("modal-partner-history");
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

  const rateToday = state.dolarBlue.promedio || 1545;

  filtered.forEach(tx => {
    const amount = parseFloat(tx.amount);
    const rate = parseFloat(tx.rate || 1);
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
      <td class="cell-amount ${tx.currency === "USD" ? "text-success" : "text-primary"}" style="font-weight:600">
        ${formatCurrency(amount, tx.currency)}
      </td>
      <td>$${formatNumber(rate > 1 ? rate : rateToday)}</td>
      <td class="cell-amount" style="font-weight:600; color: ${tx.currency === "USD" ? '#34d399' : 'var(--success-light)'}">
        ${tx.currency === "ARS" 
          ? formatCurrency(amount / rate, "USD")
          : formatCurrency(amount * (rate > 1 ? rate : rateToday), "ARS")}
        <div style="font-size:0.7rem;color:var(--text-muted);font-weight:normal;margin-top:2px;">${tx.currency === 'ARS' ? 'equiv. USD hist.' : 'equiv. ARS hist.'}</div>
      </td>
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
      <div class="mobile-tx-footer" style="display:flex; flex-direction:column; gap:4px; margin-top:8px; border-top:1px solid rgba(255,255,255,0.04); padding-top:8px; font-size:0.8rem; color:var(--text-muted);">
        <div style="display:flex; justify-content:space-between;">
          <span>Fecha: ${dateFormatted}</span>
          <span>Dólar: <strong>$${formatNumber(rate > 1 ? rate : rateToday)}</strong></span>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span>${tx.currency === 'ARS' ? 'Equiv. USD:' : 'Equiv. ARS:'} <strong style="color: ${tx.currency === "USD" ? '#34d399' : 'var(--success-light)'}">
            ${tx.currency === "ARS" 
              ? formatCurrency(amount / rate, "USD") 
              : formatCurrency(amount * (rate > 1 ? rate : rateToday), "ARS")}
          </strong></span>
        </div>
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
  const targetBudget = state.targetBudget || 200000;
  const unallocated = Math.max(targetBudget - totalBudgetUSD, 0);

  // Actualizar UI
  document.getElementById("budget-total-usd").textContent = formatCurrency(totalBudgetUSD, "USD");
  document.getElementById("budget-spent-usd").textContent = formatCurrency(totalSpentUSD, "USD");
  document.getElementById("budget-pending-usd").textContent = formatCurrency(pending, "USD");
  document.getElementById("budget-unallocated-usd").textContent = formatCurrency(unallocated, "USD");
  
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
    devElement.textContent = `USD 0 (Equilibrado)`;
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

  const PHASE_ORDER = [
    "Fase 1: Obra Civil y Estructuras",
    "Fase 2: Insonorización, Pisos y Climatización",
    "Fase 3: Equipamiento de Frío y Cocina",
    "Fase 4: Tecnología, Audio, Luces y POS",
    "Fase 5: Mobiliario, Ambientación y Apertura"
  ];

  const filtered = state.budgets.filter(b => {
    if (filterFase && b.phase !== filterFase) return false;
    
    // Filtro del buscador global
    if (state.searchQuery) {
      const searchTarget = `${b.concept} ${b.provider || ''} ${b.phase} ${b.currency} ${b.amount}`;
      return matchesSearch(searchTarget, state.searchQuery);
    }

    return true;
  }).sort((a, b) => {
    const getPhaseIndex = (p) => {
      if (!p) return 99;
      const idx = PHASE_ORDER.findIndex(o => p.startsWith(o.split(':')[0]));
      return idx === -1 ? 99 : idx;
    };
    const indexA = getPhaseIndex(a.phase);
    const indexB = getPhaseIndex(b.phase);
    
    if (indexA !== indexB) return indexA - indexB;
    return new Date(a.date) - new Date(b.date);
  });

  if (filtered.length === 0) {
    const noRecordsHtml = `<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:30px;">No se encontraron ítems de presupuesto cargados.</td></tr>`;
    tableBody.innerHTML = noRecordsHtml;
    mobileList.innerHTML = `<div style="text-align:center;color:var(--text-muted);padding:30px 10px;font-size:0.9rem;">No hay presupuestos.</div>`;
    return;
  }

  const rateToday = state.dolarBlue.promedio || 1545;

  filtered.forEach(b => {
    const amount = parseFloat(b.amount);
    
    // Sumar aportes asociados convirtiendo al tipo de moneda del presupuesto
    let spentOriginal = 0;
    state.transactions.forEach(tx => {
      if (tx.budget_id === b.id) {
        const amt = parseFloat(tx.amount);
        const rate = parseFloat(tx.rate || 1);
        
        if (tx.currency === b.currency) {
          spentOriginal += amt;
        } else if (b.currency === "ARS" && tx.currency === "USD") {
          const txRate = rate > 1 ? rate : rateToday;
          spentOriginal += (amt * txRate); // Convertir USD aportados a pesos
        } else if (b.currency === "USD" && tx.currency === "ARS") {
          const txRate = rate > 1 ? rate : rateToday;
          spentOriginal += (amt / txRate); // Convertir ARS aportados a dólares
        }
      }
    });

    const remainingOriginal = amount - spentOriginal;
    const progressPercent = amount > 0 
      ? Math.min((spentOriginal / amount) * 100, 100).toFixed(1) 
      : 0;
    const dateFormatted = formatDate(b.date);

    // Determinar estilo de desviación en la moneda original del presupuesto
    let badgeHtml = "";
    const minThreshold = b.currency === "USD" ? 0.01 : 1;
    
    if (remainingOriginal < -minThreshold) {
      badgeHtml = `<span class="badge-desviacion overspent">Exceso +${formatCurrency(Math.abs(remainingOriginal), b.currency)}</span>`;
    } else if (remainingOriginal > minThreshold) {
      badgeHtml = `<span class="badge-desviacion text-muted">Faltan ${formatCurrency(remainingOriginal, b.currency)}</span>`;
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
      <td class="text-success" style="font-weight:600">${formatCurrency(spentOriginal, b.currency)}</td>
      <td>${badgeHtml}</td>
      <td>
        <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:3px">${progressPercent}%</div>
        <div class="progress-container" style="height: 5px; margin: 0; width: 100px;">
          <div class="progress-bar-fill" style="width: ${progressPercent}%; background: ${remainingOriginal <= 0 ? 'var(--success)' : 'var(--primary)'}"></div>
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
          <span>Financiado: <strong>${formatCurrency(spentOriginal, b.currency)}</strong> (${progressPercent}%)</span>
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
    if (state.activeTab === 'tab-presupuestos') {
      if (btnAddTx) btnAddTx.classList.add("hidden");
      if (btnAddBudget) btnAddBudget.classList.remove("hidden");
    } else {
      if (btnAddTx) btnAddTx.classList.remove("hidden");
      if (btnAddBudget) btnAddBudget.classList.add("hidden");
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
  const secretBtn = document.getElementById("btn-secret-admin");
  
  if (isAdmin) {
    if (adminBadge) {
      adminBadge.classList.add("active");
      adminBadge.innerHTML = `<span style="display:inline-block;width:8px;height:8px;background:var(--success);border-radius:50%"></span> Administrador`;
    }
    if (loginActionBtn) {
      loginActionBtn.classList.remove("hidden");
      loginActionBtn.innerHTML = `Salir Admin`;
    }
    if (secretBtn) secretBtn.classList.add("hidden");
  } else {
    if (adminBadge) {
      adminBadge.classList.remove("active");
      adminBadge.textContent = "";
    }
    if (loginActionBtn) loginActionBtn.classList.add("hidden");
    if (secretBtn) secretBtn.classList.remove("hidden");
  }
}

// 11. ACCIONES DE TRANSACCIONES (AGREGAR / EDITAR / ELIMINAR APORTES)
async function saveTransaction(event) {
  event.preventDefault();
  if (!window.AppStorage.isAdmin()) return alert("No tienes permisos de administrador.");

  const id = document.getElementById("tx-id").value;
  const currency = document.getElementById("tx-currency").value;
  const amount = parseFloat(document.getElementById("tx-amount").value);
  const rateInput = document.getElementById("tx-rate").value;
  // Guardar el rate para AMBAS monedas (para poder calcular equiv histórico correcto)
  const rate = parseFloat(rateInput) || state.dolarBlue.promedio || 1545;
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
    if (id) {
      // Edición: único socio desde el campo readonly
      const partner = document.getElementById("tx-partner-edit").value;
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
      await window.AppStorage.updateTransaction(id, txData);
    } else {
      // Creación: recolectar socios seleccionados desde las casillas de verificación
      const checkedBoxes = document.querySelectorAll('input[name="tx-partner-checkbox"]:checked');
      if (checkedBoxes.length === 0) {
        throw new Error("Por favor selecciona al menos un socio.");
      }

      // Crear en bucle un aporte para cada socio seleccionado
      const savePromises = Array.from(checkedBoxes).map(async (cb) => {
        const partnerName = cb.value;
        const txData = {
          id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
          partner: partnerName,
          currency,
          amount,
          rate,
          concept,
          provider,
          phase,
          date,
          budget_id: budget_id || null
        };
        return window.AppStorage.addTransaction(txData);
      });

      await Promise.all(savePromises);
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
  
  // Ocultar sección de creación múltiple y mostrar campo único de edición
  document.getElementById("tx-partners-group-create").classList.add("hidden");
  document.getElementById("tx-partners-group-edit").classList.remove("hidden");
  document.getElementById("tx-partner-edit").value = tx.partner;

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
      
      // Restaurar visualización de creación y checkboxes
      document.getElementById("tx-partners-group-create").classList.remove("hidden");
      document.getElementById("tx-partners-group-edit").classList.add("hidden");
      document.getElementById("tx-partner-edit").value = "";
      
      const checkboxes = document.querySelectorAll('input[name="tx-partner-checkbox"]');
      checkboxes.forEach((cb, idx) => {
        cb.checked = idx === 0;
      });

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
  const rateLabel = document.getElementById("tx-rate-label");
  
  // Siempre mostrar el campo de cotización (para USD también, para guardar el tipo de cambio histórico)
  rateGroup.classList.remove("hidden");
  
  if (currency === "ARS") {
    rateInput.setAttribute("required", "true");
    if (rateLabel) rateLabel.textContent = "Cotización USD al momento del aporte (ARS por 1 USD)";
    if (!rateInput.value || parseFloat(rateInput.value) === 0 || parseFloat(rateInput.value) === 1) {
      rateInput.value = state.dolarBlue.promedio || 1545;
    }
  } else {
    rateInput.setAttribute("required", "true");
    if (rateLabel) rateLabel.textContent = "Cotización USD al momento del aporte (para calcular equiv. ARS)";
    if (!rateInput.value || parseFloat(rateInput.value) <= 1) {
      rateInput.value = state.dolarBlue.promedio || 1545;
    }
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

// Lógica de acceso por 4 toques seguidos (Ingreso directo como Admin sin contraseña)
let adminTapCount = 0;
let adminTapTimer = null;

async function handleAdmin4Tap(e) {
  if (e) e.preventDefault();
  
  if (window.AppStorage.isAdmin()) {
    return; // Ya es admin
  }

  adminTapCount++;
  if (adminTapTimer) clearTimeout(adminTapTimer);

  if (adminTapCount >= 4) {
    adminTapCount = 0;
    // Autenticar directamente con el PIN guardado o default
    const pin = localStorage.getItem("control_socios_admin_pin") || "1234";
    const ok = await window.AppStorage.login(pin);
    if (ok) {
      renderAll();
      showToast("Modo Administrador activado");
    } else {
      // Fallback si cambió el PIN en el backend
      document.getElementById("login-pin").value = "";
      openModal("modal-login");
    }
  } else {
    adminTapTimer = setTimeout(() => {
      adminTapCount = 0;
    }, 2500);
  }
}

// Notificación flotante Toast
function showToast(message) {
  let toast = document.getElementById("pwa-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "pwa-toast";
    toast.style.cssText = "position:fixed;bottom:85px;left:50%;transform:translateX(-50%);background:rgba(99,102,241,0.95);color:#fff;padding:8px 18px;border-radius:20px;font-size:0.82rem;font-weight:500;z-index:10000;transition:all 0.25s ease;box-shadow:0 4px 15px rgba(0,0,0,0.4);pointer-events:none;";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.opacity = "1";
  toast.style.transform = "translateX(-50%) translateY(0)";
  
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(-50%) translateY(10px)";
  }, 2000);
}

// 15. HELPERS DE FORMATEO
function formatCurrency(amount, currency) {
  const formatted = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(amount);
  if (currency === "USD") {
    return `USD ${formatted}`;
  } else {
    return `$ ${formatted} ARS`;
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
  const loginActionBtn = document.getElementById("login-action-btn");
  if (loginActionBtn) loginActionBtn.addEventListener("click", handleLoginAction);

  // Activadores de 4 toques para ingresar como Admin
  document.querySelectorAll(".admin-secret-target").forEach(el => {
    el.addEventListener("click", handleAdmin4Tap);
  });
  
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

  // Tareas de Obra del Proyecto
  const btnAddTask = document.getElementById("btn-add-project-task");
  if (btnAddTask) {
    btnAddTask.addEventListener("click", () => {
      document.getElementById("task-name").value = "";
      document.getElementById("task-progress").value = "0";
      openModal("modal-project-task");
    });
  }

  const formTask = document.getElementById("project-task-form");
  if (formTask) {
    formTask.addEventListener("submit", (e) => {
      e.preventDefault();
      try {
        const name = document.getElementById("task-name").value;
        const phase = document.getElementById("task-phase").value;
        const progress = document.getElementById("task-progress").value;
        
        window.AppStorage.addProjectTask({ phase, name, progress });
        closeModal("modal-project-task");
        renderCharts();
        toast("Nueva tarea de obra agregada con éxito.");
      } catch (err) {
        alert(err.message);
      }
    });
  }

  // Compartir por WhatsApp
  const btnShare = document.getElementById("btn-share-whatsapp");
  if (btnShare) btnShare.addEventListener("click", shareWhatsAppSummary);

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

      // Si se abre la pestaña de gráficos, renderizar / actualizar gráficos
      if (tabId === "tab-graficos") {
        renderCharts();
      }

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

  // Editar Meta Global del Proyecto
  document.getElementById("btn-edit-target-budget").addEventListener("click", async () => {
    if (!window.AppStorage.isAdmin()) return;
    const current = state.targetBudget || 200000;
    const input = prompt("Ingresa el monto de la Meta Global del Proyecto en USD (ej: 250000):", current);
    if (input === null) return;
    
    const parsed = parseFloat(input);
    if (isNaN(parsed) || parsed <= 0) {
      alert("Por favor ingresa un número válido mayor a 0.");
      return;
    }
    
    try {
      await window.AppStorage.updateTargetBudget(parsed);
      await loadState();
      renderAll();
      alert("Meta global actualizada con éxito.");
    } catch (e) {
      alert(e.message);
    }
  });
}

// 17b. CAJA — FONDOS SIN ASIGNAR A NINGÚN GASTO
function renderCaja() {
  const rateToday = state.dolarBlue.promedio || 1545;

  // Filtrar aportes SIN budget_id (no asignados a ningún gasto)
  const unassigned = state.transactions.filter(tx => !tx.budget_id);

  // Totales por moneda
  let cajaUSD = 0;
  let cajaARS = 0;

  // Detalle por socio: { partner: { usd, ars } }
  const byPartner = {};

  unassigned.forEach(tx => {
    const amt = parseFloat(tx.amount);
    const p = tx.partner;
    if (!byPartner[p]) byPartner[p] = { usd: 0, ars: 0 };

    if (tx.currency === 'USD') {
      cajaUSD += amt;
      byPartner[p].usd += amt;
    } else {
      cajaARS += amt;
      byPartner[p].ars += amt;
    }
  });

  const hasAnything = cajaUSD > 0 || cajaARS > 0;
  const usdInARS = cajaUSD * rateToday;
  const arsInUSD = cajaARS / rateToday;
  const totalEquivARS = usdInARS + cajaARS;

  // Actualizar totales
  document.getElementById('caja-usd-total').textContent =
    `USD ${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(cajaUSD)}`;
  document.getElementById('caja-ars-total').textContent =
    `$ ${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(cajaARS)}`;

  document.getElementById('caja-usd-ars-equiv').textContent = cajaUSD > 0
    ? `≈ $ ${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(usdInARS)} ARS al dólar de hoy`
    : 'Sin fondos USD sin asignar';

  document.getElementById('caja-ars-usd-equiv').textContent = cajaARS > 0
    ? `≈ USD ${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(arsInUSD)} al dólar de hoy`
    : 'Sin fondos ARS sin asignar';

  document.getElementById('caja-total-ars-equiv').textContent = hasAnything
    ? `Total equiv. ≈ $ ${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(totalEquivARS)} ARS`
    : '';

  // Mostrar / ocultar secciones
  document.getElementById('caja-empty').style.display = hasAnything ? 'none' : 'block';
  document.getElementById('caja-detalle').style.display = hasAnything && Object.keys(byPartner).length > 0 ? 'block' : 'none';

  // Renderizar chips por socio
  const detalleBody = document.getElementById('caja-detalle-body');
  detalleBody.innerHTML = '';
  Object.entries(byPartner).forEach(([partner, totals]) => {
    const parts = [];
    if (totals.usd > 0) parts.push(`<span style="color:#10b981;font-weight:600">USD ${new Intl.NumberFormat('es-AR',{maximumFractionDigits:0}).format(totals.usd)}</span>`);
    if (totals.ars > 0) parts.push(`<span style="color:var(--primary-light);font-weight:600">$ ${new Intl.NumberFormat('es-AR',{maximumFractionDigits:0}).format(totals.ars)} ARS</span>`);
    const chip = document.createElement('div');
    chip.style.cssText = 'background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:8px 12px; font-size:0.82rem;';
    chip.innerHTML = `<span style="color:var(--text-muted);margin-right:6px;">${partner}:</span>${parts.join(' + ')}`;
    detalleBody.appendChild(chip);
  });

  // Colorear la sección según estado
  const section = document.getElementById('caja-section');
  if (!hasAnything) {
    section.style.borderColor = 'rgba(255,255,255,0.06)';
    section.style.background = 'rgba(13,17,23,0.3)';
  } else {
    section.style.borderColor = 'rgba(16,185,129,0.25)';
    section.style.background = 'linear-gradient(135deg, rgba(16,185,129,0.06) 0%, rgba(13,17,23,0.5) 100%)';
  }
}

// 17. RENDERIZAR TABLA DE NIVELACIÓN DE APORTES (100% BASE PESOS ARS)
function renderEqualizationTable() {
  const tbody = document.getElementById("equalization-table-body");
  const mobileList = document.getElementById("mobile-equalization-list");
  const stats = state.partnerStats;

  if (!tbody) return;
  tbody.innerHTML = "";
  if (mobileList) mobileList.innerHTML = "";
  if (!stats) return;

  const rateToday = state.dolarBlue.promedio || 1545;

  // 1. Calcular el valor acumulado real en Pesos (ARS) de cada socio
  const partnerArsTotals = {};
  PARTNERS.forEach(p => { partnerArsTotals[p] = 0; });

  state.transactions.forEach(tx => {
    const amount = parseFloat(tx.amount);
    const rate = parseFloat(tx.rate || 1);
    if (tx.currency === "ARS") {
      partnerArsTotals[tx.partner] += amount;
    } else {
      const txRate = rate > 1 ? rate : rateToday;
      partnerArsTotals[tx.partner] += (amount * txRate);
    }
  });

  // 2. Encontrar el Máximo Aportado en Pesos (ARS)
  let maxARS = 0;
  PARTNERS.forEach(p => {
    if (partnerArsTotals[p] > maxARS) maxARS = partnerArsTotals[p];
  });

  // 3. Ordenar socios por mayor aportante en Pesos (Líder primero)
  const sortedPartners = [...PARTNERS].sort((a, b) => partnerArsTotals[b] - partnerArsTotals[a]);

  sortedPartners.forEach((p, index) => {
    const totalARS = partnerArsTotals[p];
    const rawDiffARS = maxARS - totalARS;
    
    // Umbral de tolerancia de redondeo: si la diferencia es menor a $100 ARS se considera nivelado
    const isLevel = rawDiffARS < 100;
    const diffARS = isLevel ? 0 : Math.round(rawDiffARS);
    const refUSD = isLevel ? 0 : Math.round(diffARS / rateToday);

    let statusBadge = "";
    if (isLevel && maxARS > 0) {
      if (index === 0) {
        statusBadge = `<span class="badge-desviacion underspent" style="background:rgba(16,185,129,0.2);color:var(--success-light);padding:4px 8px;border-radius:6px;font-size:0.75rem;">👑 Máximo Aportante</span>`;
      } else {
        statusBadge = `<span class="badge-desviacion underspent" style="background:rgba(16,185,129,0.15);color:#34d399;padding:4px 8px;border-radius:6px;font-size:0.75rem;">✅ Nivelado</span>`;
      }
    } else if (maxARS === 0) {
      statusBadge = `<span class="badge-desviacion text-muted" style="font-size:0.75rem;">Sin aportes</span>`;
    } else {
      statusBadge = `<span class="badge-desviacion overspent" style="background:rgba(239,68,68,0.15);color:#f87171;padding:4px 8px;border-radius:6px;font-size:0.75rem;">Falta Nivelar</span>`;
    }

    const diffText = isLevel
      ? `<span class="text-success" style="font-weight:600">Nivelado</span>`
      : `<span style="font-weight:700;color:var(--text-main);font-size:0.95rem;">$ ${new Intl.NumberFormat("es-AR",{maximumFractionDigits:0}).format(diffARS)} ARS <span style="font-size:0.78rem;color:var(--text-muted);font-weight:normal;">(Ref: USD ${refUSD})</span></span>`;

    // ── FILA DESKTOP ──────────────────────────────────────────
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${p}</strong></td>
      <td>${diffText}</td>
      <td>${statusBadge}</td>
    `;
    tbody.appendChild(tr);

    // ── TARJETA MÓVIL (SOLO IMPORTE FALTANTE PARA IGUALAR EN PESOS) ─────
    if (mobileList) {
      const card = document.createElement("div");
      card.className = "mobile-tx-card";
      card.innerHTML = `
        <div class="mobile-tx-header" style="margin-bottom:8px;">
          <span class="mobile-tx-partner" style="font-size:1.05rem;">${p}</span>
          <span>${statusBadge}</span>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.9rem; padding-top:4px;">
          <span style="color:var(--text-muted);">Falta igualar</span>
          <span>${diffText}</span>
        </div>
      `;
      mobileList.appendChild(card);
    }
  });
}

const renderEqualizationBoard = renderEqualizationTable;

// 18. COMPARTIR RESUMEN DEL PROYECTO POR WHATSAPP (CON ENFOQUE PESOS ARS)
function shareWhatsAppSummary() {
  const stats = state.partnerStats || {};
  const rateToday = state.dolarBlue.promedio || 1545;
  
  let totalUSD = 0;
  let totalUSDDirect = 0;
  let totalARS = 0;
  
  const partnerArsTotals = {};
  PARTNERS.forEach(p => { partnerArsTotals[p] = 0; });

  state.transactions.forEach(tx => {
    const amt = parseFloat(tx.amount);
    const rate = parseFloat(tx.rate || 1);
    if (tx.currency === "USD") {
      totalUSDDirect += amt;
      totalUSD += amt;
      const rateUsed = rate > 1 ? rate : rateToday;
      const arsEquiv = amt * rateUsed;
      totalARS += arsEquiv;
      partnerArsTotals[tx.partner] += arsEquiv;
    } else {
      const rateUsed = rate > 1 ? rate : rateToday;
      totalARS += amt;
      totalUSD += (amt / rateUsed);
      partnerArsTotals[tx.partner] += amt;
    }
  });

  const dateFormatted = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  // Encontrar máximo aportante en ARS
  let maxPartner = "";
  let maxARS = 0;
  PARTNERS.forEach(p => {
    if (partnerArsTotals[p] > maxARS) { maxARS = partnerArsTotals[p]; maxPartner = p; }
  });

  const partnerLines = PARTNERS.map(p => {
    const pArs = partnerArsTotals[p] || 0;
    const pUsd = stats[p] ? stats[p].totalUsdValue : 0;
    const isLeader = p === maxPartner && maxARS > 0;
    const icon = isLeader ? '👑' : (pArs > 0 ? '🔹' : '⚪');
    return `${icon} *${p}:* $${formatNumber(pArs)} ARS _(Ref: USD ${formatNumber(Math.round(pUsd))})_`;
  }).join('\n');

  let text = `🍺 *PACA BAR — ESTADO DE APORTES*\n`;
  text += `📅 _Fecha: ${dateFormatted}_\n`;
  text += `────────────────────────\n\n`;
  text += `📊 *RESUMEN DE RECAUDACIÓN*\n`;
  text += `• Total Recaudado: *$${formatNumber(totalARS)} ARS*\n`;
  text += `• Contador Ref.: *USD ${formatNumber(Math.round(totalUSD))}*\n`;
  text += `• Cotización Blue: *$${formatNumber(rateToday)} ARS*\n\n`;
  text += `👥 *APORTES POR SOCIO ($ARS)*\n`;
  text += `${partnerLines}\n\n`;
  text += `────────────────────────\n`;
  text += `📲 _Tablero Online:_\nhttps://control-aportes-socios.vercel.app/`;

  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

// 19. RENDERIZAR GRÁFICOS E INDICADORES (CHART.JS & GANTT)
let partnerGoalChart = null;
let partnerChart = null;
let currencyChart = null;

function renderCharts() {
  const stats = state.partnerStats || {};
  const rateToday = state.dolarBlue.promedio || 1545;
  const targetBudget = state.targetBudget || 200000;

  // 1. KPIs
  let totalUSD = 0;
  let totalUSDDirect = 0;
  let totalARS = 0;
  let totalRateSum = 0;
  let rateCount = 0;

  state.transactions.forEach(tx => {
    const amt = parseFloat(tx.amount);
    const rate = parseFloat(tx.rate || 1);
    if (tx.currency === "USD") {
      totalUSDDirect += amt;
      totalUSD += amt;
    } else {
      const rateUsed = rate > 1 ? rate : rateToday;
      totalARS += amt;
      totalUSD += (amt / rateUsed);
      totalRateSum += rateUsed;
      rateCount++;
    }
  });

  const avgRate = rateCount > 0 ? Math.round(totalRateSum / rateCount) : rateToday;
  const progressPercent = Math.min((totalUSD / targetBudget) * 100, 100).toFixed(1);

  const kpiTotal = document.getElementById("kpi-total-recaudado");
  const kpiRate = document.getElementById("kpi-avg-rate");
  const kpiProg = document.getElementById("kpi-global-progress");

  if (kpiTotal) kpiTotal.textContent = `USD ${formatNumber(Math.round(totalUSD))}`;
  if (kpiRate) kpiRate.textContent = `$ ${formatNumber(avgRate)} ARS`;
  if (kpiProg) kpiProg.textContent = `${progressPercent}%`;

  if (typeof Chart === 'undefined') return;

  // Chart 1: Horizontal Bar Chart of Partner Progress vs $75M Goal in ARS
  const ctxGoal = document.getElementById("chart-partners-goal-bars");
  if (ctxGoal) {
    if (partnerGoalChart) partnerGoalChart.destroy();

    const partnerDataArs = PARTNERS.map(p => stats[p] ? Math.round(stats[p].totalArsValue || (stats[p].arsTotal + stats[p].arsEquivOfUsd)) : 0);
    const goalDataArs = PARTNERS.map(() => TARGET_PER_PARTNER);

    partnerGoalChart = new Chart(ctxGoal, {
      type: 'bar',
      data: {
        labels: PARTNERS,
        datasets: [
          {
            label: 'Aportado ($ARS)',
            data: partnerDataArs,
            backgroundColor: '#818cf8',
            borderRadius: 6
          },
          {
            label: 'Meta por Socio ($75.000.000 ARS)',
            data: goalDataArs,
            backgroundColor: 'rgba(255, 255, 255, 0.06)',
            borderColor: 'rgba(255, 255, 255, 0.15)',
            borderWidth: 1,
            borderRadius: 6
          }
        ]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            max: TARGET_PER_PARTNER,
            ticks: { color: '#94a3b8', font: { family: 'Outfit' }, callback: (v) => `$${formatNumber(v)}` },
            grid: { color: 'rgba(255,255,255,0.05)' }
          },
          y: {
            ticks: { color: '#94a3b8', font: { family: 'Outfit', weight: '600' } },
            grid: { display: false }
          }
        },
        plugins: {
          legend: { position: 'top', labels: { color: '#94a3b8', font: { family: 'Outfit' } } },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: $${formatNumber(ctx.raw)} ARS (${((ctx.raw / TARGET_PER_PARTNER)*100).toFixed(1)}%)`
            }
          }
        }
      }
    });
  }

  // Chart 2: Partner Ring Chart (Anillo por Socio)
  const ctxPartner = document.getElementById("chart-partners-ring");
  if (ctxPartner) {
    if (partnerChart) partnerChart.destroy();
    
    const partnerData = PARTNERS.map(p => stats[p] ? parseFloat(stats[p].totalUsdValue.toFixed(2)) : 0);
    
    partnerChart = new Chart(ctxPartner, {
      type: 'doughnut',
      data: {
        labels: PARTNERS,
        datasets: [{
          data: partnerData,
          backgroundColor: ['#818cf8', '#34d399', '#fbbf24', '#f472b6'],
          borderWidth: 2,
          borderColor: '#161e31'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#94a3b8', font: { family: 'Outfit', size: 12 } } },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.label}: USD ${formatNumber(ctx.raw)}`
            }
          }
        },
        cutout: '68%'
      }
    });
  }

  // Chart 3: Currency Doughnut (Anillo de Monedas)
  const ctxCurrency = document.getElementById("chart-currency-doughnut");
  if (ctxCurrency) {
    if (currencyChart) currencyChart.destroy();

    const arsInUsd = totalARS / rateToday;

    currencyChart = new Chart(ctxCurrency, {
      type: 'doughnut',
      data: {
        labels: ['Dólares Directos (USD)', 'Pesos Convertidos (ARS equiv.)'],
        datasets: [{
          data: [parseFloat(totalUSDDirect.toFixed(2)), parseFloat(arsInUsd.toFixed(2))],
          backgroundColor: ['#10b981', '#6366f1'],
          borderWidth: 2,
          borderColor: '#161e31'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#94a3b8', font: { family: 'Outfit', size: 12 } } },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.label}: USD ${formatNumber(ctx.raw)}`
            }
          }
        },
        cutout: '68%'
      }
    });
  }

  // GANTT / TIMELINE DE AVANCE DE OBRA POR FASES
  renderGanttPhases(rateToday);
}

// 20. RENDERIZAR TIMELINE GANTT DE FASES Y TAREAS DE OBRA
function renderGanttPhases(rateToday) {
  const container = document.getElementById("gantt-phases-list");
  const overallBadge = document.getElementById("gantt-overall-badge");
  if (!container) return;

  container.innerHTML = "";

  const isAdmin = window.AppStorage.isAdmin();
  const tasks = window.AppStorage.getProjectTasks() || [];

  // Fases definidas
  const PHASES = [
    "Fase 1: Obra Civil y Estructuras",
    "Fase 2: Insonorización, Pisos y Climatización",
    "Fase 3: Equipamiento de Frío y Cocina",
    "Fase 4: Tecnología, Audio, Luces y POS",
    "Fase 5: Mobiliario, Ambientación y Apertura"
  ];

  let totalTasksCount = tasks.length;
  let totalProgressSum = 0;

  tasks.forEach(t => { totalProgressSum += (t.progress || 0); });

  const globalPhysicalPct = totalTasksCount > 0 ? (totalProgressSum / totalTasksCount).toFixed(1) : 0;
  if (overallBadge) overallBadge.textContent = `🏗️ ${globalPhysicalPct}% Avance Físico Real`;

  PHASES.forEach((phaseName, index) => {
    const phaseTasks = tasks.filter(t => t.phase === phaseName);
    
    let phaseProgressSum = 0;
    phaseTasks.forEach(t => { phaseProgressSum += (t.progress || 0); });
    const phasePct = phaseTasks.length > 0 ? (phaseProgressSum / phaseTasks.length).toFixed(1) : 0;

    let statusText = "Pendiente";
    let statusBg = "rgba(255,255,255,0.06)";
    let statusColor = "var(--text-muted)";
    let barColor = "var(--primary-light)";

    if (parseFloat(phasePct) >= 100) {
      statusText = "✅ Completado";
      statusBg = "rgba(16,185,129,0.15)";
      statusColor = "#34d399";
      barColor = "var(--success)";
    } else if (parseFloat(phasePct) > 0) {
      statusText = "⚡ En Ejecución";
      statusBg = "rgba(99,102,241,0.15)";
      statusColor = "var(--primary-light)";
      barColor = "linear-gradient(90deg, #6366f1 0%, #34d399 100%)";
    }

    const card = document.createElement("div");
    card.style.cssText = "background:rgba(255,255,255,0.03); border:1px solid var(--border-color); border-radius:14px; padding:18px;";
    
    // Tareas HTML
    let tasksHtml = "";
    if (phaseTasks.length === 0) {
      tasksHtml = `<div style="font-size:0.8rem; color:var(--text-muted); padding:6px 0;">Sin tareas registradas en esta fase aún.</div>`;
    } else {
      phaseTasks.forEach(t => {
        const isDone = t.progress >= 100;
        const adminControls = isAdmin ? `
          <div style="display:flex; align-items:center; gap:8px; margin-top:8px; flex-wrap:wrap;">
            <button onclick="changeTaskProgress('${t.id}', Math.max(0, parseInt('${t.progress}',10) - 10))" style="background:rgba(255,255,255,0.08); border:1px solid var(--border-color); color:#fff; padding:3px 8px; border-radius:6px; font-size:0.75rem; cursor:pointer;" title="Restar 10%">-10%</button>
            <input type="range" min="0" max="100" step="10" value="${t.progress}" onchange="changeTaskProgress('${t.id}', this.value)" style="flex:1; min-width:90px; accent-color:var(--primary-light); cursor:pointer;">
            <button onclick="changeTaskProgress('${t.id}', Math.min(100, parseInt('${t.progress}',10) + 10))" style="background:rgba(255,255,255,0.08); border:1px solid var(--border-color); color:#fff; padding:3px 8px; border-radius:6px; font-size:0.75rem; cursor:pointer;" title="Sumar 10%">+10%</button>
            <button onclick="changeTaskProgress('${t.id}', 100)" style="background:${t.progress===100?'var(--success)':'rgba(16,185,129,0.2)'}; border:none; color:${t.progress===100?'#fff':'#34d399'}; padding:3px 8px; border-radius:6px; font-size:0.75rem; cursor:pointer; font-weight:600;">100%</button>
            <button onclick="removeProjectTask('${t.id}')" style="background:none; border:none; color:#f87171; cursor:pointer; font-size:0.85rem; margin-left:auto;" title="Eliminar tarea">🗑️</button>
          </div>
        ` : '';

        tasksHtml += `
          <div style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.05); border-radius:8px; padding:10px 12px; margin-top:8px;">
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.85rem; flex-wrap:wrap; gap:6px;">
              <span style="color:${isDone ? '#34d399' : 'var(--text-main)'}; font-weight:500;">
                ${isDone ? '✅' : '📌'} ${t.name}
              </span>
              <strong style="font-size:0.82rem; color:${isDone ? '#34d399' : 'var(--primary-light)'}">${t.progress}%</strong>
            </div>
            <div style="height:5px; background:rgba(255,255,255,0.08); border-radius:4px; overflow:hidden; margin-top:6px;">
              <div style="width:${t.progress}%; height:100%; background:${isDone ? 'var(--success)' : 'var(--primary-light)'}; transition:width 0.3s ease;"></div>
            </div>
            ${adminControls}
          </div>
        `;
      });
    }

    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:6px;">
        <div style="font-weight:700; font-size:1rem; color:var(--text-main); display:flex; align-items:center; gap:8px;">
          <span style="display:inline-flex; align-items:center; justify-content:center; width:26px; height:26px; background:rgba(99,102,241,0.2); color:var(--primary-light); border-radius:50%; font-size:0.8rem;">${index + 1}</span>
          ${phaseName}
        </div>
        <span style="font-size:0.78rem; padding:4px 12px; border-radius:20px; background:${statusBg}; color:${statusColor}; font-weight:600;">
          ${statusText} (${phasePct}%)
        </span>
      </div>

      <!-- Barra de Fase -->
      <div style="height:10px; background:rgba(255,255,255,0.06); border-radius:6px; overflow:hidden; margin:10px 0 14px 0;">
        <div style="width:${phasePct}%; height:100%; background:${barColor}; transition:width 0.5s ease; border-radius:6px;"></div>
      </div>

      <!-- Desglose de Tareas -->
      <div style="margin-top:10px;">
        <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em; margin-bottom:4px;">
          Tareas y Trabajos de esta Fase (${phaseTasks.length}):
        </div>
        ${tasksHtml}
      </div>
    `;
    container.appendChild(card);
  });
}

// Helpers globales para actualizar o eliminar tareas desde la interfaz
window.changeTaskProgress = function(id, progress) {
  if (!window.AppStorage.isAdmin()) return;
  window.AppStorage.updateProjectTaskProgress(id, progress);
  renderCharts();
  toast(`Avance de tarea actualizado a ${progress}%`);
};

window.removeProjectTask = function(id) {
  if (!window.AppStorage.isAdmin()) return;
  if (confirm("¿Seguro que deseas eliminar esta tarea de obra?")) {
    window.AppStorage.deleteProjectTask(id);
    renderCharts();
    toast("Tarea eliminada.");
  }
};
