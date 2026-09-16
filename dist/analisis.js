 
const API = "https://script.google.com/macros/s/AKfycbzDFG8R-elR_nc1E3lSW6xd6hIpMHE2RKaC9bRiiR5i-ROJgyMiPdFfeM5pAmsBYhct/exec";


/* ================================================================================================================================================================================================================================================================================================================================================================
  COMIENZO DE LA SECCION DE ANALISIS
==================================================================================================================================================================================================================================================================================================================================================================  */
// aqui empieza el desarrollo de la seccion de Analisis 🔹
const ANALYSIS_STATE = {
  month: new Date().getMonth(),
  year: new Date().getFullYear()
};

// MANEJAR CAMBIO DE MES Y POBLAR EL SELECTOR
const monthSelect = document.getElementById("analysisMonth");

const monthNames = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"
];

monthNames.forEach((name, index) => {
  const opt = document.createElement("option");
  opt.value = index;
  opt.textContent = name;
  if (index === ANALYSIS_STATE.month) opt.selected = true;
  monthSelect.appendChild(opt);
});

// MANEJAR CAMBIO DE AÑO Y POBLAR EL SELECTOR
const yearSelect = document.getElementById("analysisYear");
let yearRange = 5; // Cantidad de años iniciales hacia el futuro
const currentYear = new Date().getFullYear();

function populateYearSelect(startYear = currentYear) {
  // Limpiar opciones actuales
  yearSelect.innerHTML = "";

  for (let y = startYear; y <= startYear + yearRange; y++) {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = y;
    if (y === ANALYSIS_STATE.year) opt.selected = true;
    yearSelect.appendChild(opt);
  }
}

// Llenado inicial
populateYearSelect();

// Detectar si el usuario selecciona el último año y agregar 5 más
yearSelect.addEventListener("change", e => {
  const selectedYear = Number(e.target.value);
  ANALYSIS_STATE.year = selectedYear;
  fetchData();

  const options = Array.from(yearSelect.options).map(o => Number(o.value));
  const lastYear = Math.max(...options);

  if (selectedYear === lastYear) {
    // Agregar 5 años más
    populateYearSelect(lastYear + 1);
    yearSelect.value = selectedYear; // mantener selección
  }
});


// ESCUCHAR CAMBIOS EN SELECTORES
monthSelect.addEventListener("change", e => {
  ANALYSIS_STATE.month = Number(e.target.value);
  fetchData();
});

yearSelect.addEventListener("change", e => {
  ANALYSIS_STATE.year = Number(e.target.value);
  fetchData();
});



// Variables globales para gráficos
let salesByMonthChart = null;
let topProductsChart = null;



