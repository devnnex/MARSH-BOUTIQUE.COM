const API_URL = "https://script.google.com/macros/s/AKfycbzi8L_mvDiOIQmicjbzPGWLFoKVL54snEi0T7Ng6bq_yPI_S85JvckhLde6SZEk12NLZw/exec";



const tbody = document.getElementById("tbody");
const modal = document.getElementById("modal");
const form = document.getElementById("form");

function parseCOPValue(value) {
  return Number(String(value ?? "").replace(/[^\d]/g, "")) || 0;
}

function formatProductCostInput(input) {
  const value = parseCOPValue(input.value);
  input.value = value ? `$ ${value.toLocaleString("es-CO")}` : "";
}

function formatCOPInputValue(value) {
  return `$ ${parseCOPValue(value).toLocaleString("es-CO")}`;
}

const productCostInput = form?.elements?.costo;
productCostInput?.addEventListener("input", () => formatProductCostInput(productCostInput));

function actionIcon(name) {
  const paths = {
    trash: '<path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="m19 6-1 14H6L5 6"></path><path d="M10 11v5M14 11v5"></path>',
    pencil: '<path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"></path><path d="m15 5 4 4"></path>'
  };
  return `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || ""}</svg>`;
}

const editModal = document.getElementById("editModal");
const editForm = document.getElementById("editForm");
const btnEditCancelar = document.getElementById("btnEditCancelar");

const btnDeleteSelected = document.getElementById("btnDeleteInventorySelected");
const selectAllInventory = document.getElementById("selectAllInventory");

btnDeleteSelected.addEventListener("click", eliminarSeleccionadosInventario);




/* ======================
    NAVEGACIÓN ENTRE VISTAS
====================== */

const views = {
  inventario: document.getElementById("view-inventario"),
  ventas: document.getElementById("view-ventas"),
  analisis: document.getElementById("view-analisis"),
  clientes: document.getElementById("view-clientes") // 🔹 AÑADIDO
};


document.querySelectorAll(".nav-menu a").forEach(link => {
  link.onclick = () => {
    document.querySelectorAll(".nav-menu a")
      .forEach(a => a.classList.remove("active"));

    link.classList.add("active");

    Object.values(views).forEach(v => v.classList.remove("active"));
    const view = link.dataset.view;
    views[view].classList.add("active");

    if (view === "ventas") {
         cargarVentas();
    }

    if (view === "inventario") {
      cargarInventario({ silent: true });
    }

    if (view === "clientes") {
      window.loadClients?.();
    }

    if (view === "analisis") {
        if (!window.__analysisInit) {
            window.__analysisInit = true;
            ANALYSIS.init();
  }
}

  };
});



function getNombreProductoFromRow(row) {
  const nameContainer = row.children[1].querySelector(".product-name");
  if (!nameContainer) return "";

  return nameContainer.childNodes[0].textContent.trim();
}



/* ======================
    KPI MODO PARA MOSTRAR EN VENTAS Y CAMBIAR CON EL BOTON PARA MOSTRAR EL DESCUENTO O LAS VENTAS
====================== */

let kpiModo = "ventas"; // "ventas" | "descuentos"
let kpiAnimating = false;

//  estado básico de editar prenda en el moda, este es independiente
let editBasicState = {
  id: null,
  product: null // 👈 producto completo
};

/* ======================
    ESTADO EDICIÓN PRODUCTO
====================== */
let editState = {
  mode: "create", // "create" | "edit"
  id: null,
  precioVenta: 0,
  margenOriginal: 0
};


/* ======================
   ESTADO DE CANTIDADES
====================== */
const qtyState = {};
const stockState = {};

/* ======================
   ESTADO CARRITO (MULTI)
====================== */
let sellCartState = {
  items: [], // [{ id, nombre, marca, precio, qty }]
  pending: false
};


/* ======================
   MODAL
====================== */
btnNuevo.onclick = () => {
  editState = { mode: "create", id: null };
  form.reset();
  modal.classList.remove("hidden");
};

btnCancelar.onclick = () => modal.classList.add("hidden");


/* ===============================
   GLOBAL LOADER CONTROL
================================ */
const loader = document.getElementById("globalLoader");

function showLoader(text = "Cargando información...") {
  const loader = document.getElementById("globalLoader");
  if (!loader) return;

  loader.querySelector("span").textContent = text;
  loader.classList.remove("hidden");
}

function hideLoader() {
  const loader = document.getElementById("globalLoader");
  if (!loader) return;

  loader.classList.add("hidden");
}




/* =====================
   TOAST SYSTEM (GLOBAL)
===================== */
(function injectToastStyles() {
  if (document.getElementById("toast-styles")) return;

  const style = document.createElement("style");
  style.id = "toast-styles";
  style.innerHTML = `
    .toast {
      position: fixed;
      bottom: max(24px, env(safe-area-inset-bottom));
      left: 50%;
      max-width: min(92vw, 520px);
      transform: translateX(-50%) translateY(18px) scale(.98);
      background: linear-gradient(145deg, rgba(31,39,58,.98), rgba(12,16,27,.98));
      color: #fff;
      padding: 14px 20px;
      border: 1px solid rgba(108,180,255,.25);
      border-radius: 14px;
      font-weight: 650;
      font-size: 14px;
      line-height: 1.4;
      text-align: center;
      box-shadow: 0 20px 55px rgba(0,0,0,.46), 0 0 0 1px rgba(255,255,255,.025) inset;
      opacity: 0;
      transition: opacity .24s ease, transform .32s cubic-bezier(.22,1,.36,1);
      z-index: 9999;
      backdrop-filter: blur(18px) saturate(130%);
    }

    .toast.show {
      opacity: 1;
      transform: translateX(-50%) translateY(0) scale(1);
    }
  `;
  document.head.appendChild(style);
})();

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;

  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("show"));

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

window.platformAlert = async function platformAlert(title, text = "", icon = "info") {
  if (!window.Swal) {
    showToast(text || title);
    return;
  }

  await window.Swal.fire({
    title,
    text,
    icon,
    width: "min(430px, calc(100vw - 32px))",
    heightAuto: false,
    confirmButtonText: "Aceptar",
    buttonsStyling: false,
    customClass: {
      popup: "neo-glass platform-dialog",
      icon: "platform-dialog-icon",
      title: "neo-title platform-dialog-title",
      htmlContainer: "platform-dialog-copy",
      actions: "platform-dialog-actions",
      confirmButton: "neo-confirm platform-dialog-primary"
    }
  });
};

window.platformConfirm = async function platformConfirm(title, text = "", confirmText = "Confirmar") {
  if (!window.Swal) {
    showToast(`${title}. ${text}`.trim());
    return false;
  }

  const result = await window.Swal.fire({
    title,
    text,
    icon: "warning",
    width: "min(430px, calc(100vw - 32px))",
    heightAuto: false,
    allowOutsideClick: false,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: "Cancelar",
    reverseButtons: true,
    focusCancel: true,
    buttonsStyling: false,
    customClass: {
      popup: "neo-glass platform-dialog",
      icon: "platform-dialog-icon platform-dialog-icon-warning",
      title: "neo-title platform-dialog-title",
      htmlContainer: "platform-dialog-copy",
      actions: "platform-dialog-actions",
      confirmButton: "neo-confirm danger platform-dialog-danger",
      cancelButton: "neo-cancel platform-dialog-cancel"
    }
  });

  return result.isConfirmed;
};

async function runRequestsInBatches(items, worker, concurrency = 4) {
  const queue = [...items];
  const runners = Array.from(
    { length: Math.min(concurrency, queue.length) },
    async () => {
      while (queue.length) {
        const item = queue.shift();
        await worker(item);
      }
    }
  );
  await Promise.all(runners);
}

window.runRequestsInBatches = runRequestsInBatches;




/* ======================
  ESTADO VISUAL DE ACTUALIZACIÓN (MÁXIMO 1 HORA)
====================== */
const PRODUCT_UPDATE_WINDOW_MS = 60 * 60 * 1000;
const PRODUCT_UPDATE_TIMES_KEY = "marsh_product_update_times_v1";
let productUpdateTimes = (() => {
  try {
    const parsed = JSON.parse(localStorage.getItem(PRODUCT_UPDATE_TIMES_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
})();

function persistProductUpdateTimes() {
  const now = Date.now();
  Object.keys(productUpdateTimes).forEach(id => {
    if (now - Number(productUpdateTimes[id]) >= PRODUCT_UPDATE_WINDOW_MS) {
      delete productUpdateTimes[id];
    }
  });
  try {
    localStorage.setItem(PRODUCT_UPDATE_TIMES_KEY, JSON.stringify(productUpdateTimes));
  } catch {
    // El indicador es auxiliar; el inventario continúa funcionando sin storage.
  }
}

function markProductUpdated(id, timestamp = Date.now()) {
  if (id === undefined || id === null) return;
  productUpdateTimes[String(id)] = Number(timestamp);
  persistProductUpdateTimes();
}

function clearProductUpdated(id) {
  delete productUpdateTimes[String(id)];
  persistProductUpdateTimes();
}

function getProductUpdatedAt(product) {
  const backendTimestamp = new Date(product?.fecha).getTime();
  const localTimestamp = Number(productUpdateTimes[String(product?.id)]) || 0;
  return Math.max(Number.isFinite(backendTimestamp) ? backendTimestamp : 0, localTimestamp);
}

function isProductoActualizadoReciente(fechaProducto) {
  if (!fechaProducto) return false;

  const fecha = new Date(fechaProducto);
  if (isNaN(fecha.getTime())) return false;

  const elapsed = Date.now() - fecha.getTime();
  return elapsed >= 0 && elapsed < PRODUCT_UPDATE_WINDOW_MS;
}


/* ======================
    TIEMPO DESDE FECHA PARA CALCULAR LAS HORAS DESDE QUE SE AGREGÓ EL PRODUCTO
====================== */
function tiempoActualizacion(fecha) {
  const diff = Math.max(0, Date.now() - new Date(fecha).getTime());
  const minutos = Math.floor(diff / 60000);
  if (minutos < 1) return "Actualizado ahora";
  return `Actualizado hace ${minutos} min`;
}

function refreshInventoryUpdateBadges() {
  document.querySelectorAll('#inventoryTable tbody tr[data-updated-at]').forEach(row => {
    const updatedAt = Number(row.dataset.updatedAt);
    const badge = row.querySelector('.product-new-time');
    if (!updatedAt || Date.now() - updatedAt >= PRODUCT_UPDATE_WINDOW_MS) {
      badge?.remove();
      row.classList.remove('row-new');
      row.removeAttribute('title');
      row.removeAttribute('data-updated-at');
      clearProductUpdated(row.dataset.id);
      return;
    }

    const label = tiempoActualizacion(updatedAt);
    if (badge) badge.textContent = label;
    row.title = label;
  });
}

window.setInterval(refreshInventoryUpdateBadges, 60000);



/* ======================
   CARGAR INVENTARIO
====================== */
const INVENTORY_CACHE_KEY = "marsh_inventory_cache_v2";
let inventoryRequest = null;
let inventoryInitialLoadComplete = false;
const pendingProductCreates = new Map();
const resolvedPendingProductIds = new Map();
const pendingProductVisibility = new Map();
const inventoryUiOverrides = new Map();

function readInventoryCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(INVENTORY_CACHE_KEY) || "null");
    if (Array.isArray(cached)) return cached;
    return Array.isArray(cached?.items) ? cached.items : [];
  } catch {
    return [];
  }
}

function writeInventoryCache(data) {
  try {
    localStorage.setItem(INVENTORY_CACHE_KEY, JSON.stringify({
      items: data,
      syncedAt: Date.now()
    }));
  } catch (error) {
    console.warn("No fue posible guardar la caché de inventario", error);
  }
}

function normalizeInventoryText(value) {
  return String(value ?? "").trim().toLocaleLowerCase("es");
}

function productMatchesPendingCreate(product, pending) {
  return (
    normalizeInventoryText(product?.nombre) === normalizeInventoryText(pending.product?.nombre) &&
    normalizeInventoryText(product?.marca) === normalizeInventoryText(pending.product?.marca) &&
    normalizeInventoryText(product?.categoria) === normalizeInventoryText(pending.product?.categoria) &&
    parseCOPValue(product?.precio) === parseCOPValue(pending.product?.precio) &&
    parseCOPValue(product?.costo) === parseCOPValue(pending.product?.costo)
  );
}

function transferPendingProductState(temporaryId, realId) {
  const temporaryKey = String(temporaryId);
  const realKey = String(realId);
  const selectedQuantity = Number(qtyState[temporaryKey]) || 0;

  if (selectedQuantity > 0) {
    qtyState[realKey] = Math.max(Number(qtyState[realKey]) || 0, selectedQuantity);
  }
  delete qtyState[temporaryKey];
  delete stockState[temporaryKey];

  sellCartState.items = sellCartState.items.map(item =>
    String(item.id) === temporaryKey ? { ...item, id: realId } : item
  );
  if (String(sellState?.id) === temporaryKey) sellState.id = realId;

  resolvedPendingProductIds.set(temporaryKey, realId);
  pendingProductCreates.delete(temporaryKey);
}

