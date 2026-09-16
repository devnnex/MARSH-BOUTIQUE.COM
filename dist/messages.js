/* Mensajes del día: almacenamiento local, aislado de la lógica del backend. */
(() => {
  "use strict";

  const STORAGE_KEY = "marsh_daily_messages_v1";
  const TYPES = {
    Nota: { icon: "✦", className: "is-note" },
    Venta: { icon: "$", className: "is-sale" },
    Problema: { icon: "!", className: "is-problem" },
    Cliente: { icon: "●", className: "is-client" },
    Decisión: { icon: "✓", className: "is-decision" }
  };
  const PRIORITIES = {
    "1": { label: "Baja", className: "priority-low" },
    "2": { label: "Media", className: "priority-medium" },
    "3": { label: "Alta", className: "priority-high" }
  };

  let editingId = null;

  function readMessages() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn("No fue posible leer los mensajes locales", error);
      return [];
    }
  }

  function writeMessages(messages) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
      return true;
    } catch (error) {
      console.error("No fue posible guardar los mensajes locales", error);
      window.showToast?.("No se pudo guardar el mensaje en este dispositivo");
      return false;
    }
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>'"]/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;"
    })[character]);
  }

  function createId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `message-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function formatDateTime(isoDate) {
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return "Fecha no disponible";
    return new Intl.DateTimeFormat("es-CO", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date);
  }

  function setupMessagesUI() {
    const modal = document.getElementById("messagesModal");
    if (!modal) return;

    modal.innerHTML = `
      <div class="modal-card messages-premium-card" role="dialog" aria-modal="true" aria-labelledby="messagesTitle">
        <header class="messages-header">
          <div>
            <span class="messages-eyebrow">Guardado en este dispositivo</span>
            <h2 id="messagesTitle">Mensajes del día</h2>
          </div>
          <button type="button" class="messages-close" onclick="closeMessagesModal()" aria-label="Cerrar">×</button>
        </header>

        <nav class="messages-tabs" aria-label="Vistas de mensajes">
          <button type="button" class="message-tab active" id="messageNewTab" onclick="mostrarFormularioSituacion()">Nuevo mensaje</button>
          <button type="button" class="message-tab" id="messageHistoryTab" onclick="mostrarTablaSituaciones()">
            Historial <span class="messages-count" id="messagesCount">0</span>
          </button>
        </nav>

        <form id="mensajeFormView" class="message-form" onsubmit="guardarSituacion(event)">
          <input type="hidden" id="mensajeEditId">

          <div class="field-group message-copy-field">
            <label for="mensajeTexto">Mensaje</label>
            <textarea id="mensajeTexto" rows="5" maxlength="600" placeholder="Escribe una nota, novedad o decisión..." required></textarea>
            <div class="message-field-meta"><span>Solo se guarda en este equipo</span><span id="messageCharacterCount">0/600</span></div>
          </div>

          <div class="field-row">
            <div class="field-group">
              <label for="mensajeTipo">Categoría</label>
              <select id="mensajeTipo">
                <option value="Nota">Nota</option>
                <option value="Venta">Venta</option>
                <option value="Problema">Problema</option>
                <option value="Cliente">Cliente</option>
                <option value="Decisión">Decisión</option>
              </select>
            </div>

            <div class="field-group">
              <label for="mensajeImportancia">Prioridad</label>
              <select id="mensajeImportancia">
                <option value="1">Baja</option>
                <option value="2">Media</option>
                <option value="3">Alta</option>
              </select>
            </div>
          </div>

          <div class="message-preview" id="messageBadgePreview" aria-live="polite"></div>

          <div class="modal-actions">
            <button type="button" class="ghost" onclick="closeMessagesModal()">Cancelar</button>
            <button type="submit" id="saveMessageButton">Guardar mensaje</button>
          </div>
        </form>

        <section id="mensajeTableView" class="message-history hidden" aria-label="Historial de mensajes">
          <div class="messages-list-toolbar">
            <p id="messageHistorySummary">Mensajes guardados en este dispositivo</p>
            <button type="button" class="clear-messages" onclick="limpiarSituacionesLocales()">Limpiar todo</button>
          </div>
          <div id="situacionesList" class="messages-list"></div>
          <div class="modal-actions">
            <button type="button" class="primary" onclick="mostrarFormularioSituacion()">Nuevo mensaje</button>
          </div>
        </section>
      </div>
    `;

    const textarea = document.getElementById("mensajeTexto");
    const type = document.getElementById("mensajeTipo");
    const priority = document.getElementById("mensajeImportancia");

    textarea.addEventListener("input", updateMessagePreview);
    type.addEventListener("change", updateMessagePreview);
    priority.addEventListener("change", updateMessagePreview);
    modal.addEventListener("click", event => {
      if (event.target === modal) window.closeMessagesModal();
    });

    updateMessagePreview();
    updateMessagesCount();
  }

  function updateMessagePreview() {
    const textarea = document.getElementById("mensajeTexto");
    const typeValue = document.getElementById("mensajeTipo")?.value || "Nota";
    const priorityValue = document.getElementById("mensajeImportancia")?.value || "1";
    const type = TYPES[typeValue] || TYPES.Nota;
    const priority = PRIORITIES[priorityValue] || PRIORITIES["1"];
    const preview = document.getElementById("messageBadgePreview");
    const counter = document.getElementById("messageCharacterCount");

    if (counter) counter.textContent = `${textarea?.value.length || 0}/600`;
    if (!preview) return;

    preview.innerHTML = `
      <span class="message-badge ${type.className}"><span aria-hidden="true">${type.icon}</span>${escapeHTML(typeValue)}</span>
      <span class="priority-badge ${priority.className}">${priority.label}</span>
    `;
  }

  function resetMessageForm() {
    const form = document.getElementById("mensajeFormView");
    form?.reset();
    editingId = null;
    const editField = document.getElementById("mensajeEditId");
    if (editField) editField.value = "";
    const saveButton = document.getElementById("saveMessageButton");
    if (saveButton) saveButton.textContent = "Guardar mensaje";
    updateMessagePreview();
  }

  function updateMessagesCount() {
    const messages = readMessages();
    const count = document.getElementById("messagesCount");
    const floatingBadge = document.getElementById("messagesFloatingBadge");
    const summary = document.getElementById("messageHistorySummary");
    const value = messages.length;

    if (count) {
      count.textContent = String(value);
      count.classList.toggle("hidden", value === 0);
    }

    if (floatingBadge) {
      const previousValue = Number(floatingBadge.dataset.count || 0);
      floatingBadge.textContent = String(value);
      floatingBadge.dataset.count = String(value);
      floatingBadge.classList.toggle("hidden", value === 0);
      if (value > 0 && value !== previousValue) {
        floatingBadge.classList.remove("bump");
        requestAnimationFrame(() => floatingBadge.classList.add("bump"));
        window.setTimeout(() => floatingBadge.classList.remove("bump"), 400);
      }
    }

    if (summary) {
      summary.textContent = value === 1
        ? "1 mensaje guardado en este dispositivo"
        : `${value} mensajes guardados en este dispositivo`;
    }
  }

  function setActiveTab(view) {
    document.getElementById("messageNewTab")?.classList.toggle("active", view === "form");
    document.getElementById("messageHistoryTab")?.classList.toggle("active", view === "history");
  }

  window.openMessagesModal = function openMessagesModal() {
    const modal = document.getElementById("messagesModal");
    if (!modal) return;
    modal.style.removeProperty("display");
    modal.classList.remove("hidden");
    window.mostrarFormularioSituacion();
    requestAnimationFrame(() => document.getElementById("mensajeTexto")?.focus());
  };

  window.closeMessagesModal = function closeMessagesModal() {
    const modal = document.getElementById("messagesModal");
    if (!modal) return;
    modal.classList.add("hidden");
    resetMessageForm();
  };

  window.mostrarFormularioSituacion = function mostrarFormularioSituacion() {
    document.getElementById("mensajeFormView")?.classList.remove("hidden");
    document.getElementById("mensajeTableView")?.classList.add("hidden");
    setActiveTab("form");
  };

  window.volverFormularioSituacion = window.mostrarFormularioSituacion;

  window.mostrarTablaSituaciones = function mostrarTablaSituaciones() {
    document.getElementById("mensajeFormView")?.classList.add("hidden");
    document.getElementById("mensajeTableView")?.classList.remove("hidden");
    setActiveTab("history");
    renderLocalMessages();
  };

  window.toggleHistorial = window.mostrarTablaSituaciones;
  window.cargarSituaciones = renderLocalMessages;

  window.guardarSituacion = function guardarSituacion(event) {
    event?.preventDefault();

    const messageField = document.getElementById("mensajeTexto");
    const typeField = document.getElementById("mensajeTipo");
    const priorityField = document.getElementById("mensajeImportancia");
    const text = messageField?.value.trim();

    if (!text) {
      messageField?.focus();
      window.showToast?.("Escribe un mensaje antes de guardar");
      return false;
    }

    const messages = readMessages();
    const now = new Date().toISOString();

    if (editingId) {
      const index = messages.findIndex(message => message.id === editingId);
      if (index >= 0) {
        messages[index] = {
          ...messages[index],
          mensaje: text,
          tipo: typeField.value,
          importancia: priorityField.value,
          updatedAt: now
        };
      }
    } else {
      messages.push({
        id: createId(),
        mensaje: text,
        tipo: typeField.value,
        importancia: priorityField.value,
        createdAt: now,
        updatedAt: now
      });
    }

    if (!writeMessages(messages)) return false;

    window.showToast?.(editingId ? "Mensaje actualizado" : "Mensaje guardado en este dispositivo");
    resetMessageForm();
    updateMessagesCount();
    window.mostrarTablaSituaciones();
    return false;
  };

  function renderLocalMessages() {
    const list = document.getElementById("situacionesList");
    if (!list) return;

    const messages = readMessages()
      .slice()
      .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

    updateMessagesCount();

    if (!messages.length) {
      list.innerHTML = `
        <div class="messages-empty">
          <span aria-hidden="true">✦</span>
          <strong>Aún no hay mensajes</strong>
          <p>Las notas que guardes aparecerán aquí.</p>
        </div>
      `;
      return;
    }

    list.innerHTML = messages.map(message => {
      const type = TYPES[message.tipo] || TYPES.Nota;
      const priority = PRIORITIES[String(message.importancia)] || PRIORITIES["1"];
      const updated = message.updatedAt && message.updatedAt !== message.createdAt;

      return `
        <article class="message-item ${type.className}">
          <div class="message-item-topline">
            <div class="message-item-badges">
              <span class="message-badge ${type.className}"><span aria-hidden="true">${type.icon}</span>${escapeHTML(message.tipo)}</span>
              <span class="priority-badge ${priority.className}">${priority.label}</span>
            </div>
            <time datetime="${escapeHTML(message.updatedAt || message.createdAt)}">${formatDateTime(message.updatedAt || message.createdAt)}${updated ? " · editado" : ""}</time>
          </div>
          <p>${escapeHTML(message.mensaje)}</p>
          <div class="message-item-actions">
            <button type="button" class="message-edit" onclick="editarSituacionLocal('${escapeHTML(message.id)}')">Editar</button>
            <button type="button" class="message-delete" onclick="eliminarSituacion('${escapeHTML(message.id)}')">Eliminar</button>
          </div>
        </article>
      `;
    }).join("");
  }

  window.editarSituacionLocal = function editarSituacionLocal(id) {
    const message = readMessages().find(item => item.id === id);
    if (!message) return;

    editingId = id;
    document.getElementById("mensajeEditId").value = id;
    document.getElementById("mensajeTexto").value = message.mensaje;
    document.getElementById("mensajeTipo").value = message.tipo;
    document.getElementById("mensajeImportancia").value = String(message.importancia);
    document.getElementById("saveMessageButton").textContent = "Guardar cambios";
    updateMessagePreview();
    window.mostrarFormularioSituacion();
    requestAnimationFrame(() => document.getElementById("mensajeTexto")?.focus());
  };

  async function confirmAction(title, text) {
    if (window.platformConfirm) {
      return window.platformConfirm(title, text, "Confirmar");
    }
    window.showToast?.(`${title}. ${text}`);
    return false;
  }

  window.eliminarSituacion = async function eliminarSituacion(id) {
    const confirmed = await confirmAction("Eliminar mensaje", "Esta acción no se puede deshacer.");
    if (!confirmed) return;

    const messages = readMessages().filter(message => message.id !== id);
    if (!writeMessages(messages)) return;
    window.showToast?.("Mensaje eliminado");
    renderLocalMessages();
  };

  window.limpiarSituacionesLocales = async function limpiarSituacionesLocales() {
    const messages = readMessages();
    if (!messages.length) return;

    const confirmed = await confirmAction("Limpiar historial", "Se eliminarán todos los mensajes guardados en este dispositivo.");
    if (!confirmed) return;

    if (!writeMessages([])) return;
    window.showToast?.("Historial limpiado");
    renderLocalMessages();
  };

  setupMessagesUI();
  window.addEventListener("storage", event => {
    if (event.key !== STORAGE_KEY) return;
    updateMessagesCount();
    if (!document.getElementById("mensajeTableView")?.classList.contains("hidden")) {
      renderLocalMessages();
    }
  });
})();