// 🔹 Función para obtener los KPIs y top productos
function fetchData() {
  const { month, year } = ANALYSIS_STATE;

  fetch(`${API}?action=kpis&month=${month}&year=${year}`)
    .then(res => res.json())
    .then(data => {
      if (!data.success) return;

      animateNumber("kpiVentas", data.totalVentas);
      animateNumber("kpiGanancia", data.gananciaNeta);
      animateNumber("kpiDescuentos", data.totalDescuentos);
      animateNumber("kpiSinDescuento", data.ventasSinDescuento);
      animateNumber("ganancia_neta", data.gananciaNeta);

      document.getElementById("totalpagado").textContent =
        "$" + Number(data.totalGastos || 0).toLocaleString("es-CO");

      // Top productos
      const tbody = document.getElementById("top_productos");
      tbody.innerHTML = "";
      data.topProductos.forEach(p => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${p.producto}</td>
          <td>${p.marca}</td>
          <td>${p.cantidad}</td>
          <td>$${p.ganancia.toLocaleString("es-CO")}</td>
        `;
        tbody.appendChild(tr);
      });
    });
}





function showToast(msg) {
  const toast = document.createElement("div");
  toast.textContent = msg;
  toast.style.position = "fixed";
  toast.style.bottom = "20px";
  toast.style.right = "20px";
  toast.style.background = "#111";
  toast.style.color = "#fff";
  toast.style.padding = "12px 16px";
  toast.style.borderRadius = "8px";
  toast.style.fontSize = "0.85rem";
  toast.style.zIndex = 9999;
  toast.style.opacity = "0";
  toast.style.transition = "opacity .3s ease";

  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.style.opacity = "1");

  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}



// 🔹 Formato de números
function formatNumber(num) {
  return Number(num || 0).toLocaleString('es-CO');
}

// 🔹 Animación tipo "baloto" para cada KPI
function animateNumber(id, target) {
  const el = document.getElementById(id);
  let current = parseInt(el.getAttribute("data-current") || 0);
  const diff = target - current;
  const step = Math.ceil(Math.abs(diff)/20);
  if (diff === 0) return;
  const direction = diff > 0 ? 1 : -1;

  const interval = setInterval(() => {
    current += step * direction;
    if ((direction>0 && current >= target) || (direction<0 && current <= target)) {
      current = target;
      clearInterval(interval);
    }
    el.textContent = "$" + formatNumber(current);
    el.setAttribute("data-current", current);
  }, 50);
}


// 🔹 Agregar gasto
// 🔹 Agregar gasto
document.getElementById("btnAgregarGasto").addEventListener("click", async (e) => {
  e.preventDefault(); // 🔹 Evita que el formulario recargue la página

  const nombre = document.getElementById("gastoNombre").value.trim();
  const valor = Number(document.getElementById("gastoValor").value);
  if (!nombre || !valor) {
    await window.platformAlert?.(
      "Datos incompletos",
      "Ingresa el nombre y el valor del gasto.",
      "warning"
    );
    return;
  }

  try {
    await fetch(API, {
      method: "POST",
      mode: "no-cors",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ action:"add_expense", nombre, valor })
    });

    document.getElementById("gastoNombre").value = "";
    document.getElementById("gastoValor").value = "";

    // 🔄 Actualizar KPIs y lista de gastos inmediatamente
    fetchData();
    fetchExpenses();

  } catch(err) {
    console.error("Error agregando gasto:", err);
  }
});



// 🔹 Obtener y renderizar lista de gastos
// 🔹 Obtener y renderizar lista de gastos
async function fetchExpenses() {
  try {
    const res = await fetch(API + "?action=expenses");
    const data = await res.json();

    if (!data || !Array.isArray(data)) return;

    const list = document.getElementById("expenseList");
    list.innerHTML = "";

    data.forEach(g => {
      const li = document.createElement("li");
      li.className = "expense-item";

      // Texto gasto
      const span = document.createElement("span");
      span.className = "expense-text";
      span.innerHTML = `
        ${g.nombre}:
        <span class="expense-value">
          $${Number(g.valor).toLocaleString("es-CO")}
        </span>
      `;

       // Botón eliminar
      const btn = document.createElement("button");
      btn.className = "expense-delete";
      btn.textContent = "🗑️";

      btn.addEventListener("click", async () => {
        const confirmed = await window.platformConfirm?.(
          "Eliminar gasto",
          "Esta acción no se puede deshacer.",
          "Eliminar"
        );
        if (!confirmed) return;

        await fetch(API, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "delete_expense",
            id: g.id
          })
        });

        fetchExpenses();
        fetchData();
      });

      li.appendChild(span);
      li.appendChild(btn);
      list.appendChild(li);
    });

  } catch (err) {
    console.error("Error obteniendo gastos:", err);
  }
}


function setTotalVentasAnio(total) {
  const card = document.querySelector(".chart-card");
  if (!card) return;

  const h3 = card.querySelector("h3");
  if (!h3) return;

  // Convertimos el h3 en contenedor flex
  h3.style.display = "flex";
  h3.style.justifyContent = "space-between";
  h3.style.alignItems = "center";
  h3.style.gap = "12px";

  // Texto izquierdo (Ventas por Mes)
  let title = h3.querySelector(".chart-title");
  if (!title) {
    title = document.createElement("span");
    title.className = "chart-title";
    title.textContent = h3.textContent.trim();
    h3.textContent = "";
    h3.appendChild(title);
  }

  // Bloque derecho (Ventas Año)
  let box = h3.querySelector(".ventas-anio-box");

  if (!box) {
    box = document.createElement("div");
    box.className = "ventas-anio-box";
    box.style.textAlign = "right";
    box.style.lineHeight = "1.1";

    const label = document.createElement("div");
    label.textContent = "Ventas Año";
    label.style.fontSize = "0.65rem";
    label.style.fontWeight = "500";
    label.style.opacity = "0.6";

    const value = document.createElement("div");
    value.className = "ventas-anio-value";
    value.style.fontSize = "0.85rem";
    value.style.fontWeight = "700";
    value.style.color = "#16a34a";

    box.appendChild(label);
    box.appendChild(value);
    h3.appendChild(box);
  }

  // Actualizar valor
  const valueEl = h3.querySelector(".ventas-anio-value");
  valueEl.textContent = `$${total.toLocaleString("es-CO")}`;
}



// 🔹 Cargar gráfico de ventas por mes
async function loadSalesByMonthChart() {
  const { year } = ANALYSIS_STATE; // Tomamos el año seleccionado
  const res = await fetch(`${API}?action=chart_sales_month&year=${year}`);
  const data = await res.json();
  if (!data.success) return;

  // 🔹 TOTAL ANUAL del año seleccionado
  const totalAnual = data.data.reduce(
    (sum, val) => sum + Number(val || 0),
    0
  );

  setTotalVentasAnio(totalAnual); // Actualiza la tarjeta del total anual

  const ctx = document.getElementById("salesByMonthChart");

  if (salesByMonthChart) salesByMonthChart.destroy();

  salesByMonthChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: data.labels,
      datasets: [{
        label: `Ventas del Año ${year}`,
        data: data.data,
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } }
    }
  });
}




// 🔹 Cargar gráfico de top productos
async function loadTopProductsChart() {
  const res = await fetch(API + "?action=chart_top_products");
  const data = await res.json();
  if (!data.success) return;

  const ctx = document.getElementById("topProductsChart");

  if (topProductsChart) topProductsChart.destroy();

  topProductsChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: data.labels,
      datasets: [{
        label: "Cantidad Vendida",
        data: data.data
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } }
    }
  });
}

/* ======================
  MODAL DE MARCAS
====================== */
const brandModal = document.getElementById("brandModal");
const brandModalTitle = document.getElementById("brandModalTitle");
const brandProductsTableBody = document.querySelector("#brandProductsTable tbody");
const brandModalClose = document.getElementById("brandModalClose");

// Cerrar modal
brandModalClose.addEventListener("click", () => {
  brandModal.classList.add("hidden");
  brandProductsTableBody.innerHTML = "";
});

// Función para mostrar productos de una marca
function showBrandProducts(marca) {
  brandModalTitle.textContent = `Productos de ${marca}`;
  
  // Obtener productos del inventario
  fetch(API + "?action=list")
    .then(res => res.json())
    .then(products => {
      const filtered = products.filter(p => p.marca === marca);
      brandProductsTableBody.innerHTML = "";
      
      filtered.forEach(p => {
        const totalInversion = p.costo * p.stock;
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${p.nombre}</td>
          <td>${p.stock}</td>
          <td>$${Number(p.costo).toLocaleString()}</td>
          <td>$${Number(totalInversion).toLocaleString()}</td>
        `;
        brandProductsTableBody.appendChild(tr);
      });

      brandModal.classList.remove("hidden");
    });
}