function extractCreatedProductId(payload) {
  const candidates = [
    payload?.id,
    payload?.productId,
    payload?.productoId,
    payload?.data?.id,
    payload?.product?.id
  ];
  return candidates.find(value => value !== undefined && value !== null && value !== "");
}

function promotePendingProductLocally(temporaryId, realId) {
  const currentInventory = (window.inventario || []).map(product => ({ ...product }));
  const pendingProduct = currentInventory.find(product => String(product.id) === String(temporaryId));
  if (!pendingProduct) return;

  transferPendingProductState(temporaryId, realId);
  const promotedInventory = currentInventory.map(product =>
    String(product.id) === String(temporaryId)
      ? { ...product, id: realId, __pendingCreate: false }
      : product
  );
  const promotedProduct = promotedInventory.find(product => String(product.id) === String(realId));
  if (promotedProduct) pendingProductVisibility.set(String(realId), promotedProduct);
  writeInventoryCache(promotedInventory);
  renderInventory(promotedInventory);
  scheduleVisibleProductSync(realId);
}

function reconcilePendingProductCreates(serverData) {
  const reconciled = serverData.map(product => ({ ...product }));

  pendingProductCreates.forEach((pending, temporaryId) => {
    const match = reconciled.find(product =>
      !pending.baselineIds.has(String(product.id)) &&
      productMatchesPendingCreate(product, pending)
    );

    if (match) {
      transferPendingProductState(temporaryId, match.id);
      return;
    }

    const localPending = (window.inventario || []).find(product =>
      String(product.id) === String(temporaryId)
    );
    if (localPending && !reconciled.some(product => String(product.id) === String(temporaryId))) {
      reconciled.push({ ...localPending });
    }
  });

  pendingProductVisibility.forEach((localProduct, realId) => {
    if (reconciled.some(product => String(product.id) === String(realId))) {
      pendingProductVisibility.delete(String(realId));
      return;
    }
    reconciled.push({ ...localProduct });
  });

  return reconciled;
}

function holdInventoryUiState(product, duration = 12000) {
  if (!product?.id) return;
  inventoryUiOverrides.set(String(product.id), {
    id: product.id,
    nombre: product.nombre,
    marca: product.marca,
    stock: Number(product.stock) || 0,
    vendidos: Number(product.vendidos) || 0,
    expiresAt: Date.now() + duration
  });
}

function clearInventoryUiStateForSales(sales) {
  sales.forEach(sale => {
    const override = [...inventoryUiOverrides.values()].find(item =>
      normalizeInventoryText(item.nombre) === normalizeInventoryText(sale.producto) &&
      normalizeInventoryText(item.marca) === normalizeInventoryText(sale.marca)
    );
    if (override) inventoryUiOverrides.delete(String(override.id));
  });
}

function applyInventoryUiOverrides(serverData) {
  const now = Date.now();
  return serverData.map(product => {
    const override = inventoryUiOverrides.get(String(product.id)) ||
      [...inventoryUiOverrides.values()].find(item =>
        normalizeInventoryText(item.nombre) === normalizeInventoryText(product.nombre) &&
        normalizeInventoryText(item.marca) === normalizeInventoryText(product.marca)
      );

    if (!override) return product;
    if (override.expiresAt <= now) {
      inventoryUiOverrides.delete(String(override.id));
      return product;
    }

    const backendStock = Number(product.stock) || 0;
    const backendSold = Number(product.vendidos) || 0;
    if (backendStock === override.stock && backendSold === override.vendidos) {
      inventoryUiOverrides.delete(String(override.id));
      return product;
    }

    return {
      ...product,
      stock: override.stock,
      cantidad: override.stock,
      vendidos: override.vendidos
    };
  });
}

function schedulePendingProductSync(temporaryId, attempt = 0) {
  if (!pendingProductCreates.has(String(temporaryId)) || attempt >= 10) return;
  window.setTimeout(async () => {
    await cargarInventario({ silent: true });
    if (pendingProductCreates.has(String(temporaryId))) {
      schedulePendingProductSync(temporaryId, attempt + 1);
    }
  }, Math.min(350 + attempt * 150, 1200));
}

function scheduleVisibleProductSync(realId, attempt = 0) {
  if (!pendingProductVisibility.has(String(realId)) || attempt >= 10) return;
  window.setTimeout(async () => {
    await cargarInventario({ silent: true });
    if (pendingProductVisibility.has(String(realId))) {
      scheduleVisibleProductSync(realId, attempt + 1);
    }
  }, Math.min(350 + attempt * 150, 1200));
}

async function resolveProductIdForSale(id) {
  const key = String(id);
  if (!key.startsWith("pending-")) return id;

  const startedAt = Date.now();
  while (Date.now() - startedAt < 10000) {
    const resolvedId = resolvedPendingProductIds.get(key);
    if (resolvedId !== undefined && resolvedId !== null) return resolvedId;
    if (!pendingProductCreates.has(key)) {
      throw new Error("No fue posible terminar de registrar el producto");
    }
    await cargarInventario({ silent: true });
    await new Promise(resolve => window.setTimeout(resolve, 180));
  }

  throw new Error("El producto todavía se está sincronizando");
}

function renderInventory(data) {
    const items = [...data];

    const liveIds = new Set(items.map(product => String(product.id)));
    Object.keys(qtyState).forEach(id => {
      if (!liveIds.has(String(id))) delete qtyState[id];
    });
    Object.keys(stockState).forEach(id => {
      if (!liveIds.has(String(id))) delete stockState[id];
    });

    // 👇 GUARDAMOS INVENTARIO GLOBAL
    window.inventario = items;

    // 🔠 ORDENAR INVENTARIO ALFABÉTICAMENTE POR NOMBRE (A–Z)
    items.sort((a, b) => {
      const nombreA = (a.nombre || "").toLowerCase().trim();
      const nombreB = (b.nombre || "").toLowerCase().trim();
      return nombreA.localeCompare(nombreB, "es");
    });

    tbody.innerHTML = items.map(p => {

      // 🔒 Normalización local (anti-NaN)
      const precio = Number(
        String(p.precio ?? 0).replace(/[^\d.-]/g, "")
      ) || 0;

      const costo = Number(
        String(p.costo ?? 0).replace(/[^\d.-]/g, "")
      ) || 0;

      const stock = Number(p.stock) || 0;

      qtyState[p.id] = Math.min(Number(qtyState[p.id]) || 0, stock);
      stockState[p.id] = stock;

      const productUpdatedAt = getProductUpdatedAt(p);
      const actualizadoReciente = isProductoActualizadoReciente(productUpdatedAt);
      const tiempoActualizado = actualizadoReciente ? tiempoActualizacion(productUpdatedAt) : "";
      const updatedAt = actualizadoReciente ? productUpdatedAt : "";

      return `
        <tr
          data-id="${p.id}"
          class="${actualizadoReciente ? "row-new" : ""}"
          ${actualizadoReciente ? `data-updated-at="${updatedAt}" title="${tiempoActualizado}"` : ""}>

          <td><input type="checkbox" class="row-check"></td>

          <td>
            <div class="product-name">
              ${p.nombre}
              ${actualizadoReciente ? `<div class="product-new-time">${tiempoActualizado}</div>` : ""}
            </div>
          </td>

          <td>${p.marca}</td>

          <td>$ ${precio.toLocaleString("es-CO")}</td>

          <!-- oculto pero seguro -->
          <td style="display:none;">
            $ ${costo.toLocaleString("es-CO")}
          </td>
          <td style="display:none;">${p.categoria}</td>
          <td style="display:none;">${p.subcategoria}</td>
          <!-- fin de ocultos -->

          <td class="stock-cell" id="stock-${p.id}">
            ${
              stock > 0
                ? stock
                : '<span class="stock-out">Agotado</span>'
            }
          </td>

          <td class="sold-cell" id="sold-${p.id}" style="color:#00ff88">${Number(p.vendidos) || 0}</td>

          <td class="actions">
            <div class="qty">
              <button data-id="${p.id}" onclick="cambiarQty('${p.id}', -1)">-</button>
              <span id="qty-${p.id}">0</span>
              <button data-id="${p.id}" onclick="cambiarQty('${p.id}', 1)">+</button>
            </div>

            <button class="inventory-edit" onclick="editarProducto('${p.id}')">${actionIcon("pencil")}<span>Editar</span></button>
            <button class="inventory-delete" onclick="eliminarProducto('${p.id}')">${actionIcon("trash")}<span>Eliminar</span></button>
          </td>
        </tr>
      `;
    }).join("");

    items.forEach(p => updateStockUI(p.id));
    refreshInventoryUpdateBadges();
    actualizarTotalGlobalVenta();

    updateSellCartBadge();

  // ======================
// CHECKBOX INVENTARIO
// ======================
const rowChecks = document.querySelectorAll(".row-check");

rowChecks.forEach(check => {
  check.addEventListener("change", updateDeleteSelectedUI);
});

// reset UI
if (selectAllInventory) selectAllInventory.checked = false;
updateDeleteSelectedUI();

  // ======================
//  FILTRO DE INVENTARIO
// ======================
    if (inventoryFilter) aplicarFiltroInventario();
}

async function cargarInventario({ silent = false } = {}) {
  const cached = Array.isArray(window.inventario) && window.inventario.length
    ? window.inventario
    : readInventoryCache();
  const shouldShowLoader = !silent && !inventoryInitialLoadComplete;

  // Muestra la última información de inmediato mientras se sincroniza en segundo plano.
  if (cached.length && !tbody.children.length) renderInventory(cached);

  if (shouldShowLoader) {
    showLoader("Cargando inventario...");
    if (cached.length) {
      requestAnimationFrame(() => {
        window.setTimeout(hideLoader, 220);
      });
    }
  }
  if (inventoryRequest) return inventoryRequest;

  inventoryRequest = (async () => {
    try {
      const res = await fetch(`${API_URL}?action=list`);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("Respuesta de inventario inválida");

      const reconciledData = applyInventoryUiOverrides(
        reconcilePendingProductCreates(data)
      );
      writeInventoryCache(reconciledData);
      renderInventory(reconciledData);
      return reconciledData;
    } catch (err) {
      console.error(err);
      if (!cached.length) showToast("Error cargando inventario");
      return cached;
    } finally {
      inventoryInitialLoadComplete = true;
      inventoryRequest = null;
      if (shouldShowLoader) hideLoader();
    }
  })();

  return inventoryRequest;

}

// PRUEBA DE FILTRO DE INVENTARIO
const inventoryFilter = document.getElementById("inventoryFilter");

if (inventoryFilter) {
  inventoryFilter.addEventListener("change", aplicarFiltroInventario);
}

cargarInventario();

// PRUEBA DE FILTRO DE INVENTARIO
function aplicarFiltroInventario() {
  const value = inventoryFilter.value;
  const rows = tbody.querySelectorAll("tr");

  rows.forEach(row => {
    const id = row.dataset.id;
    const stock = stockState[id] ?? 0;
    const esNuevo = row.classList.contains("row-new");

    let mostrar = true;

    switch (value) {
      case "new":
        mostrar = esNuevo;
        break;

      case "out":
        mostrar = stock <= 0;
        break;

      case "all":
      default:
        mostrar = true;
    }

    row.style.display = mostrar ? "" : "none";
  });
}


// FUNCIONALIDAD SELECT ALL INVENTORY
if (selectAllInventory) {
  selectAllInventory.addEventListener("change", e => {
    const checked = e.target.checked;
    document.querySelectorAll(".row-check").forEach(c => {
      c.checked = checked;
    });
    updateDeleteSelectedUI();
  });
}




// 🔍 BUSCADOR DE INVENTARIO
function filtrarInventario(texto) {
  const query = texto.toLowerCase().trim();
  const rows = tbody.querySelectorAll("tr");

  rows.forEach(row => {
    const nombre = row.children[1]?.textContent.toLowerCase() || "";
    const marca = row.children[2]?.textContent.toLowerCase() || "";

    // columnas ocultas pero existentes
    const categoria = row.children[5]?.textContent.toLowerCase() || "";
    const subcategoria = row.children[6]?.textContent.toLowerCase() || "";

    const match =
      nombre.includes(query) ||
      marca.includes(query) ||
      categoria.includes(query) ||
      subcategoria.includes(query);

    row.style.display = match ? "" : "none";
  });
}

// 🔌 EVENTO DEL INPUT .search
const searchInput = document.querySelector(".search");

if (searchInput) {
  searchInput.addEventListener("input", e => {
    filtrarInventario(e.target.value);
  });
}

// ACTUALIZAR BOTÓN ELIMINAR SELECCIONADOS
function updateDeleteSelectedUI() {
  const checks = document.querySelectorAll(".row-check");
  const selected = Array.from(checks).filter(c => c.checked);

  const count = selected.length;

  btnDeleteSelected.textContent = `Eliminar seleccionados (${count})`;
  btnDeleteSelected.disabled = count === 0;
}



// ELIMINAR PRODUCTOS SELECCIONADOS
async function eliminarSeleccionadosInventario() {
  const rows = document.querySelectorAll("tbody tr");
  const ids = [];

  rows.forEach(row => {
    const check = row.querySelector(".row-check");
    if (check && check.checked) {
      ids.push(row.dataset.id);
    }
  });

  if (!ids.length) {
    await Swal.fire({
      icon: "info",
      title: "Sin selección",
      text: "No has seleccionado ningún producto",
      confirmButtonText: "Aceptar"
    });
    return;
  }

  const { isConfirmed } = await Swal.fire({
    title: "Eliminar productos",
    text: `¿Seguro que deseas eliminar ${ids.length} producto(s)? Esta acción no se puede deshacer.`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Eliminar",
    cancelButtonText: "Cancelar"
  });

  if (!isConfirmed) return;

  const previousInventory = (window.inventario || []).map(product => ({ ...product }));
  const previousUpdateTimes = { ...productUpdateTimes };
  const selectedIds = new Set(ids.map(String));
  const optimisticInventory = previousInventory.filter(product => !selectedIds.has(String(product.id)));
  ids.forEach(clearProductUpdated);
  writeInventoryCache(optimisticInventory);
  renderInventory(optimisticInventory);
  showToast(`${ids.length} producto(s) eliminados`);

  try {
    await runRequestsInBatches(ids, async id => {
      const response = await fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({
          action: "delete",
          id
        })
      });
      if (!response.ok) throw new Error(`No se pudo eliminar el producto ${id}`);
    });

    await cargarInventario({ silent: true });
  } catch (err) {
    console.error(err);
    productUpdateTimes = previousUpdateTimes;
    persistProductUpdateTimes();
    writeInventoryCache(previousInventory);
    renderInventory(previousInventory);
    showToast("No se pudieron eliminar todos los productos");
  }
}







/* ======================
    ACTUALIZAR UI STOCK CON COLORES Y BLOQUEO DE BOTONES 
====================== */
function updateStockUI(id) {
  const stock = stockState[id];
  const row = document.querySelector(`tr[data-id="${id}"]`);
  if (!row) return;

  const stockCell = document.getElementById(`stock-${id}`);
  const buttons = row.querySelectorAll('.qty button');
  const qtyLabel = document.getElementById(`qty-${id}`);

  if (qtyLabel) {
    qtyLabel.textContent = String(qtyState[id] || 0);
    qtyLabel.classList.toggle("qty-active", (qtyState[id] || 0) > 0);
  }

  if (stock <= 0) {
    // texto
    if (stockCell) {
      stockCell.innerHTML = `<span class="stock-out">Agotado</span>`;
    }

    // bloquear botones
    buttons.forEach(b => b.disabled = true);

    // reset qty por seguridad
    qtyState[id] = 0;
    if (qtyLabel) {
      qtyLabel.textContent = "0";
      qtyLabel.classList.remove("qty-active");
    }

  } else {
    // texto normal
    if (stockCell) {
      stockCell.textContent = stock;
    }

    // desbloquear botones
    buttons.forEach(b => b.disabled = false);
  }
}



/* ======================
    CARGAR VENTAS
====================== */
//parsea la fecha y hora en formato español a timestamp para que cargarventas ordene bien
// ==============================
// PARSE FECHA + HORA ESPAÑOL
// ==============================
function parseFechaHoraES(fecha, hora) {
  if (!fecha || !hora) return 0;

  const meses = {
    enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
    julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11
  };

  // "Lunes 5 enero 2025"
  const f = fecha.split(" ");
  const day = Number(f[1]);
  const month = meses[f[2]];
  const year = Number(f[3]);

  // "3:45 PM"
  let [time, ampm] = hora.split(" ");
  let [h, m] = time.split(":").map(Number);

  if (ampm === "PM" && h !== 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;

  return new Date(year, month, day, h, m, 0, 0).getTime();
}

// ==============================
// CARGAR VENTAS
// ==============================
const salesTbody = document.getElementById("salesTbody");

// Selects
const filterFecha = document.getElementById("filterFecha");
const filterProducto = document.getElementById("filterProducto");
const filterMarca = document.getElementById("filterMarca");
const filterMetodo1 = document.getElementById("filterMetodo1");
const filterMetodo2 = document.getElementById("filterMetodo2");

let salesData = []; // datos originales
let salesLoadedAt = 0;
let salesRequest = null;
let salesRevision = 0;
let salesRequestRevision = 0;
const SALES_CACHE_MS = 30000;

function restoreSalesInInventoryLocally(sales) {
  const previousInventory = (window.inventario || []).map(product => ({ ...product }));
  const restoredInventory = previousInventory.map(product => ({ ...product }));

  sales.forEach(sale => {
    const product = restoredInventory.find(item =>
      String(item.nombre || "").trim().toLocaleLowerCase("es") === String(sale.producto || "").trim().toLocaleLowerCase("es") &&
      String(item.marca || "").trim().toLocaleLowerCase("es") === String(sale.marca || "").trim().toLocaleLowerCase("es")
    );
    if (!product) return;

    const quantity = Math.max(0, Number(sale.cantidad) || 0);
    product.stock = (Number(product.stock) || 0) + quantity;
    product.cantidad = product.stock;
    product.vendidos = Math.max(0, (Number(product.vendidos) || 0) - quantity);
    holdInventoryUiState(product);
  });

  writeInventoryCache(restoredInventory);
  renderInventory(restoredInventory);
  return previousInventory;
}

function invalidateSalesCache() {
  salesLoadedAt = 0;
  salesRevision += 1;
}

async function cargarVentas({ force = false, silent = false } = {}) {
  const hasCachedSales = salesData.length > 0;
  const cacheIsFresh = hasCachedSales && (Date.now() - salesLoadedAt < SALES_CACHE_MS);
  const shouldShowLoader = !silent;

  if (shouldShowLoader) {
    showLoader("Cargando ventas...");
  }

  // Pintar la caché primero hace que abrir Ventas sea inmediato.
  if (hasCachedSales) {
    populateFilters(salesData);
    renderVentas(salesData);
    actualizarKPIVentas();
    if (shouldShowLoader) {
      requestAnimationFrame(() => window.setTimeout(hideLoader, 220));
    }
    if (!force && cacheIsFresh) return salesData;
  }

  // Una sola solicitud compartida evita llamadas duplicadas al backend.
  if (salesRequest) {
    const pendingRequest = salesRequest;
    if (force && salesRequestRevision !== salesRevision) {
      await pendingRequest;
      if (shouldShowLoader && !hasCachedSales) hideLoader();
      return cargarVentas({ force: true, silent });
    }
    try {
      return await pendingRequest;
    } finally {
      if (shouldShowLoader && !hasCachedSales) hideLoader();
    }
  }

  const requestRevision = salesRevision;
  salesRequestRevision = requestRevision;
  salesRequest = (async () => {
    try {
      const res = await fetch(`${API_URL}?action=sales`);
      if (!res.ok) throw new Error(`Ventas HTTP ${res.status}`);

      let data = await res.json();

      data = data
        .map((v, i) => ({ ...v, __idx: i }))
        .sort((a, b) => {
          const ta = parseFechaHoraES(a.fecha, a.hora);
          const tb = parseFechaHoraES(b.fecha, b.hora);
          if (tb !== ta) return tb - ta;
          return b.__idx - a.__idx;
        })
        .map(v => { delete v.__idx; return v; });

      // Si ocurrió una venta mientras cargaba, esta respuesta ya es anterior.
      if (requestRevision !== salesRevision) return data;

      salesData = data;
      salesLoadedAt = Date.now();
      populateFilters(data);
      renderVentas(data);
      await actualizarKPIVentas();
      return data;
    } catch (e) {
      console.error(e);
      if (!hasCachedSales) showToast("Error cargando ventas");
      return salesData;
    } finally {
      salesRequest = null;
      if (shouldShowLoader && !hasCachedSales) hideLoader();
    }
  })();

  return salesRequest;
}

/* =========================
   RENDER DE LA TABLA
   ========================= */
function renderVentas(data) {
  salesTbody.innerHTML = data.map(v => {
    const metodo1 = v.metodo1
      ? `<div><strong>${v.metodo1}</strong><div class="payment-amount">$ ${Number(v.monto1 || 0).toLocaleString("es-CO")}</div></div>`
      : "N/A";

    const metodo2 = v.metodo2
      ? `<div><strong>${v.metodo2}</strong><div class="payment-amount">$ ${Number(v.monto2 || 0).toLocaleString("es-CO")}</div></div>`
      : "N/A";

    const descuento = Number(v.descuento || 0);

    return `
  <tr>
    <td>${v.producto}</td>
    <td>${v.marca}</td>
    <td>${v.cantidad}</td>
    <td>$ ${Number(v.total).toLocaleString("es-CO")}</td>
    <td class="discount">${descuento > 0 ? `- $ ${descuento.toLocaleString("es-CO")}` : "N/A"}</td>
    <td>${metodo1}</td>
    <td>${metodo2}</td>
    <td>${v.fecha}</td>
    <td>${v.hora}</td>
    <td>
      <button class="btn-delete-sale table-action-button"
        onclick="eliminarVenta('${v.id}')" aria-label="Eliminar venta" title="Eliminar venta">
        <span class="action-icon">${actionIcon("trash")}</span>
      </button>
    </td>
  </tr>
`;
  }).join("");
}

/* =========================
   POBLAR FILTROS
   ========================= */
/* =========================
   MÉTODOS DE PAGO FIJOS
   ========================= */
const METODOS_PAGO = [
  "Efectivo",
  "Transferencia",
  "Datafono",
  "Sistecredito",
  "Addi"
];

/* =========================
   POBLAR FILTROS
   ========================= */
function populateFilters(data) {
  const unique = (key) => [...new Set(data.map(d => d[key]).filter(Boolean))];

  fillSelect(filterProducto, unique('producto'), "Todos los productos");
  fillSelect(filterMarca, unique('marca'), "Todas las marcas");

  // 👇 métodos fijos
  fillSelect(filterMetodo1, METODOS_PAGO, "Todos los métodos de pago");
  fillSelect(filterMetodo2, METODOS_PAGO, "Todos los métodos de pago");
}

function fillSelect(select, items, placeholder) {
  const selectedValue = select.value;
  select.innerHTML =
    `<option value="">${placeholder}</option>` +
    items.map(i => `<option value="${i}">${i}</option>`).join('');

  if (items.includes(selectedValue)) select.value = selectedValue;
}




/* =========================
   FILTRADO DINÁMICO
   ========================= */
function filtrarVentas() {
  const filtered = salesData.filter(v => {
    const fechaVenta = new Date(v.fecha.split("/").reverse().join("-")); // yyyy-mm-dd

    const now = new Date();
    let fechaMatch = true;

    switch(filterFecha.value) {
      case 'hoy':
        fechaMatch = fechaVenta.toDateString() === now.toDateString();
        break;
      case 'ayer':
        const ayer = new Date(now);
        ayer.setDate(now.getDate() - 1);
        fechaMatch = fechaVenta.toDateString() === ayer.toDateString();
        break;
      case 'ultimos7':
        const semana = new Date(now);
        semana.setDate(now.getDate() - 7);
        fechaMatch = fechaVenta >= semana && fechaVenta <= now;
        break;
      case 'ultimos30':
        const mes = new Date(now);
        mes.setDate(now.getDate() - 30);
        fechaMatch = fechaVenta >= mes && fechaVenta <= now;
        break;
      default:
        fechaMatch = true;
    }

    return (
      fechaMatch &&
      (!filterProducto.value || v.producto === filterProducto.value) &&
      (!filterMarca.value || v.marca === filterMarca.value) &&
      (!filterMetodo1.value || v.metodo1 === filterMetodo1.value) &&
      (!filterMetodo2.value || v.metodo2 === filterMetodo2.value)
    );
  });

  renderVentas(filtered);
}

// Eventos de select
[filterFecha, filterProducto, filterMarca, filterMetodo1, filterMetodo2].forEach(sel => {
  sel.addEventListener('change', filtrarVentas);
});

// Precarga silenciosa: Ventas aparece de inmediato al abrir la sección.
cargarVentas({ silent: true });



// ==============================
//  ACTUALIZAR KPIS VENTAS DEL DÍA
// ==============================
const ventasKPIContainer = document.getElementById("ventasKPI");

let lastKPIsUpdate = 0; // timestamp para no recalcular mucho

async function actualizarKPIVentas() {
  const now = new Date();
  const bogotaOffset = -5 * 60;
  const diff = bogotaOffset + now.getTimezoneOffset();
  const bogotaTime = new Date(now.getTime() + diff * 60000);
  const hoy = new Date(bogotaTime);
  hoy.setHours(0, 0, 0, 0);

  if (Date.now() - lastKPIsUpdate < 120 && !ventasKPIContainer.dataset.force) return;
  lastKPIsUpdate = Date.now();
  delete ventasKPIContainer.dataset.force;

  const kpis = {};
  let totalDia = 0;
  let totalDescuentos = 0;

  // Calcular desde los datos evita recorrer y analizar nuevamente toda la tabla.
  salesData.forEach((venta) => {
    const ts = parseFechaHoraES(venta.fecha, venta.hora);
    if (!Number.isFinite(ts) || ts < hoy.getTime()) return;

    totalDescuentos += Number(venta.descuento || 0);

    [
      [venta.metodo1, venta.monto1],
      [venta.metodo2, venta.monto2]
    ].forEach(([metodo, monto]) => {
      if (!metodo || metodo === "Ninguno") return;
      const valor = Number(monto || 0);
      kpis[metodo] = (kpis[metodo] || 0) + valor;
      totalDia += valor;
    });
  });

  const orden = ["Efectivo", "Transferencia", "Datafono", "Sistecredito", "Addi"];
  const mostrandoVentas = kpiModo === "ventas";

  ventasKPIContainer.innerHTML = `
    <div class="kpi-card kpi-main kpi-fade-in ${mostrandoVentas ? "is-sales" : "is-discount"}">
      <div class="kpi-label">${mostrandoVentas ? "Total Ventas del Día" : "Total Descuentos"}</div>
      <div class="kpi-value">$ ${(mostrandoVentas ? totalDia : totalDescuentos).toLocaleString("es-CO")}</div>
      <button
        type="button"
        class="kpi-toggle"
        onclick="toggleKPI()"
        title="${mostrandoVentas ? "Ver descuentos" : "Ver ventas"}"
        aria-label="${mostrandoVentas ? "Ver descuentos" : "Ver ventas"}"
      >
        ${mostrandoVentas ? "Descuentos" : "Ventas"}
      </button>
    </div>

    ${orden.map(m => `
      <div class="kpi-card kpi-method" style="--kpi-accent:${colorMetodoPago(m)}">
        <div class="kpi-label"><span class="kpi-dot" aria-hidden="true"></span>${m}</div>
        <div class="kpi-value">$ ${(kpis[m] || 0).toLocaleString("es-CO")}</div>
      </div>
    `).join("")}
  `;

  await new Promise(resolve => requestAnimationFrame(resolve));
}


//   TOGGLE ENTRE VENTAS Y DESCUENTOS
async function toggleKPI() {
  const card = document.querySelector(".kpi-main");
  if (!card || card.dataset.loading === "1") return;
  card.dataset.loading = "1";
  card.classList.add("kpi-switching");
  ventasKPIContainer.dataset.force = "1";
  kpiModo = kpiModo === "ventas" ? "descuentos" : "ventas";
  await actualizarKPIVentas();
}




// Color alusivo para cada método
function colorMetodoPago(m) {
  switch(m) {
    case "Efectivo": return "#34c759";
    case "Transferencia": return "#0a84ff";
    case "Datafono": return "#ff9f0a";
    case "Sistecredito": return "#ff375f";
    case "Addi": return "#bf5af2";
    default: return "#64d2ff";
  }
}



// Refresco bajo demanda: al volver a la pestaña se sincroniza sin bloquear la UI.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && views.ventas.classList.contains("active")) {
    cargarVentas({ force: true, silent: true });
  }

  if (document.visibilityState === "visible" && views.inventario.classList.contains("active")) {
    cargarInventario({ silent: true });
  }
});