// 🔹 Agregar evento click a cada marca en la tabla de análisis
document.querySelectorAll(".brand-analysis-card tbody tr td:first-child").forEach(td => {
  td.style.cursor = "pointer"; // indica que es clickeable
  td.addEventListener("click", () => {
    showBrandProducts(td.textContent);
  });
});


// 🔹 Cargar análisis por marca
async function renderBrandAnalysis() {
  try {
    const res = await fetch(API + "?action=analysis_by_brand");
    const data = await res.json();

    const tbody = document.querySelector("#brandAnalysisTable tbody");
    tbody.innerHTML = "";

    if (data.success && data.data.length > 0) {
      data.data.forEach(b => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${b.marca}</td>
          <td>${b.productos}</td>
          <td>${b.vendidos}</td>
          <td>$${b.inversion.toLocaleString()}</td>
          <td>$${b.ventas.toLocaleString()}</td>
          <td>$${b.ganancia.toLocaleString()}</td>
        `;

        // 🔹 Agregar click al nombre de la marca
        tr.querySelector("td:first-child").style.cursor = "pointer";
        tr.querySelector("td:first-child").addEventListener("click", () => {
          showBrandProducts(b.marca);
        });

        tbody.appendChild(tr);
      });
    } else {
      tbody.innerHTML = `<tr><td colspan="6">No hay datos</td></tr>`;
    }

  } catch (err) {
    console.error("Error al cargar análisis por marca:", err);
  }
}


// Llamar al cargar la vista Análisis
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("view-analisis")?.classList.contains("active")) {
    renderBrandAnalysis();
  }
});





function isAnalysisViewActive() {
  return document.visibilityState === "visible" &&
    document.getElementById("view-analisis")?.classList.contains("active");
}

function refreshAnalysisView() {
  if (!isAnalysisViewActive()) return;
  fetchData();
  fetchExpenses();
  renderBrandAnalysis();
  loadSalesByMonthChart();
  loadTopProductsChart();
}

// La vista conserva su actualización automática, pero no consume red ni CPU oculta.
setInterval(() => {
  if (!isAnalysisViewActive()) return;
  fetchData();
  fetchExpenses();
  renderBrandAnalysis();
}, 3000);

setInterval(() => {
  if (!isAnalysisViewActive()) return;
  loadSalesByMonthChart();
  loadTopProductsChart();
}, 120000);

document.addEventListener("visibilitychange", () => {
  if (isAnalysisViewActive()) refreshAnalysisView();
});

window.ANALYSIS = {
  init: refreshAnalysisView
};

// Primera carga únicamente cuando Análisis es la vista inicial.
refreshAnalysisView();
/* ================================================================================================================================================================================================================================================================================================================================================================
 FINAL DE LA SECCION DE ANALISIS
==================================================================================================================================================================================================================================================================================================================================================================  */






/* ======================================================================================================================
 COMIENZO DE LA SECCION DE CLIENTES
====================================================================================================================== */

// =======================
// CLIENTES EN MEMORIA (SESIÓN)
// =======================
let sessionClients = [];
let clientsHydrated = false;
let clientsRequest = null;
let clientsLastSyncedAt = 0;
const CLIENTS_CACHE_KEY = "marsh_clients_session_v1";

// =======================
// FORMATO FECHAS
// =======================
function formatDateLong(d) {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date)) return "";
  return date.toLocaleDateString("es-CO", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

// =======================
// RENDER CLIENTES
// =======================
function clientActionIcon(name) {
  const paths = {
    pencil: '<path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"></path><path d="m15 5 4 4"></path>',
    trash: '<path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="m19 6-1 14H6L5 6"></path><path d="M10 11v5M14 11v5"></path>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="m3 7 9 6 9-6"></path>'
  };
  return `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || ""}</svg>`;
}

function escapeClientValue(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function readClientsCache() {
  try {
    const cached = JSON.parse(sessionStorage.getItem(CLIENTS_CACHE_KEY) || "null");
    if (!cached || !Array.isArray(cached.clients)) return null;
    return cached;
  } catch {
    return null;
  }
}

function writeClientsCache(clients) {
  try {
    sessionStorage.setItem(CLIENTS_CACHE_KEY, JSON.stringify({
      clients,
      syncedAt: Date.now()
    }));
  } catch {
    // La interfaz continúa operando aunque el almacenamiento esté restringido.
  }
}

function paintClients(clients) {
  const tbody = document.querySelector("#clientsTable tbody");
  if (!tbody) return;

  sessionClients = Array.isArray(clients) ? clients : [];
  clientsHydrated = true;

  if (!sessionClients.length) {
    tbody.innerHTML = `<tr><td colspan="7">No hay clientes</td></tr>`;
    updateClientKPIs([]);
    return;
  }

  tbody.innerHTML = sessionClients.map(c => {
    const id = escapeClientValue(c.id);
    return `
      <tr>
        <td><input type="checkbox" data-id="${id}"></td>
        <td>${escapeClientValue(c.nombre)}</td>
        <td>${escapeClientValue(c.telefono)}</td>
        <td>${escapeClientValue(c.correo)}</td>
        <td>${escapeClientValue(formatDateLong(c.fechacumple))}</td>
        <td>${escapeClientValue(formatDateLong(c.registrado))}</td>
        <td>
          <button class="edit-client table-icon-button" data-id="${id}" aria-label="Editar cliente" title="Editar cliente">${clientActionIcon("pencil")}</button>
          <button class="delete-client table-icon-button" data-id="${id}" aria-label="Eliminar cliente" title="Eliminar cliente">${clientActionIcon("trash")}</button>
          <button class="email-client table-icon-button" data-id="${id}" aria-label="Enviar correo" title="Enviar correo">${clientActionIcon("mail")}</button>
        </td>
      </tr>
    `;
  }).join("");

  attachClientEvents();
  updateClientKPIs(sessionClients);
}

async function renderClients({ force = false, silent = false } = {}) {
  if (!clientsHydrated) {
    const cached = readClientsCache();
    if (cached) {
      clientsLastSyncedAt = Number(cached.syncedAt) || 0;
      paintClients(cached.clients);
    }
  }

  const hadCachedClients = clientsHydrated;
  const shouldShowLoader = !silent;
  if (shouldShowLoader) {
    window.showLoader?.("Cargando clientes...");
    if (hadCachedClients) {
      requestAnimationFrame(() => window.setTimeout(() => window.hideLoader?.(), 220));
    }
  }

  if (!force && clientsHydrated && Date.now() - clientsLastSyncedAt < 15000) {
    return sessionClients;
  }

  if (clientsRequest) {
    try {
      return await clientsRequest;
    } finally {
      if (shouldShowLoader && !hadCachedClients) window.hideLoader?.();
    }
  }

  clientsRequest = (async () => {
    try {
      const res = await fetch(API + "?action=list_clients");
      const data = await res.json();
      const clients = data.success && Array.isArray(data.data) ? data.data : [];

      clientsLastSyncedAt = Date.now();
      writeClientsCache(clients);
      paintClients(clients);
      return clients;
    } catch (err) {
      console.error("Error cargando clientes:", err);
      return sessionClients;
    } finally {
      clientsRequest = null;
      if (shouldShowLoader && !hadCachedClients) window.hideLoader?.();
    }
  })();

  return clientsRequest;
}

window.loadClients = renderClients;



/* =======================
   MODAL NUEVO CLIENTE
======================= */

const btnAddClient = document.getElementById("btnAddClient");
const clientModal = document.getElementById("clientModal");
const clientForm = document.getElementById("clientForm");

const clientName = document.getElementById("clientName");
const clientPhone = document.getElementById("clientPhone");
const clientEmail = document.getElementById("clientEmail");
const clientBirthday = document.getElementById("clientBirthday");
const clientId = document.getElementById("clientId");
const clientModalTitle = document.getElementById("clientModalTitle");
const clientModalClose = document.getElementById("clientModalClose");

/* ➕ ABRIR MODAL NUEVO CLIENTE */
btnAddClient.onclick = () => {
  clientModal.classList.remove("hidden");

  clientModalTitle.textContent = "Nuevo Cliente";

  clientForm.reset();
  clientId.value = ""; // 🔑 importante para que NO edite
};

/* ❌ CERRAR MODAL */
clientModalClose.onclick = () => {
  clientModal.classList.add("hidden");
};


/* =======================
   GUARDAR CLIENTE (CREATE / UPDATE)
======================= */

clientForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const payload = {
    nombre: clientName.value.trim(),
    telefono: clientPhone.value.trim(),
    correo: clientEmail.value.trim(),
    fechacumple: clientBirthday.value
  };

  // Validación mínima
  if (!payload.nombre) {
    return Swal.fire("Falta nombre", "El nombre es obligatorio", "warning");
  }

  let action = "create_client";

  // ✏️ EDITAR
  if (clientId.value) {
    payload.id = clientId.value;
    action = "update_client";
  }

  const previousClients = sessionClients.map(client => ({ ...client }));
  const isEditing = action === "update_client";
  const optimisticId = isEditing ? payload.id : `pending-client-${Date.now()}`;
  const previousClient = previousClients.find(client => String(client.id) === String(payload.id));
  const optimisticClient = {
    ...(previousClient || {}),
    ...payload,
    id: optimisticId,
    registrado: previousClient?.registrado || new Date().toISOString()
  };
  const optimisticClients = isEditing
    ? previousClients.map(client => String(client.id) === String(payload.id) ? optimisticClient : client)
    : [...previousClients, optimisticClient];

  writeClientsCache(optimisticClients);
  clientsLastSyncedAt = Date.now();
  paintClients(optimisticClients);
  clientModal.classList.add("hidden");
  clientForm.reset();
  clientId.value = "";
  window.showToast?.(isEditing ? "Cliente actualizado" : "Cliente registrado");

  try {
    await fetch(API, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        ...payload
      })
    });
    await renderClients({ force: true, silent: true });

  } catch (err) {
    console.error("Error guardando cliente:", err);
    writeClientsCache(previousClients);
    clientsLastSyncedAt = Date.now();
    paintClients(previousClients);
    window.showToast?.("No se pudo guardar el cliente; se restauró la información anterior");
  }
});


// =======================
// KPIs CLIENTES
// =======================
function updateClientKPIs(clients) {
  const totalClientes = document.getElementById("totalClientes");
  const nextBirthdayInfo = document.getElementById("nextBirthdayInfo");
  const birthdaysThisMonth = document.getElementById("birthdaysThisMonth");
  const emailNextBirthday = document.getElementById("emailNextBirthday");

  if (!clients.length) {
    if (totalClientes) totalClientes.textContent = 0;
    if (nextBirthdayInfo) nextBirthdayInfo.textContent = "—";
    if (birthdaysThisMonth) birthdaysThisMonth.textContent = 0;
    if (emailNextBirthday) emailNextBirthday.style.display = "none";
    return;
  }

  if (totalClientes) totalClientes.textContent = clients.length;

  const today = new Date();
  const upcoming = clients
    .filter(c => c.fechacumple)
    .map(c => {
      const b = new Date(c.fechacumple);
      const next = new Date(today.getFullYear(), b.getMonth(), b.getDate());
      if (next < today) next.setFullYear(today.getFullYear() + 1);
      return { ...c, nextBirthday: next };
    })
    .sort((a, b) => a.nextBirthday - b.nextBirthday);

  let index = 0;

  function renderBirthday(i) {
    const c = upcoming[i];
    if (!c || !nextBirthdayInfo || !emailNextBirthday) return;
    const diff = Math.ceil((c.nextBirthday - today) / 86400000);

    nextBirthdayInfo.innerHTML = `
      <div class="birthday-name">${escapeClientValue(c.nombre)}</div>
      <div class="birthday-date">${escapeClientValue(formatDateLong(c.fechacumple))}</div>
      <div class="birthday-days">En ${diff} días</div>
    `;

    emailNextBirthday.style.display = c.correo ? "inline-flex" : "none";
    emailNextBirthday.onclick = () => sendClientEmailForm(c);
  }

  if (!upcoming.length) {
    if (nextBirthdayInfo) nextBirthdayInfo.textContent = "Sin cumpleaños registrados";
    if (emailNextBirthday) emailNextBirthday.style.display = "none";
  } else {
    renderBirthday(index);
  }

  const previousBirthday = document.getElementById("prevBirthday");
  const nextBirthday = document.getElementById("nextBirthday");

  if (previousBirthday && upcoming.length) {
    previousBirthday.onclick = () => {
      index = (index - 1 + upcoming.length) % upcoming.length;
      renderBirthday(index);
    };
  }

  if (nextBirthday && upcoming.length) {
    nextBirthday.onclick = event => {
      if (event.target.closest("#emailNextBirthday")) return;
      index = (index + 1) % upcoming.length;
      renderBirthday(index);
    };
  }

  const month = today.getMonth();
  if (birthdaysThisMonth) {
    birthdaysThisMonth.textContent = clients.filter(c => {
      if (!c.fechacumple) return false;
      return new Date(c.fechacumple).getMonth() === month;
    }).length;
  }
}

// =======================
// EVENTOS CLIENTES
// =======================
function attachClientEvents() {

  // EDITAR
  document.querySelectorAll(".edit-client").forEach(btn => {
    btn.onclick = () => {
      const c = sessionClients.find(x => x.id === btn.dataset.id);
      if (!c) return;

      clientModal.classList.remove("hidden");
      clientName.value = c.nombre;
      clientPhone.value = c.telefono || "";
      clientEmail.value = c.correo || "";
      clientBirthday.value = c.fechacumple || "";
      clientId.value = c.id;
    };
  });

  // ELIMINAR
 document.querySelectorAll(".delete-client").forEach(btn => {
  btn.onclick = async () => {

    const result = await Swal.fire({
      title: "🗑️ Eliminar cliente",
      text: "Esta acción no se puede deshacer",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",

      background: "#0b0b0b",
      color: "#ffffff",

      customClass: {
        popup: "neo-glass",
        title: "neo-title",
        confirmButton: "neo-confirm danger",
        cancelButton: "neo-cancel"
      },

      buttonsStyling: false
    });

    if (!result.isConfirmed) return;

    const previousClients = sessionClients.map(client => ({ ...client }));
    const optimisticClients = previousClients.filter(client => String(client.id) !== String(btn.dataset.id));
    writeClientsCache(optimisticClients);
    clientsLastSyncedAt = Date.now();
    paintClients(optimisticClients);
    window.showToast?.("Cliente eliminado");

    try {
      await fetch(API, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_client",
          id: btn.dataset.id
        })
      });
      await renderClients({ force: true, silent: true });
    } catch (error) {
      console.error("Error eliminando cliente:", error);
      writeClientsCache(previousClients);
      clientsLastSyncedAt = Date.now();
      paintClients(previousClients);
      window.showToast?.("No se pudo eliminar el cliente; se restauró");
    }
  };
});


  // ENVIAR CORREO
  document.querySelectorAll(".email-client").forEach(btn => {
    btn.onclick = () => {
      const c = sessionClients.find(x => x.id === btn.dataset.id);
      if (!c || !c.correo) {
        return Swal.fire("Sin correo", "Este cliente no tiene correo", "warning");
      }

      Swal.fire({
        title: `¿Enviar correo a ${c.nombre}?`,
        confirmButtonText: "Enviar",
        showCancelButton: true,
        background: "#111",
        color: "#fff"
      }).then(r => r.isConfirmed && sendClientEmailForm(c));
    };
  });
}

window.eliminarTodosLosClientes = async function eliminarTodosLosClientes() {
  const clients = sessionClients.map(client => ({ ...client }));
  if (!clients.length) {
    await window.platformAlert?.("No hay clientes", "La lista de clientes ya está vacía.", "info");
    return;
  }

  const confirmed = await window.platformConfirm?.(
    "Eliminar todos los clientes",
    `Se eliminarán ${clients.length} clientes. Esta acción no se puede deshacer.`,
    "Limpiar clientes"
  );
  if (!confirmed) return;

  const button = document.getElementById("btnDeleteAllClients");
  button?.classList.add("is-syncing");
  if (button) button.disabled = true;

  writeClientsCache([]);
  clientsLastSyncedAt = Date.now();
  paintClients([]);
  window.showToast?.("Clientes eliminados. Sincronizando...");

  const failures = [];
  const runBatches = window.runRequestsInBatches || (async (items, worker) => Promise.all(items.map(worker)));

  try {
    await runBatches(clients, async client => {
      try {
        await fetch(API, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "delete_client", id: client.id })
        });
      } catch (error) {
        failures.push({ id: client.id, error });
      }
    });

    await renderClients({ force: true, silent: true });
    window.showToast?.(
      failures.length
        ? `No se pudieron eliminar ${failures.length} cliente(s)`
        : "Lista de clientes limpia"
    );
  } finally {
    button?.classList.remove("is-syncing");
    if (button) button.disabled = false;
  }
};

// =======================
// EMAILJS
// =======================
function sendClientEmailForm(cliente) {
  if (!cliente?.correo) return;

  const form = document.createElement("form");
  form.style.display = "none";

  const data = {
    to_name: cliente.nombre,
    to_email: cliente.correo,
    telefono: cliente.telefono || "No registrado",
    fecha: new Date().toLocaleDateString("es-CO"),
    year: new Date().getFullYear()
  };

  Object.keys(data).forEach(k => {
    const i = document.createElement("input");
    i.type = "hidden";
    i.name = k;
    i.value = data[k];
    form.appendChild(i);
  });

  document.body.appendChild(form);

  emailjs
    .sendForm("service_klqo261", "template_rt5dymj", form)
    .then(() =>
      Swal.fire({
        icon: "success",
        title: "Correo enviado",
        text: `Mensaje enviado a ${cliente.nombre}`,
        timer: 2500,
        showConfirmButton: false,
        background: "#111",
        color: "#fff"
      })
    )
    .catch(() =>
      Swal.fire("Error", "No se pudo enviar el correo", "error")
    )
    .finally(() => form.remove());
}

// =======================
// INICIALIZAR
// =======================
window.addEventListener("load", () => {
  const preloadClients = () => renderClients({ silent: true });
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(preloadClients, { timeout: 2500 });
  } else {
    window.setTimeout(preloadClients, 900);
  }
}, { once: true });




const ANALYSIS_PASSWORD = "9999"; // 🔒 CAMBIAR


/* ==================================================
   🔐 BLOQUEO PREMIUM — SOLO VISTA ANÁLISIS
================================================== */

document.addEventListener("DOMContentLoaded", () => {

  const ANALYSIS_PASSWORD = "believe2026"; // 🔒 CAMBIAR
  const analysisView = document.getElementById("view-analisis");

  let unlocked = false;

  function isAnalysisActive() {
    return analysisView.classList.contains("active");
  }

  function lockAnalysis() {
    unlocked = false;
    analysisView.classList.add("locked");
  }

  function unlockAnalysis() {
    unlocked = true;
    analysisView.classList.remove("locked");
  }

async function requestPassword() {
  const { value: password } = await Swal.fire({
    title: "🔒 Acceso restringido",
    html: `<p class="neo-subtitle">Autenticación requerida</p>`,
    input: "password",
    inputPlaceholder: "Contraseña de análisis",
    inputAttributes: {
      autocapitalize: "off",
      autocorrect: "off",
    },
    showCancelButton: true,
    confirmButtonText: "ACCEDER",
    cancelButtonText: "SALIR",
    allowOutsideClick: false,
    allowEscapeKey: false,

    customClass: {
      popup: "neo-glass",
      title: "neo-title",
      input: "neo-input",
      confirmButton: "neo-confirm",
      cancelButton: "neo-cancel",
      backdrop: "neo-backdrop"
    },

    backdrop: true
  });

  if (password === ANALYSIS_PASSWORD) {
    unlockAnalysis();

    Swal.fire({
      icon: "success",
      title: "Acceso concedido",
      timer: 1200,
      showConfirmButton: false,
      customClass: {
        popup: "neo-glass-success"
      }
    });

  } else {
    lockAnalysis();
    exitAnalysis();
  }
}


  function exitAnalysis() {
    document
      .querySelector('[data-view="inventario"]')
      ?.click();
  }

  function checkAnalysisAccess() {
    if (isAnalysisActive()) {
      if (!unlocked) {
        lockAnalysis();
        requestPassword();
      }
    }
  }

  // 👀 Detectar cuando se activa Análisis
  const observer = new MutationObserver(checkAnalysisAccess);
  observer.observe(analysisView, {
    attributes: true,
    attributeFilter: ["class"]
  });

  // 🔁 Al cambiar de vista, se vuelve a bloquear
  document.querySelectorAll(".nav-menu a").forEach(link => {
    link.addEventListener("click", () => {
      if (!isAnalysisActive()) {
        lockAnalysis();
      }
    });
  });

  // 🚀 Caso recarga estando en análisis
  if (isAnalysisActive()) {
    lockAnalysis();
    requestPassword();
  }

});




/* ==================================================
   // SECCION PARA DESCARGAR INFORMES EN EXCEL O PDF 
================================================== */
(function initReportFilters() {
  const monthSelect = document.getElementById("reportMonth");
  const yearSelect = document.getElementById("reportYear");
  if (!monthSelect || !yearSelect) return;

  const meses = [
    "Enero","Febrero","Marzo","Abril","Mayo","Junio",
    "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"
  ];

  meses.forEach((m, i) => {
    monthSelect.innerHTML += `<option value="${i}">${m}</option>`;
  });

  const year = new Date().getFullYear();
  for (let y = year; y >= year - 5; y--) {
    yearSelect.innerHTML += `<option value="${y}">${y}</option>`;
  }
})();


/* ==================================================
   // DESCARGAR INFORMES EN EXCEL O PDF
================================================== */

async function downloadReport(format) {
  const sheet = document.getElementById("reportSheet").value;
  const month = document.getElementById("reportMonth").value;
  const year = document.getElementById("reportYear").value;

  // ✅ EXCEL → igual que ahora
  if (format === "excel") {
    const res = await fetch(API, {
      method: "POST",
      body: new URLSearchParams({
        action: "export_report",
        sheetType: sheet,
        format,
        month,
        year
      })
    });

    const data = await res.json();

    if (data.success && data.url) {
      window.open(data.url, "_blank");
    } else {
      await window.platformAlert?.(
        "No se pudo generar el reporte",
        data.message || "Intenta nuevamente.",
        "error"
      );
    }

    return;
  }

  // ✅ PDF → HTML REAL
  if (format === "pdf") {
    const tableHtml = getTableHtml(sheet);

    if (!tableHtml) {
      await window.platformAlert?.(
        "No se pudo crear el PDF",
        "No fue posible obtener la tabla del reporte.",
        "error"
      );
      return;
    }

    const res = await fetch(API, {
      method: "POST",
      body: new URLSearchParams({
        action: "export_report",
        format: "pdf",
        sheetType: sheet,
        month,
        year,
        html: tableHtml
      })
    });

    const data = await res.json();

    if (data.success && data.url) {
      window.open(data.url, "_blank");
    } else {
      await window.platformAlert?.(
        "No se pudo generar el PDF",
        data.message || "Intenta nuevamente.",
        "error"
      );
    }
  }
}



function exportPdfFromHtml(data) {
  const htmlTable = data.html;
  const sheetType = data.sheetType;

  if (!htmlTable) {
    return json({ success:false, message:"HTML vacío" });
  }

  const template = HtmlService.createTemplateFromFile("pdf_template");

  template.table = htmlTable;
  template.title =
    sheetType === "ventas"
      ? "Reporte de Ventas"
      : "Reporte de Inventario";

  const htmlOutput = template.evaluate()
    .setSandboxMode(HtmlService.SandboxMode.IFRAME);

  const pdfBlob = htmlOutput
    .getAs("application/pdf")
    .setName(`Reporte_${sheetType}.pdf`);

  const file = DriveApp.createFile(pdfBlob);

  return json({
    success: true,
    url: file.getUrl()
  });
}



/* ==================================================
   // DESCARGAR INFORMES EN EXCEL O PDF
================================================== */

function getTableHtml(sheetType) {
  if (sheetType === "inventario") {
    return document.querySelector("#inventoryTable")?.outerHTML || "";
  }

  if (sheetType === "ventas") {
    return document.querySelector("#salesTable")?.outerHTML || "";
  }

  return "";
}