/* ======================
   GUARDAR y EDITAR PRODUCTO
====================== */
form.onsubmit = async e => {
  e.preventDefault();

  const data = Object.fromEntries(new FormData(form));

  // 🔒 normalización
  data.costo = parseCOPValue(data.costo);
  data.margen = Number(data.margen) || 0;
  data.cantidad = Number(data.cantidad) || 0;

  // 🔥 precio SIEMPRE desde costo
  data.precio = Math.round(
    data.costo * (1 + data.margen / 100)
  );

  if (!data.precio || data.precio <= 0) {
    showToast("❌ El precio no puede ser 0", "error");
    return;
  }

  if (editState.mode === "edit") {
    data.action = "update";
    data.id = editState.id;
  } else {
    data.action = "create";
  }

  const previousInventory = (window.inventario || []).map(product => ({ ...product }));
  const now = new Date().toISOString();
  const isEditing = data.action === "update";
  const optimisticId = isEditing ? data.id : `pending-${Date.now()}`;
  const previousUpdateTimestamp = isEditing ? productUpdateTimes[String(data.id)] : undefined;
  if (isEditing) markProductUpdated(data.id);
  const previousProduct = previousInventory.find(product => String(product.id) === String(data.id));
  const optimisticProduct = {
    ...(previousProduct || {}),
    id: optimisticId,
    nombre: data.nombre,
    marca: data.marca,
    categoria: data.categoria,
    subcategoria: data.subcategoria,
    costo: data.costo,
    margen: data.margen,
    precio: data.precio,
    cantidad: data.cantidad,
    stock: data.cantidad,
    vendidos: Number(previousProduct?.vendidos) || 0,
    fecha: now,
    __pendingCreate: !isEditing
  };

  if (!isEditing) {
    pendingProductCreates.set(String(optimisticId), {
      product: optimisticProduct,
      baselineIds: new Set(previousInventory.map(product => String(product.id)))
    });
  }

  const optimisticInventory = isEditing
    ? previousInventory.map(product => String(product.id) === String(data.id) ? optimisticProduct : product)
    : [...previousInventory, optimisticProduct];

  writeInventoryCache(optimisticInventory);
  renderInventory(optimisticInventory);

  form.reset();
  modal.classList.add("hidden");

  // reset estado
  editState = {
    mode: "create",
    id: null
  };

  showToast(
    isEditing
      ? "Producto actualizado"
      : "Producto agregado"
  );

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error("El backend no confirmó el cambio");
    if (!isEditing) {
      const responsePayload = await response.clone().json().catch(() => null);
      const createdId = extractCreatedProductId(responsePayload);
      if (createdId !== undefined) promotePendingProductLocally(optimisticId, createdId);
    }
    await cargarInventario({ silent: true });
    if (!isEditing && pendingProductCreates.has(String(optimisticId))) {
      schedulePendingProductSync(optimisticId);
    }
  } catch (error) {
    console.error(error);
    if (!isEditing) pendingProductCreates.delete(String(optimisticId));
    if (isEditing && previousUpdateTimestamp) {
      markProductUpdated(data.id, previousUpdateTimestamp);
    } else if (isEditing) {
      clearProductUpdated(data.id);
    }
    writeInventoryCache(previousInventory);
    renderInventory(previousInventory);
    showToast("No se pudo guardar el producto; se restauró la información anterior");
  }
};







/* ======================
    ACTUALIZAR EL SPAN TOTAL A PAGAR 
====================== */
function actualizarTotalGlobalVenta() {
  let total = 0;
  let haySeleccion = false;

  Object.keys(qtyState).forEach(id => {
    const qty = qtyState[id];
    if (!qty || qty <= 0) return;

    const row = document.querySelector(`tr[data-id="${id}"]`);
    if (!row) {
      delete qtyState[id];
      return;
    }

    haySeleccion = true;

    const precio = Number(
      row.children[3].textContent.replace(/[^\d]/g, "")
    );

    total += precio * qty;
  });

  const span = document.getElementById("sellTotal");
  if (!span) return;

  span.textContent = haySeleccion
    ? total.toLocaleString("es-CO")
    : "0";

  span.closest(".total-box")?.classList.toggle("is-active", haySeleccion);
}



/* ======================
   CAMBIAR CANTIDAD (+ / -)
====================== */
window.cambiarQty = function (id, delta) {

  const stock = stockState[id] || 0;

  if (delta > 0 && qtyState[id] >= stock) return;

  qtyState[id] += delta;

  if (qtyState[id] < 0) qtyState[id] = 0;
  if (qtyState[id] > stock) qtyState[id] = stock;

  const span = document.getElementById(`qty-${id}`);
  if (span) {
    span.textContent = qtyState[id];

    // 🔥 EFECTO VISUAL
    if (qtyState[id] > 0) {
      span.classList.add("qty-active");
    } else {
      span.classList.remove("qty-active");
    }
  }

  actualizarTotalGlobalVenta();
  updateSellCartBadge();
};

function applyCompletedSaleToInventory(items) {
  items.forEach(({ id, qty }) => {
    const product = (window.inventario || []).find(item => String(item.id) === String(id));
    const currentStock = product ? Number(product.stock) || 0 : stockState[id] || 0;
    const currentSold = product ? Number(product.vendidos) || 0 : 0;

    stockState[id] = Math.max(currentStock - qty, 0);
    qtyState[id] = 0;

    if (product) {
      product.stock = stockState[id];
      product.cantidad = stockState[id];
      product.vendidos = currentSold + qty;
      holdInventoryUiState(product);
    }

    const counter = document.getElementById(`qty-${id}`);
    if (counter) {
      counter.textContent = "0";
      counter.classList.remove("qty-active");
    }

    updateStockUI(id);

    const soldCell = document.getElementById(`sold-${id}`);
    if (soldCell) {
      soldCell.textContent = String(currentSold + qty);
      soldCell.classList.remove("sold-cell-updated");
      requestAnimationFrame(() => soldCell.classList.add("sold-cell-updated"));
      window.setTimeout(() => soldCell.classList.remove("sold-cell-updated"), 520);
    }
  });

  writeInventoryCache(window.inventario || []);

  actualizarTotalGlobalVenta();
  updateSellCartBadge();
}


/* ======================
   VENDER (CON VALIDACIÓN)
====================== */
let sellState = {
  id: null,
  nombre: "",
  precio: 0,
  qty: 0,
  pending: false
};


window.venderDesdeFila = function (id) {
  const qty = qtyState[id];
  const stock = stockState[id];

  if (qty <= 0) {
    showToast("Selecciona una cantidad mayor a 0");
    return;
  }

  if (qty > stock) {
    showToast(`No es posible vender ${qty}. En stock solo hay ${stock}.`);
    return;
  }

  const row = document.querySelector(`tr[data-id="${id}"]`);
  const nombre = getNombreProductoFromRow(row);
  const precio = Number(row.children[3].textContent.replace(/[^\d]/g, ""));

  sellState = {
    id,
    nombre,
    precio,
    qty,
    pending: true
  };

  openSellModal();
};

/* ======================
    VENDER SELECCIONADOS
====================== */

window.venderSeleccionados = function () {
  const rows = document.querySelectorAll("tbody tr");
  const items = [];

  rows.forEach(row => {
    const id = row.dataset.id;
    const qty = qtyState[id];
    const stock = stockState[id];

    // 🔑 ÚNICA CONDICIÓN: cantidad > 0
    if (qty > 0) {
      if (qty > stock) {
        showToast(`Stock insuficiente para ${row.children[1].textContent}`);
        return;
      }

      items.push({
  id,
  nombre: getNombreProductoFromRow(row),
  marca: row.children[2].textContent.trim(),
  precio: Number(row.children[3].textContent.replace(/[^\d]/g, "")),
  qty
});

    }
  });

  if (!items.length) {
    return showToast("No hay productos con cantidad seleccionada");
  }

  // ✅ MISMO OBJETO, SOLO SE AGREGA CONTEXTO
  sellCartState = {
    items,
    pending: true,
    __from: "btnSellCart" // 👈 identifica venta múltiple
  };

  openSellCartModal();
};

/* ======================
    CALCULAR TOTAL VENTA MULTIPLE
====================== */
function calcularTotalVentaMultiple() {
  return sellCartState.items.reduce(
    (sum, i) => sum + i.precio * i.qty,
    0
  );
}

/* ======================
    MODAL VENDER SELECCIONADOS
====================== */
function openSellCartModal() {
  const old = document.getElementById("sellCartModal");
  if (old) old.remove();

  // 🎨 ESTILOS SOLO SI VIENE DE "VENDER SELECCIONADOS"
  if (sellCartState.__from === "btnSellCart") {
    if (!document.getElementById("sellModalStyles")) {
      const style = document.createElement("style");
      style.id = "sellModalStyles";
      style.innerHTML = `
        .sell-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,.45);
          display: grid;
          place-items: center;
          z-index: 2000;
        }

        .sell-card {
          width: 520px;
          max-width: 94vw;
          background: rgba(20,20,30,.95);
          backdrop-filter: blur(30px);
          border-radius: 28px;
          padding: 28px;
          color: white;
          box-shadow: 0 30px 80px rgba(0,0,0,.6);
        }

        .sell-sub {
          font-size: 13px;
          opacity: .7;
          margin-bottom: 18px;
        }

        .sell-section {
          margin-bottom: 18px;
        }

        .sell-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .sell-field label {
          font-size: 12px;
          opacity: .7;
          margin-bottom: 6px;
          display: block;
        }

        .sell-field input,
        .sell-field select {
          width: 100%;
          padding: 13px 14px;
          border-radius: 14px;
          border: none;
          outline: none;
          background: rgba(15,20,35,.95);
          color: white;
        }

        .sell-total {
          background: linear-gradient(135deg,#0a84ff,#0066ff);
          padding: 14px;
          border-radius: 16px;
          text-align: center;
          font-weight: 700;
          margin-top: 14px;
        }

        .sell-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 22px;
        }

        .sell-actions .ghost {
          background: transparent;
          color: white;
          border: 1px solid rgba(255,255,255,.25);
        }

        .sell-actions .primary {
          background: linear-gradient(135deg,#0a84ff,#0066ff);
          color: white;
        }

        .sell-actions button {
        padding: 12px 18px;
        border-radius: 14px;
        border: none;
        cursor: pointer;
        font-weight: 600;
        transition: transform .15s ease, box-shadow .15s ease, opacity .15s ease;
      }

       .sell-actions button:hover {
       transform: translateY(-1px);
       box-shadow: 0 8px 20px rgba(0,0,0,.35);
       }

      .sell-actions .ghost:hover {
      background: rgba(255,255,255,.08);
      }

      .sell-actions .primary:hover {
      opacity: .95;
     }

      `;
      document.head.appendChild(style);
    }
  }

  const total = calcularTotalVentaMultiple();


  const modal = document.createElement("div");
  modal.id = "sellCartModal";
  modal.className = "sell-overlay";

  // 🔒 HTML EXACTO COMO LO TENÍAS
  modal.innerHTML = `
    <div class="sell-card" style="width:520px">
      <h2>Venta múltiple</h2>
      <div class="sell-sub">Resumen de prendas seleccionadas</div>

      <div class="sell-section">
        ${sellCartState.items.map(i => `
          <div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:6px">
            <span>${i.nombre} × ${i.qty}</span>
            <b>$ ${(i.precio * i.qty).toLocaleString("es-CO")}</b>
          </div>
        `).join("")}
      </div>

        <div class="sell-field">
          <label>Descuento</label>
          <input type="text" id="cartDiscount" value="${formatCOPInputValue(0)}" inputmode="numeric" autocomplete="off">
        </div>

      <div class="sell-section">
        <div class="sell-grid">
        
          <div class="sell-field">
            <label>Método de pago 1</label>
            <select id="cartPayMethod1">
               <option>Efectivo</option>
               <option>Transferencia</option>
               <option>Datafono</option>
               <option>Sistecredito</option>
               <option>Addi</option>
            </select>
          </div>

          <div class="sell-field">
            <label>Monto</label>
            <input type="text" id="cartPayAmount1" value="${formatCOPInputValue(total)}" inputmode="numeric" autocomplete="off">
          </div>

          <div class="sell-field">
            <label>Método de pago 2</label>
            <select id="cartPayMethod2">
               <option>Ninguno</option>
               <option>Efectivo</option>
               <option>Transferencia</option>
               <option>Datafono</option>
               <option>Sistecredito</option>
               <option>Addi</option>
            </select>
          </div>

          <div class="sell-field">
            <label>Monto</label>
            <input type="text" id="cartPayAmount2" value="${formatCOPInputValue(0)}" inputmode="numeric" autocomplete="off" readonly>
          </div>
        </div>
      </div>

      <div class="sell-total">
        Total Venta: $ <span id="cartTotal">${total.toLocaleString("es-CO")}</span>
      </div>

      <div class="sell-actions">
        <button class="ghost" onclick="closeSellCartModal()">Cancelar</button>
        <button class="primary" onclick="confirmarVentaMultiple()">Confirmar venta</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // ======================
// 🔗 REFERENCIAS DOM (MODAL)
// ======================
const cartDiscount = document.getElementById("cartDiscount");
const cartPayAmount1 = document.getElementById("cartPayAmount1");
const cartPayAmount2 = document.getElementById("cartPayAmount2");
const cartPayMethod2 = document.getElementById("cartPayMethod2");
const cartTotal = document.getElementById("cartTotal");

// ======================
// 🧠 LISTENERS INTELIGENTES
// ======================
cartDiscount.addEventListener("input", () => updateCartTotals("discount"));
cartPayAmount1.addEventListener("input", () => updateCartTotals("monto1"));
cartPayAmount2.addEventListener("input", () => updateCartTotals("monto2"));
cartPayMethod2.addEventListener("change", () => updateCartTotals("method"));

// estado inicial
updateCartTotals("init");

}





/* ======================
    CALCULAR TOTAL CON DESCUENTO
====================== */
function calcularTotalConDescuento() {
  const subtotal = calcularTotalVentaMultiple();
  const descuento = parseCOPValue(document.getElementById("cartDiscount")?.value);
  return Math.max(subtotal - descuento, 0);
}


/* ======================
    ACTUALIZAR TOTALES VENTA MULTIPLE
====================== */
function updateCartTotals(source = "init") {
  const cartDiscount = document.getElementById("cartDiscount");
  const cartPayAmount1 = document.getElementById("cartPayAmount1");
  const cartPayAmount2 = document.getElementById("cartPayAmount2");
  const cartPayMethod2 = document.getElementById("cartPayMethod2");
  const cartTotal = document.getElementById("cartTotal");

  if (!cartDiscount || !cartPayAmount1 || !cartPayAmount2 || !cartPayMethod2 || !cartTotal) return;

  const subtotal = calcularTotalVentaMultiple();
  const descuento = parseCOPValue(cartDiscount.value);
  const totalFinal = Math.max(subtotal - descuento, 0);

  const metodo2 = cartPayMethod2.value;

  let monto1 = parseCOPValue(cartPayAmount1.value);
  let monto2 = parseCOPValue(cartPayAmount2.value);

  if (metodo2 === "Ninguno") {
    monto1 = totalFinal;
    monto2 = 0;
  } else {
    if (source === "discount" || source === "method" || source === "init") {
      monto1 = Math.floor(totalFinal / 2);
      monto2 = totalFinal - monto1;
    } else if (source === "monto1") {
      monto1 = Math.min(monto1, totalFinal);
      monto2 = totalFinal - monto1;
    } else if (source === "monto2") {
      monto2 = Math.min(monto2, totalFinal);
      monto1 = totalFinal - monto2;
    }
  }

  cartDiscount.value = formatCOPInputValue(descuento);
  cartPayAmount1.value = formatCOPInputValue(Math.max(monto1, 0));
  cartPayAmount2.value = formatCOPInputValue(Math.max(monto2, 0));
  cartTotal.textContent = totalFinal.toLocaleString("es-CO");
}






/* ======================
    NORMALIZAR PAGOS VENTA MULTIPLE
====================== */
function normalizarPagos(metodo1, monto1, metodo2, monto2, total) {
  let m1 = metodo1;
  let v1 = Number(monto1) || 0;

  let m2 = metodo2;
  let v2 = Number(monto2) || 0;

  // 🔒 Si método 2 es "Ninguno", fuerza monto 2 = 0
  if (m2 === "Ninguno") {
    m2 = "";
    v2 = 0;
  }

  // 🔒 Si solo hay un método, absorbe todo
  if (!m2) {
    v1 = total;
    v2 = 0;
  }

  // 🔒 Ajuste final por seguridad
  if (v1 + v2 !== total) {
    v1 = total;
    v2 = 0;
    m2 = "";
  }

  return {
    metodo1: m1,
    monto1: v1,
    metodo2: m2,
    monto2: v2
  };
}

 
/* ======================
    CONFIRMAR VENTA MULTIPLE (PROPORCIONAL REAL)
====================== */
async function confirmarVentaMultiple() {
  try {
    showLoader("Procesando venta...");

    const metodo1 = document.getElementById("cartPayMethod1").value;
    const metodo2 = document.getElementById("cartPayMethod2").value;

    let monto1 = parseCOPValue(document.getElementById("cartPayAmount1").value);
    let monto2 = parseCOPValue(document.getElementById("cartPayAmount2").value);

    const descuento = parseCOPValue(document.getElementById("cartDiscount").value);

    const items = await Promise.all(
      sellCartState.items.map(async item => ({
        ...item,
        id: await resolveProductIdForSale(item.id)
      }))
    );
    sellCartState.items = items;

    const totalVenta = items.reduce(
      (s, i) => s + i.precio * i.qty,
      0
    );

    const totalConDescuento = totalVenta - descuento;

    // 🛑 VALIDACIÓN CORRECTA (YA CON DESCUENTO)
    if (monto1 + monto2 !== totalConDescuento) {
      hideLoader();
      return showToast(
        "La suma de pagos no coincide con el total con descuento",
        "error"
      );
    }

    // 🔐 Normalizar métodos
    const pagos = normalizarPagos(
      metodo1,
      monto1,
      metodo2,
      monto2,
      totalConDescuento
    );

    // 📊 Porcentajes reales (SOBRE TOTAL CON DESCUENTO)
    const pct1 = pagos.monto1 / totalConDescuento;
    const pct2 = pagos.monto2 / totalConDescuento;

    let acumulado1 = 0;
    let acumulado2 = 0;

    let index = 1;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      showLoader(`Procesando venta ${index}/${items.length}...`);

      const subtotalItem = item.precio * item.qty;

      // 🔻 Descuento proporcional por producto
      const descuentoItem = Math.round(subtotalItem * (descuento / totalVenta));

      const totalItem = subtotalItem - descuentoItem;

      // 💰 Montos proporcionales por producto
      let itemMonto1 = Math.round(totalItem * pct1);
      let itemMonto2 = Math.round(totalItem * pct2);

      acumulado1 += itemMonto1;
      acumulado2 += itemMonto2;

      // 🧮 Ajuste final por redondeo
      if (i === items.length - 1) {
        itemMonto1 += pagos.monto1 - acumulado1;
        itemMonto2 += pagos.monto2 - acumulado2;
      }

      const saleResponse = await fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({
          action: "sell_full",

          id: item.id,
          producto: item.nombre,
          marca: item.marca,

          cantidad: item.qty,
          precioUnitario: item.precio,
          subtotal: subtotalItem,
          descuento: descuentoItem,
          total: totalItem,

          // ✅ PAGOS REALES POR PRODUCTO
          metodo1: pagos.metodo1,
          monto1: itemMonto1,
          metodo2: pagos.metodo2,
          monto2: itemMonto2
        })
      });

      if (!saleResponse.ok) {
        throw new Error(`Venta ${index} no confirmada por el backend`);
      }

      index++;
    }

    applyCompletedSaleToInventory(items);
    invalidateSalesCache();
    closeSellCartModal();
    showToast("Venta múltiple registrada correctamente", "success");
    void cargarInventario({ silent: true });
    void cargarVentas({ force: true, silent: true });

  } catch (e) {
    console.error(e);
    showToast("Error en venta múltiple", "error");

  } finally {
    hideLoader();
  }

  updateSellCartBadge(); // 🔥 actualizamos badge del carrito
}





/* ======================
    CERRAR MODAL VENDER SELECCIONADOS
====================== */

function closeSellCartModal() {
  const modal = document.getElementById("sellCartModal");
  if (modal) modal.remove();
}



/* ======================
    MODAL VENDER INDIVIDUAL
====================== */

const sellModal = document.getElementById("sellModal");
const sellTitle = document.getElementById("sellTitle");
const sellInfo = document.getElementById("sellInfo");

function openSellModal() {
  const { nombre, precio, qty } = sellState;
  const totalInicial = precio * qty;

  // 🧹 eliminar modal previo
  const old = document.getElementById("sellModalDynamic");
  if (old) old.remove();

  // 🎨 estilos (una sola vez)
  if (!document.getElementById("sellModalStyles")) {
    const style = document.createElement("style");
    style.id = "sellModalStyles";
    style.innerHTML = `
      .sell-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,.45);
        display: grid;
        place-items: center;
        z-index: 2000;
      }

      .sell-card {
        width: 420px;
        max-width: 94vw;
        background: rgba(20,20,30,.95);
        backdrop-filter: blur(30px);
        border-radius: 28px;
        padding: 28px;
        color: white;
        box-shadow: 0 30px 80px rgba(0,0,0,.6);
      }

      .sell-card h2 {
        margin-bottom: 4px;
      }

      .sell-sub {
        font-size: 13px;
        opacity: .7;
        margin-bottom: 18px;
      }

      .sell-section {
        margin-bottom: 18px;
      }

      .sell-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }

      .sell-field label {
        font-size: 12px;
        opacity: .7;
        margin-bottom: 6px;
        display: block;
      }

      .sell-field input,
      .sell-field select {
        width: 100%;
        padding: 13px 14px;
        border-radius: 14px;
        border: none;
        outline: none;
        background: rgba(15,20,35,.95);
        color: white;
        appearance: none;
      }

      .sell-field select {
        cursor: pointer;
        background-image:
          linear-gradient(45deg, transparent 50%, #0a84ff 50%),
          linear-gradient(135deg, #0a84ff 50%, transparent 50%);
        background-position:
          calc(100% - 20px) 55%,
          calc(100% - 14px) 55%;
        background-size: 6px 6px;
        background-repeat: no-repeat;
      }

      .sell-total {
        background: linear-gradient(135deg,#0a84ff,#0066ff);
        padding: 14px;
        border-radius: 16px;
        text-align: center;
        font-weight: 700;
        margin-top: 14px;
      }

      .sell-actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        margin-top: 22px;
      }

      .sell-actions button {
        padding: 12px 18px;
        border-radius: 14px;
        border: none;
        cursor: pointer;
        font-weight: 600;
      }

      .sell-actions .ghost {
        background: transparent;
        color: white;
        border: 1px solid rgba(255,255,255,.25);
      }

      .sell-actions .primary {
        background: linear-gradient(135deg,#0a84ff,#0066ff);
        color: white;
      }
    `;
    document.head.appendChild(style);
  }

  // 🧩 modal
  const modal = document.createElement("div");
  modal.id = "sellModalDynamic";
  modal.className = "sell-overlay";

  modal.innerHTML = `
    <div class="sell-card">
      <h2>${nombre}</h2>
      <div class="sell-sub">Confirma los detalles de la venta</div>

      <div class="sell-section">
        <div class="sell-grid">
          <div class="sell-field">
            <label>Cantidad *</label>
            <input type="number" id="sellQty" min="1" value="${qty}">
          </div>

          <div class="sell-field">
            <label>Descuento</label>
            <input type="number" id="sellDiscount" value="0">
          </div>
        </div>
      </div>

      <div class="sell-section">
        <div class="sell-grid">
          <div class="sell-field">
            <label>Método de pago 1</label>
            <select id="payMethod1">
               <option>Efectivo</option>
               <option>Transferencia</option>
               <option>Datafono</option>
               <option>Sistecredito</option>
               <option>Addi</option>
            </select>
          </div>

          <div class="sell-field">
            <label>Monto</label>
            <input type="number" id="payAmount1" value="${totalInicial}">
          </div>

          <div class="sell-field">
            <label>Método de pago 2</label>
            <select id="payMethod2">
              <option>Ninguno</option>
              <option>Efectivo</option>
              <option>Transferencia</option>
              <option>Datafono</option>
              <option>Sistecredito</option>
              <option>Addi</option>
            </select>
          </div>

          <div class="sell-field">
            <label>Monto</label>
            <input type="number" id="payAmount2" value="0" readonly>
          </div>
        </div>
      </div>

      <div class="sell-total">
        Total Venta: $ <span id="sellTotal">${totalInicial.toLocaleString("es-CO")}</span>
      </div>

      <div class="sell-actions">
        <button class="ghost" onclick="closeSellModal()">Cancelar</button>
        <button class="primary" onclick="confirmarVenta()">Confirmar venta</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // 🧠 listeners de lógica
  ["sellQty", "sellDiscount", "payAmount1"].forEach(id => {
    document.getElementById(id).addEventListener("input", updateSellTotals);
  });

  // estado inicial correcto
  updateSellTotals();
}




/* ======================
    ACTUALIZAR TOTALES VENTA
====================== */
function updateSellTotals() {
  const qty = Number(document.getElementById("sellQty").value) || 0;
  const discount = Number(document.getElementById("sellDiscount").value) || 0;

  const total = Math.max(
    sellState.precio * qty - discount,
    0
  );

  const amount1 = Number(document.getElementById("payAmount1").value) || 0;
  const amount2 = total - amount1;

  document.getElementById("payAmount2").value = amount2 >= 0 ? amount2 : 0;

  document.getElementById("sellTotal").textContent =
    total.toLocaleString("es-CO");
}

/* ======================
    ACTUALIZAR BADGE CARRITO
====================== */
function updateSellCartBadge() {
  const badge = document.getElementById("sellCartBadge");
  if (!badge) return;

  let totalItems = 0;

  Object.entries(qtyState).forEach(([id, qty]) => {
    if (qty > 0 && document.querySelector(`tr[data-id="${id}"]`)) totalItems += qty;
  });

  if (totalItems <= 0) {
    badge.classList.add("hidden");
    badge.textContent = "0";
    return;
  }

  badge.textContent = totalItems;
  badge.classList.remove("hidden");

  // ✨ animación premium
  badge.classList.remove("bump");
  void badge.offsetWidth; // force reflow
  badge.classList.add("bump");

   //  Llamando a la funcion que replica todo igual en el carrito flotante
 if (window.syncSellBadge) {
  syncSellBadge();
}

}


 


/* ======================
    CONFIRMAR VENTA SIMPLE
====================== */
async function confirmarVenta() {
  if (!sellState) return;

  try {
    showLoader("Confirmando venta...");

    const qty = Number(document.getElementById("sellQty").value);
    const descuento = Number(document.getElementById("sellDiscount").value || 0);

    const metodo1 = document.getElementById("payMethod1").value;
    const metodo2 = document.getElementById("payMethod2").value;

    const monto1 = Number(document.getElementById("payAmount1").value || 0);
    const monto2 = Number(document.getElementById("payAmount2").value || 0);

    const { nombre, marca, precio } = sellState;
    const id = await resolveProductIdForSale(sellState.id);
    sellState.id = id;

    const subtotal = precio * qty;
    const total = subtotal - descuento;

    // 🛑 validaciones duras
    if (qty <= 0) {
      hideLoader();
      return showToast("Cantidad inválida", "error");
    }

    if (monto1 + monto2 !== total) {
      hideLoader();
      return showToast(
        "La suma de los pagos no coincide con el total",
        "error"
      );
    }

    // ✅ normalizar pagos
    const pagos = normalizarPagos(
      metodo1,
      monto1,
      metodo2,
      monto2,
      total
    );

    const saleResponse = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "sell_full",

        id,
        producto: nombre,
        marca,

        cantidad: qty,
        precioUnitario: precio,
        subtotal,
        descuento,
        total,

        metodo1: pagos.metodo1,
        monto1: pagos.monto1,
        metodo2: pagos.metodo2,
        monto2: pagos.monto2
      })
    });

    if (!saleResponse.ok) {
      throw new Error("La venta no fue confirmada por el backend");
    }

    applyCompletedSaleToInventory([{ id, qty }]);
    invalidateSalesCache();
    sellState.pending = false;

    closeSellModal();
    showToast("Venta registrada correctamente", "success");
    void cargarInventario({ silent: true });
    void cargarVentas({ force: true, silent: true });

  } catch (err) {
    console.error(err);
    showToast("Error al registrar la venta", "error");

  } finally {
    hideLoader();
  }
}






/* ======================
    CERRAR MODAL VENDER
====================== */

function closeSellModal() {
  const modal = document.getElementById("sellModalDynamic");
  if (modal) modal.remove();
}



/* ====================== 
    EDITAR PRODUCTO
====================== */

function editarProducto(id) {
  const row = document.querySelector(`tr[data-id="${id}"]`);
  if (!row) return;

  const product = (window.inventario || []).find(item => String(item.id) === String(id));

  const modal = document.getElementById("modal");
  const form = document.getElementById("form");

  const nombre = row.children[1].querySelector(".product-name").childNodes[0].textContent.trim();
  const marca = row.children[2].textContent.trim();

  const costo = Number(
    row.children[4].textContent.replace(/[^\d]/g, "")
  );

  const categoria = row.children[5].textContent.trim();
  const subcategoria = row.children[6].textContent.trim();
  const cantidad = Number(row.children[7].textContent) || 0;

  // 🔹 llenar solo campos editables
  form.nombre.value = nombre;
  form.marca.value = marca;
  form.categoria.value = categoria;
  form.subcategoria.value = subcategoria;
  form.cantidad.value = cantidad;

  // 🔹 costo real (base del cálculo)
  form.costo.value = costo ? `$ ${costo.toLocaleString("es-CO")}` : "";

  // conservar el margen guardado para permitir editarlo
  const margenGuardado = Number(product?.margen);
  form.margen.value = Number.isFinite(margenGuardado) ? margenGuardado : 100;

  // 🔐 estado de edición (mínimo necesario)
  editState = {
    mode: "edit",
    id
  };

  modal.classList.remove("hidden");
}


/* ======================
   ELIMINAR PRODUCTO (CON VALIDACIÓN)
====================== */

async function eliminarProducto(id) {
  const confirmacion = await window.platformConfirm(
    "Eliminar producto",
    "Esta acción no se puede deshacer.",
    "Eliminar"
  );

  if (!confirmacion) return;

  const previousInventory = (window.inventario || []).map(product => ({ ...product }));
  const previousUpdateTimestamp = productUpdateTimes[String(id)];
  const optimisticInventory = previousInventory.filter(product => String(product.id) !== String(id));
  clearProductUpdated(id);
  writeInventoryCache(optimisticInventory);
  renderInventory(optimisticInventory);
  showToast("Producto eliminado");

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "delete",
        id
      })
    });
    if (!response.ok) throw new Error("El backend no confirmó la eliminación");
    await cargarInventario({ silent: true });
  } catch (error) {
    console.error(error);
    if (previousUpdateTimestamp) markProductUpdated(id, previousUpdateTimestamp);
    writeInventoryCache(previousInventory);
    renderInventory(previousInventory);
    showToast("No se pudo eliminar el producto; se restauró");
  }
};

/* ======================
   ELIMINAR VENTA (CON VALIDACIÓN)
====================== */
async function eliminarVenta(idVenta) {
  const ok = await window.platformConfirm(
    "Eliminar venta",
    "El stock será restaurado y los indicadores se recalcularán.",
    "Eliminar"
  );

  if (!ok) return;

  const previousSales = salesData.map(sale => ({ ...sale }));
  const deletedSale = previousSales.find(sale => String(sale.id) === String(idVenta));
  const previousInventory = deletedSale ? restoreSalesInInventoryLocally([deletedSale]) : null;
  salesData = salesData.filter(sale => String(sale.id) !== String(idVenta));
  salesLoadedAt = Date.now();
  populateFilters(salesData);
  renderVentas(salesData);
  ventasKPIContainer.dataset.force = "1";
  await actualizarKPIVentas();
  showToast("Venta eliminada");

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "delete_sale",
        id: idVenta
      })
    });

    const data = await res.json();

    if (!data.success) {
      throw new Error(data.message || "No se pudo eliminar la venta");
    }

    // 🔄 refrescos necesarios
    invalidateSalesCache();
    await Promise.all([
      cargarVentas({ force: true, silent: true }),
      cargarInventario({ silent: true })
    ]);
    ventasKPIContainer.dataset.force = "1";
    await actualizarKPIVentas();

  } catch (err) {
    console.error(err);
    if (deletedSale) clearInventoryUiStateForSales([deletedSale]);
    salesData = previousSales;
    salesLoadedAt = Date.now();
    populateFilters(salesData);
    renderVentas(salesData);
    if (previousInventory) {
      writeInventoryCache(previousInventory);
      renderInventory(previousInventory);
    }
    ventasKPIContainer.dataset.force = "1";
    await actualizarKPIVentas();
    showToast("No se pudo eliminar la venta; se restauró");
  }
}

window.eliminarTodasLasVentas = async function eliminarTodasLasVentas() {
  const button = document.getElementById("btnDeleteAllSales");
  if (button?.dataset.busy === "1") return;

  let salesToDelete = salesData.map(sale => ({ ...sale }));
  let ids = salesToDelete.map(sale => sale.id).filter(id => id !== undefined && id !== null && id !== "");

  // Si acaba de registrarse una venta, espera la sincronización que ya está en curso.
  if (!ids.length && salesLoadedAt === 0) {
    const refreshedSales = await cargarVentas({ force: true, silent: true });
    salesToDelete = (Array.isArray(refreshedSales) ? refreshedSales : salesData).map(sale => ({ ...sale }));
    ids = salesToDelete.map(sale => sale.id).filter(id => id !== undefined && id !== null && id !== "");
  }

  if (!ids.length) {
    await window.platformAlert("No hay ventas", "El historial de ventas ya está vacío.", "info");
    return;
  }

  const confirmed = await window.platformConfirm(
    "Eliminar histórico",
    `Se eliminarán ${ids.length} ventas y el inventario será recalculado. Esta acción no se puede deshacer.`,
    "Eliminar histórico"
  );
  if (!confirmed) return;

  if (button) button.dataset.busy = "1";
  button?.classList.add("is-syncing");
  if (button) button.disabled = true;

  restoreSalesInInventoryLocally(salesToDelete);
  salesData = [];
  salesLoadedAt = Date.now();
  populateFilters([]);
  renderVentas([]);
  ventasKPIContainer.dataset.force = "1";
  await actualizarKPIVentas();
  showToast("Ventas eliminadas. Sincronizando el sistema...");

  const failures = [];
  try {
    await runRequestsInBatches(ids, async id => {
      try {
        const response = await fetch(API_URL, {
          method: "POST",
          body: JSON.stringify({ action: "delete_sale", id })
        });
        if (!response.ok) throw new Error(`Ventas HTTP ${response.status}`);
        const result = await response.json();
        if (!result.success) throw new Error(result.message || "Venta no eliminada");
      } catch (error) {
        failures.push({ id, error });
      }
    });

    if (failures.length) {
      const failedIds = new Set(failures.map(failure => String(failure.id)));
      clearInventoryUiStateForSales(
        salesToDelete.filter(sale => failedIds.has(String(sale.id)))
      );
    }

    invalidateSalesCache();
    await Promise.all([
      cargarVentas({ force: true, silent: true }),
      cargarInventario({ silent: true })
    ]);
    ventasKPIContainer.dataset.force = "1";
    await actualizarKPIVentas();

    if (failures.length) {
      showToast(`No se pudieron eliminar ${failures.length} venta(s)`);
    } else {
      showToast("Sistema de ventas limpio");
    }
  } finally {
    button?.classList.remove("is-syncing");
    if (button) {
      button.disabled = false;
      delete button.dataset.busy;
    }
  }
};

/* ==================================================
   👀 OBSERVADOR: BOTÓN VENDER SELECCIONADOS (FLOAT)
================================================== */
document.addEventListener("DOMContentLoaded", () => {

  const btnNormal = document.getElementById("btnSellCart");
  const btnFloating = document.getElementById("btnSellFloating");

  const badgeNormal = document.getElementById("sellCartBadge");
  const badgeFloating = document.getElementById("sellFloatingBadge");

  const headerActions = document.querySelector(".page-actions");

  if (!btnNormal || !btnFloating || !badgeNormal || !badgeFloating || !headerActions) {
    console.warn("Botón vender / badges no encontrados");
    return;
  }

  /* =========================
     🔁 SINCRONIZAR BADGE FLOAT
  ========================= */
  window.syncSellBadge = function () {
    const value = parseInt(badgeNormal.textContent, 10) || 0;

    badgeFloating.textContent = value;

    if (value <= 0) {
      badgeFloating.classList.add("hidden");
      btnFloating.classList.remove(
        "has-items",
        "glow",
        "nebula"
      );
      return;
    }

    // mostrar badge
    badgeFloating.classList.remove("hidden");

    // 🔮 activar modo místico
    btnFloating.classList.add("has-items", "glow", "nebula");

    // ✨ bump animado
    badgeFloating.classList.remove("bump");
    void badgeFloating.offsetWidth;
    badgeFloating.classList.add("bump");
  };

  /* =========================
     👁️ OBSERVER VISIBILIDAD
  ========================= */
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        btnFloating.classList.add("hidden");
      } else {
        btnFloating.classList.remove("hidden");
        syncSellBadge(); // asegura estado correcto
      }
    },
    { threshold: 0.15 }
  );

  observer.observe(headerActions);
});

/* =============================================================================================================================
   MODAL: PRENDAS RECIENTES (AGREGADAS O MODIFICADAS)
============================================================================================================================= */

function openRecentProductsModal(hours = 48) {
  const modal = document.getElementById("recentProductsModal");
  if (!modal) return;

  modal.classList.remove("hidden");
  renderRecentProducts(hours);
}

function closeRecentProductsModal() {
  document.getElementById("recentProductsModal")?.classList.add("hidden");
}


// RENDERIZA PRODUCTOS MODIFICADOS / AGREGADOS EN LAS ÚLTIMAS X HORAS
function renderRecentProducts(hours = 48) {
  const tbody = document.getElementById("recentProductsTbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!Array.isArray(window.inventario)) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align:center; opacity:.6">
          Inventario no disponible
        </td>
      </tr>
    `;
    return;
  }

  const now = Date.now();
  const limit = hours * 60 * 60 * 1000;

  const dias = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
  const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

  const recientes = window.inventario.filter(p => {
    if (!p.fecha) return false;
    const fechaProducto = new Date(p.fecha).getTime();
    return now - fechaProducto <= limit;
  });

  if (!recientes.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align:center; opacity:.6">
          No hay prendas recientes
        </td>
      </tr>
    `;
    updateNotesBadge(0);
    return;
  }

  recientes.forEach(p => {
    const fecha = new Date(p.fecha);

    const diaSemana = dias[fecha.getDay()];
    const dia = fecha.getDate();
    const mes = meses[fecha.getMonth()];
    const año = fecha.getFullYear();

    let horas = fecha.getHours();
    const minutos = fecha.getMinutes().toString().padStart(2, "0");
    const ampm = horas >= 12 ? "PM" : "AM";

    horas = horas % 12 || 12;

    const fechaBonita = `${diaSemana} ${dia} ${mes} ${año} ${horas}:${minutos} ${ampm}`;

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td class="recent-product-name">${p.nombre}</td>
      <td>${p.marca}</td>
      <td style="text-align:right;">${Number(p.stock) || 0}</td>
      <td style="text-align:center; color:#39ff14;">${p.vendidos}</td>
      <td>
        <div class="recent-date">
          <span>${fechaBonita}</span>
          <span class="badge-new">Nuevo</span>
        </div>
      </td>
    `;

    tbody.appendChild(tr);
  });

  updateNotesBadge(recientes.length);
}



// BADGE VERDE DE NOTAS
function updateNotesBadge(count) {
  const badges = document.querySelectorAll(".js-notes-badge");

  badges.forEach(badge => {
    badge.textContent = count;
    badge.classList.toggle("hidden", count === 0);
  });
}


/* ==================================================
   EXPORTAR TABLA INVENTARIO A PDF (HTML REAL)
================================================== */

/* ==================================================
   EXPORTAR INVENTARIO A PDF (HTML PURO)
================================================== */

/* ==================================================
   EXPORTAR INVENTARIO A PDF (HTML PURO - BLANCO)
================================================== */

function exportInventoryTablePDF() {
  const table = document.getElementById("inventoryTable");

  if (!table) {
    window.platformAlert("No se pudo exportar", "No se encontró la tabla de inventario.", "error");
    return;
  }

  // 🔹 Clonamos la tabla
  const tableClone = table.cloneNode(true);

  // 🔹 Quitamos columnas que no sirven en PDF
  stripPdfColumns(tableClone);

  // 🔹 Forzamos estilos de tabla para PDF
  tableClone.style.width = "100%";
  tableClone.style.borderCollapse = "collapse";
  tableClone.style.background = "#ffffff";
  tableClone.style.color = "#000000";

  tableClone.querySelectorAll("th, td").forEach(cell => {
    cell.style.color = "#000";
    cell.style.background = "#fff";
    cell.style.border = "1px solid #ccc";
    cell.style.fontSize = "12px";
    cell.style.padding = "6px 8px";
  });

  tableClone.querySelectorAll("th").forEach(th => {
    th.style.background = "#f2f2f2";
    th.style.fontWeight = "600";
  });

  // 🔹 Contenedor PDF
  const pdfContainer = document.createElement("div");
  pdfContainer.style.background = "#ffffff";
  pdfContainer.style.color = "#000000";
  pdfContainer.style.padding = "20px";
  pdfContainer.style.fontFamily = "Arial, sans-serif";

  pdfContainer.innerHTML = `
    <h2 style="margin:0 0 4px 0; color:#000;">Inventario</h2>
    <div style="font-size:11px; color:#444; margin-bottom:12px;">
      Generado el ${new Date().toLocaleString("es-ES")}
    </div>
  `;

  pdfContainer.appendChild(tableClone);

  // 🔹 Configuración PDF
  const options = {
    margin: 0.4,
    filename: `Inventario_${new Date().toISOString().slice(0,10)}.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: {
      scale: 2,
      backgroundColor: "#ffffff"
    },
    jsPDF: {
      unit: "in",
      format: "letter",
      orientation: "landscape"
    }
  };

  html2pdf().set(options).from(pdfContainer).save();
}




function stripPdfColumns(table) {
  const headers = table.querySelectorAll("thead th");
  const removeIndexes = [];

  headers.forEach((th, index) => {
    const text = th.textContent.toLowerCase();
    if (
      th.querySelector("input") ||
      text.includes("acciones")
    ) {
      removeIndexes.push(index);
    }
  });

  table.querySelectorAll("tr").forEach(row => {
    [...removeIndexes].reverse().forEach(i => {
      if (row.children[i]) {
        row.children[i].remove();
      }
    });
  });
}


/* ==================================================
   EXPORTAR INVENTARIO A EXCEL (HTML REAL - FRONTEND)
================================================== */

function exportInventoryTableExcel() {
  const table = document.getElementById("inventoryTable");

  if (!table) {
    window.platformAlert("No se pudo exportar", "No se encontró la tabla de inventario.", "error");
    return;
  }

  // 🔹 Clonamos la tabla original
  const tableClone = table.cloneNode(true);

  // 🔹 Quitamos columnas que no deben ir a Excel
  stripExcelColumns(tableClone);

  // 🔹 Creamos un libro de Excel
  const workbook = XLSX.utils.book_new();

  // 🔹 Convertimos la tabla HTML en una hoja
  const worksheet = XLSX.utils.table_to_sheet(tableClone, {
    raw: true
  });

  // 🔹 Ajuste automático del ancho de columnas
  const colWidths = [];
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  rows.forEach(row => {
    row.forEach((cell, i) => {
      const cellLength = cell ? cell.toString().length : 10;
      colWidths[i] = Math.max(colWidths[i] || 10, cellLength);
    });
  });

  worksheet["!cols"] = colWidths.map(w => ({ wch: w + 2 }));

  // 🔹 Nombre de la hoja
  XLSX.utils.book_append_sheet(workbook, worksheet, "Inventario");

  // 🔹 Nombre del archivo
  const fileName = `Inventario_${new Date().toISOString().slice(0, 10)}.xlsx`;

  // 🔹 Descarga automática
  XLSX.writeFile(workbook, fileName);
}


/* ==================================================
   ELIMINAR COLUMNAS NO NECESARIAS PARA EXCEL
================================================== */

function stripExcelColumns(table) {
  const headers = table.querySelectorAll("thead th");
  const removeIndexes = [];

  headers.forEach((th, index) => {
    const text = th.textContent.toLowerCase();

    if (
      th.querySelector("input") || // columnas con inputs
      text.includes("acciones")    // columna acciones
    ) {
      removeIndexes.push(index);
    }
  });

  table.querySelectorAll("tr").forEach(row => {
    [...removeIndexes].reverse().forEach(i => {
      if (row.children[i]) {
        row.children[i].remove();
      }
    });
  });
}


/* ==================================================
   EXPORTAR TABLA VENTAS A PDF
================================================== */
function exportSalesTablePDF() {
  const table = document.getElementById("salesTable");

  if (!table) {
    window.platformAlert("No se pudo exportar", "No se encontró la tabla de ventas.", "error");
    return;
  }

  const tableClone = table.cloneNode(true);
  stripSalesPdfColumns(tableClone);

  /* === ESTILOS GENERALES === */
  tableClone.style.width = "100%";
  tableClone.style.borderCollapse = "collapse";
  tableClone.style.background = "#ffffff";
  tableClone.style.color = "#000000";
  tableClone.style.tableLayout = "fixed";

  tableClone.querySelectorAll("th, td").forEach(cell => {
    cell.style.border = "1px solid #ccc";
    cell.style.fontSize = "11px";
    cell.style.padding = "6px";
    cell.style.color = "#000";
    cell.style.background = "#fff";
    cell.style.overflowWrap = "break-word";
  });

  tableClone.querySelectorAll("th").forEach(th => {
    th.style.background = "#f2f2f2";
    th.style.fontWeight = "600";
  });

  /* === FORZAR SALTO DE LÍNEA EN PRODUCTO Y FECHA === */
  const headers = tableClone.querySelectorAll("thead th");
  let productoIndex = -1;
  let fechaIndex = -1;

  headers.forEach((th, index) => {
    const text = th.textContent.toLowerCase();
    if (text.includes("producto")) productoIndex = index;
    if (text.includes("fecha")) fechaIndex = index;
  });

  tableClone.querySelectorAll("tbody tr").forEach(row => {
    if (row.children[productoIndex]) {
      row.children[productoIndex].style.whiteSpace = "normal";
      row.children[productoIndex].style.wordBreak = "break-word";
      row.children[productoIndex].style.lineHeight = "1.3";
    }
    if (row.children[fechaIndex]) {
      row.children[fechaIndex].style.whiteSpace = "normal";
      row.children[fechaIndex].style.wordBreak = "break-word";
      row.children[fechaIndex].style.lineHeight = "1.3";
    }
  });

  /* === CONTENEDOR PDF === */
  const pdfContainer = document.createElement("div");
  pdfContainer.style.padding = "20px";
  pdfContainer.style.fontFamily = "Arial, sans-serif";
  pdfContainer.style.background = "#ffffff";
  pdfContainer.style.color = "#000000";
  pdfContainer.style.overflow = "visible";

  pdfContainer.innerHTML = `
    <h2 style="margin-bottom:4px;">Ventas</h2>
    <div style="font-size:11px; margin-bottom:12px;">
      Generado el ${new Date().toLocaleString("es-ES")}
    </div>
  `;

  pdfContainer.appendChild(tableClone);

  /* === EXPORT === */
  html2pdf().set({
    margin: [0.6, 0.4, 0.6, 0.4],
    filename: `Ventas_${new Date().toISOString().slice(0,10)}.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true
    },
    jsPDF: {
      unit: "in",
      format: "letter",
      orientation: "landscape"
    }
  }).from(pdfContainer).save();
}


function stripSalesPdfColumns(table) {
  const headers = table.querySelectorAll("thead th");
  const removeIndexes = [];

  headers.forEach((th, index) => {
    const text = th.textContent.toLowerCase();
    if (text.includes("acciones")) {
      removeIndexes.push(index);
    }
  });

  table.querySelectorAll("tr").forEach(row => {
    [...removeIndexes].reverse().forEach(i => {
      if (row.children[i]) row.children[i].remove();
    });
  });
}


/* ==================================================
   EXPORTAR TABLA VENTAS A EXCEL
================================================== */
function exportSalesTableExcel() {
  const table = document.getElementById("salesTable");

  if (!table) {
    window.platformAlert("No se pudo exportar", "No se encontró la tabla de ventas.", "error");
    return;
  }

  const tableClone = table.cloneNode(true);

  stripSalesExcelColumns(tableClone);

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.table_to_sheet(tableClone, { raw: true });

  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  worksheet["!cols"] = rows[0].map((_, i) => ({ wch: 18 }));

  XLSX.utils.book_append_sheet(workbook, worksheet, "Ventas");

  XLSX.writeFile(
    workbook,
    `Ventas_${new Date().toISOString().slice(0,10)}.xlsx`
  );
}


function stripSalesExcelColumns(table) {
  const headers = table.querySelectorAll("thead th");
  const removeIndexes = [];

  headers.forEach((th, index) => {
    const text = th.textContent.toLowerCase();
    if (text.includes("acciones")) {
      removeIndexes.push(index);
    }
  });

  table.querySelectorAll("tr").forEach(row => {
    [...removeIndexes].reverse().forEach(i => {
      if (row.children[i]) row.children[i].remove();
    });
  });
}




/* ==================================================
   GUARDAR MENSAJE / SITUACIÓN DEL DÍA
================================================== */

async function guardarSituacion(event) {
  
  // 🔹 Referencias a los campos del formulario
  const textareaMensaje = document.getElementById("mensajeTexto");
  const selectTipo = document.getElementById("mensajeTipo");
  const selectImportancia = document.getElementById("mensajeImportancia");

  // 🔹 Valores actuales
  const mensaje = textareaMensaje.value.trim();
  const tipo = selectTipo.value;
  const importancia = selectImportancia.value;

  // 🔹 Validación básica
  if (!mensaje) {
    window.platformAlert("Falta el mensaje", "Escribe una situación antes de guardar.", "warning");
    textareaMensaje.focus();
    return;
  }

  // 🔹 Payload EN JSON (CLAVE)
  const payload = {
    action: "add_situacion",
    mensaje: mensaje,
    tipo: tipo,
    importancia: importancia,
    autor: "Trabajador" // 👉 luego puedes hacerlo dinámico
  };

  try {
    // 🔹 Llamada al backend (Apps Script)
    const response = await fetch(API_URL, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    // 🔹 Resultado
    if (result.success) {
      Swal.fire({
        icon: "success",
        title: "Guardado",
        text: "La situación fue registrada correctamente",
        timer: 1800,
        showConfirmButton: false
      });

      // 🔹 Limpiar formulario
      textareaMensaje.value = "";
      selectTipo.value = "Nota";
      selectImportancia.value = "1";

      // 🔹 Cerrar modal
      closeMessagesModal();

      // 👉 aquí luego puedes refrescar la lista
      // loadSituacionesDelDia();

    } else {
      throw new Error(result.message || "Error desconocido");
    }

  } catch (error) {
    console.error("Error al guardar situación:", error);

    Swal.fire({
      icon: "error",
      title: "Error",
      text: "No se pudo guardar la situación"
    });
  }
}



/* ==================================================
   MODAL MENSAJES / SITUACIONES
================================================== */

function openMessagesModal() {
  const modal = document.getElementById("messagesModal");
  modal.classList.remove("hidden");

  mostrarFormularioSituacion();
}

function closeMessagesModal() {
  document.getElementById("messagesModal").classList.add("hidden");
}

function mostrarFormularioSituacion() {
  document.getElementById("mensajeFormView").classList.remove("hidden");
  document.getElementById("mensajeTableView").classList.add("hidden");
}

function mostrarTablaSituaciones() {
  document.getElementById("mensajeFormView").classList.add("hidden");
  document.getElementById("mensajeTableView").classList.remove("hidden");
}


async function cargarSituaciones() {
  const res = await fetch(`${API_URL}?action=list_situaciones`);
  const json = await res.json();

  if (!json.success) return;

  const tbody = document.getElementById("situacionesTableBody");
  tbody.innerHTML = "";

  json.data.forEach(s => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${s.mensaje}</td>
      <td>${s.fecha}</td>
      <td>${s.hora}</td>
      <td>
        <button class="danger ghost"
          onclick="eliminarSituacion('${s.id}')">
          🗑️
        </button>
      </td>
    `;

    tbody.appendChild(tr);
  });
}


function closeMessagesModal() {
  const modal = document.getElementById("messagesModal");
  if (!modal) return;

  modal.classList.add("hidden");
}

// Referencias
const messagesModal = document.getElementById('messagesModal');
const cancelBtn = document.getElementById('cancelMessageBtn');

// Compatibilidad con versiones anteriores del modal.
if (cancelBtn) {
  cancelBtn.addEventListener('click', closeMessagesModal);
}

// (Opcional) Cerrar al hacer click fuera de la tarjeta
messagesModal?.addEventListener('click', (e) => {
  if (e.target === messagesModal) closeMessagesModal();
});


// ==================================================
// HISTORIAL DE SITUACIONES (DESDE BACKEND)
// ==================================================

// ==================================================
// HISTORIAL DE SITUACIONES (DESDE BACKEND + UI SMART)
// ==================================================

let historialData = []; // datos ya interpretados para UI

// --------------------------------------------------
// Mostrar / ocultar panel historial
// --------------------------------------------------
function toggleHistorial() {
  mostrarTablaSituaciones();
  cargarSituaciones();
}


// --------------------------------------------------
// Obtener situaciones desde Apps Script
// --------------------------------------------------
async function cargarHistorial() {
  try {
    const res = await fetch(`${API_URL}?action=list_situaciones`);
    const json = await res.json();

    if (!json.success || !Array.isArray(json.data)) {
      console.error("Respuesta inválida del backend", json);
      historialData = [];
      renderHistorial();
      return;
    }

    // 👉 interpretación inteligente AQUÍ
    historialData = json.data.map(interpretarSituacion);

    renderHistorial();

  } catch (err) {
    console.error("Error de conexión", err);
    historialData = [];
    renderHistorial();
  }
}

// --------------------------------------------------
// Interpretar una situación (backend → UI)
// --------------------------------------------------
function interpretarSituacion(raw) {
  return {
    id: raw.id,
    mensaje: limpiarTexto(raw.mensaje),
    tipo: interpretarTipo(raw.tipo),
    importancia: interpretarImportancia(raw.importancia),
    fecha: interpretarFecha(raw.fecha, raw.hora)
  };
}

// --------------------------------------------------
// Helpers de interpretación
// --------------------------------------------------
function limpiarTexto(texto) {
  if (!texto || typeof texto !== "string") return "—";
  return texto.trim();
}

function interpretarTipo(tipo) {
  const map = {
    Nota: "📝 Nota",
    Venta: "💰 Venta",
    Problema: "⚠️ Problema",
    Cliente: "👤 Cliente",
    Decisión: "📌 Decisión"
  };
  return map[tipo] || "—";
}

function interpretarImportancia(valor) {
  if (valor == 3) return "🔴 Alta";
  if (valor == 2) return "🟡 Media";
  if (valor == 1) return "🟢 Baja";
  return "—";
}

function interpretarFecha(fecha, hora) {
  if (!fecha) return "—";

  const d = new Date(fecha);
  if (isNaN(d)) return "—";

  const fechaTexto = d.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });

  return hora ? `${fechaTexto} · ${hora}` : fechaTexto;
}

// --------------------------------------------------
// Renderizar tabla
// --------------------------------------------------
function renderHistorial() {
  const tbody = document.getElementById("historialBody");
  tbody.innerHTML = "";

  if (!historialData || historialData.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center; opacity:.6;">
          No hay situaciones registradas
        </td>
      </tr>
    `;
    return;
  }

  historialData.forEach(item => {
    tbody.innerHTML += `
      <tr>
        <td>${item.mensaje}</td>
        <td>${item.tipo}</td>
        <td>${item.importancia}</td>
        <td>${item.fecha}</td>
        <td>
          <button
            class="delete-btn"
            onclick="eliminarSituacion('${item.id}')"
            title="Eliminar"
          >
            🗑️
          </button>
        </td>
      </tr>
    `;
  });
}

// --------------------------------------------------
// Eliminar situación
// --------------------------------------------------
async function eliminarSituacion(id) {
  const { isConfirmed } = await Swal.fire({
    title: "Eliminar situación",
    text: "Esta acción no se puede deshacer",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Eliminar",
    cancelButtonText: "Cancelar"
  });

  if (!isConfirmed) return;

  await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "delete_situacion",
      id
    })
  });

  cargarSituaciones();
}



// ================================
// MODAL HISTORIAL SITUACIONES
// ================================
function openSituacionesModal() {
  document.getElementById("situacionesModal").classList.remove("hidden");

  // cargar una sola vez
  const panel = document.getElementById("situacionesModal");
  if (!panel.classList.contains("loaded")) {
    cargarHistorial();
    panel.classList.add("loaded");
  }
}

function closeSituacionesModal() {
  document.getElementById("situacionesModal").classList.add("hidden");
}




// function buildPdfHtmlDocument(tableHtml) {
//   const today = new Date().toLocaleDateString("es-ES");

//   return `
// <!DOCTYPE html>
// <html lang="es">
// <head>
// <meta charset="UTF-8">
// <title>Inventario PDF</title>
// <style>
//   body {
//     font-family: Inter, Arial, sans-serif;
//     padding: 20px;
//   }
//   h1 {
//     font-size: 18px;
//     margin-bottom: 6px;
//   }
//   .meta {
//     font-size: 12px;
//     color: #666;
//     margin-bottom: 14px;
//   }
//   table {
//     width: 100%;
//     border-collapse: collapse;
//     font-size: 12px;
//   }
//   th {
//     background: #f2f2f2;
//     text-align: left;
//     padding: 6px;
//     border-bottom: 1px solid #ccc;
//   }
//   td {
//     padding: 6px;
//     border-bottom: 1px solid #e0e0e0;
//   }
// </style>
// </head>
// <body>

// <h1>Inventario – Exportación PDF</h1>
// <div class="meta">Generado el ${today}</div>

// ${tableHtml}

// </body>
// </html>
// `;
// }



/* ======================
   TOAST NEÓN (ESTILOS EN JS)
====================== */
// (function injectToastStyles() {
//   if (document.getElementById("toastStyles")) return;

//   const style = document.createElement("style");
//   style.id = "toastStyles";
//   style.innerHTML = `
//     .toast {
//       position: fixed;
//       bottom: 24px;
//       left: 50%;
//       transform: translateX(-50%) translateY(20px);
//       background: linear-gradient(135deg, #0a84ff, #0066ff);
//       color: white;
//       padding: 14px 22px;
//       border-radius: 16px;
//       font-weight: 600;
//       font-size: 14px;
//       box-shadow: 0 10px 30px rgba(10,132,255,0.45);
//       opacity: 0;
//       transition: all 0.3s ease;
//       z-index: 10000; /* MÁS QUE EL MODAL */
//       pointer-events: none;
//       isolation: isolate;
//     }

//     .toast.show {
//       opacity: 1;
//       transform: translateX(-50%) translateY(0);
//     }
//   `;
//   document.head.appendChild(style);
// })();


// function showToast(message) {
//   const toast = document.createElement("div");
//   toast.className = "toast";
//   toast.textContent = message;

//   document.body.appendChild(toast);

//   requestAnimationFrame(() => {
//     toast.classList.add("show");
//   });

//   setTimeout(() => {
//     toast.classList.remove("show");
//     setTimeout(() => toast.remove(), 300);
//   }, 3000);
// }









