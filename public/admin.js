(function () {
  "use strict";

  const ADMIN_USERNAME = "admin";
  const ADMIN_PASSWORD = "admin123";
  const SESSION_KEY = "homeease_admin";

  let adminState = {
    loggedIn: false,
    tab: "dashboard",
    editingService: null,
    editingWorker: null,
    editingBooking: null,
    services: [],
    workers: [],
    bookings: [],
    stats: null,
    bookingFilter: "all",
  };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);
  const esc = (s) => {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  };

  let toastTimer = null;
  function showToast(message, icon) {
    const text = $("#toastText");
    const toast = $("#toast");
    if (!text || !toast) return;
    const cls = icon || "fa-check-circle";
    toast.classList.remove("is-success", "is-error", "is-info");
    if (/exclamation|times|xmark|ban|triangle|heartbreak/.test(cls)) toast.classList.add("is-error");
    else if (/cloud|qrcode|info|spinner|clock|satellite/.test(cls)) toast.classList.add("is-info");
    else toast.classList.add("is-success");
    const glyph = toast.querySelector(".toast-icon i");
    if (glyph) glyph.className = "fas " + cls;
    text.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 3400);
    toast.onclick = () => {
      clearTimeout(toastTimer);
      toast.classList.remove("show");
    };
  }

  // ── Google Apps Script backend (Google Sheets as DB) ──
  // Set the URL in public/config.js (window.SCRIPT_URL). All api() calls
  // below route through window.GAS (public/gas-api.js). No UI code changed.
  async function api(path, options) {
    if (!window.GAS) throw new Error("gas-api.js not loaded");
    try {
      return await window.GAS.api(path, options);
    } catch (e) {
      throw new Error((e && e.message) || "Request failed");
    }
  }

  // Read a File input as a base64 data-URL (Sheets can't receive multipart
  // uploads, so photos/ID cards are stored as data-URLs or https URLs).
  function readFileAsDataUrl(file) {
    return window.GAS
      ? window.GAS.fileToDataUrl(file)
      : Promise.reject(new Error("gas-api.js not loaded"));
  }

  function openModal(id) {
    const el = $("#" + id);
    if (!el) return;
    el.classList.remove("closing");
    el.classList.add("open");
    document.body.style.overflow = "hidden";
  }
  function closeModal(id) {
    const el = $("#" + id);
    if (!el) return;
    el.classList.remove("open");
    el.classList.add("closing");
    clearTimeout(el._closeTimer);
    el._closeTimer = setTimeout(() => el.classList.remove("closing"), 320);
    if (!document.querySelector(".modal.open")) document.body.style.overflow = "";
  }

  // Promise-based glass confirm dialog (replaces window.confirm).
  function confirmDialog(message, opts) {
    opts = opts || {};
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "confirm-overlay";
      overlay.innerHTML =
        '<div class="confirm-card" role="alertdialog" aria-modal="true" aria-label="' +
        esc(opts.title || "Are you sure?") + '">' +
        '<div class="confirm-icon"><i class="fas ' + (opts.icon || "fa-exclamation-triangle") + '"></i></div>' +
        '<h3 class="confirm-title">' + esc(opts.title || "Are you sure?") + "</h3>" +
        '<p class="confirm-text">' + esc(message) + "</p>" +
        '<div class="confirm-actions">' +
        '<button type="button" class="btn btn-glass" data-confirm="cancel"><i class="fas fa-times"></i> ' +
        esc(opts.cancelLabel || "Cancel") + "</button>" +
        '<button type="button" class="btn btn-danger" data-confirm="ok"><i class="fas ' +
        (opts.okIcon || "fa-trash-alt") + '"></i> ' + esc(opts.okLabel || "Delete") + "</button>" +
        "</div></div>";
      document.body.appendChild(overlay);

      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      let settled = false;
      const close = (value) => {
        if (settled) return;
        settled = true;
        document.removeEventListener("keydown", onKey);
        overlay.classList.add("closing");
        setTimeout(() => {
          overlay.remove();
          if (!document.querySelector(".modal.open, .confirm-overlay")) {
            document.body.style.overflow = prevOverflow;
          }
        }, 300);
        resolve(value);
      };
      const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); close(false); } };
      document.addEventListener("keydown", onKey);
      overlay.querySelector('[data-confirm="cancel"]').addEventListener("click", () => close(false));
      overlay.querySelector('[data-confirm="ok"]').addEventListener("click", () => close(true));
      overlay.addEventListener("click", (e) => { if (e.target === overlay) close(false); });
      overlay.querySelector('[data-confirm="ok"]').focus();
    });
  }

  async function loadAdminData() {
    const [services, workers, bookings, stats] = await Promise.all([
      safeFetch("/api/services", []),
      safeFetch("/api/workers", []),
      safeFetch("/api/bookings", []),
      safeFetch("/api/stats", null),
    ]);
    adminState.services = services;
    adminState.workers = workers;
    adminState.bookings = bookings;
    adminState.stats = stats;
  }

  function markBookingsRead() {
    const pending = Array.isArray(adminState.bookings)
      ? adminState.bookings.filter((b) => b.status === "pending").length : 0;
    try {
      localStorage.setItem("homeease_seen_pending", String(pending));
      localStorage.setItem("homeease_unread", "0");
    } catch (e) { /* ignore */ }
  }

  async function safeFetch(path, fallback) {
    try {
      const data = await api(path);
      return data;
    } catch (e) {
      return fallback;
    }
  }

  function serviceName(id) {
    if (!id) return "—";
    const s = adminState.services.find((x) => x.id === id);
    return s ? s.title : "—";
  }

  function bookingName(b) {
    const name = b && (b.user_name || b.customer_name || b.customerName || b.name || b.customer);
    return name ? esc(name) : "Guest User";
  }

  function bookingPhone(b) {
    const phone = b && (b.user_phone || b.customer_phone || b.customerPhone || b.phone);
    return phone ? esc(phone) : "—";
  }

  function bookingService(b) {
    if (!b) return "—";
    if (b.service_name) return esc(b.service_name);
    return esc(serviceName(b.service_id));
  }

  function bookingWorker(b) {
    if (!b) return "—";
    if (b.worker_name) return esc(b.worker_name);
    const w = b.worker_id ? adminState.workers.find((x) => String(x.id) === String(b.worker_id)) : null;
    if (w) return esc(w.name);
    return "Any Available / Unassigned";
  }

  function formatDateTime(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) +
      ", " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  }

  function bookingPlacedAt(b) {
    if (!b || !b.created_at) return "—";
    return formatDateTime(b.created_at);
  }

  function workerName(id) {
    const w = adminState.workers.find((x) => x.id === id);
    return w ? w.name : "Not Assigned";
  }

  const ADMIN_VISITING_FEE = 199;
  const ADMIN_FIXED_PRICE_CATEGORIES = ["cleaning"];

  function adminServicePricing(service) {
    const category = String((service && service.category) || "").toLowerCase();
    const inspection = ADMIN_FIXED_PRICE_CATEGORIES.indexOf(category) === -1;
    return {
      bookingType: inspection ? "inspection" : "fixed",
      amount: inspection ? ADMIN_VISITING_FEE : Number(service && service.price) || 0,
      visitingFee: inspection ? ADMIN_VISITING_FEE : 0,
    };
  }

  const STATUS_COLORS = {
    pending: "#feca57",
    assigned: "#00d2ff",
    completed: "#00f5a0",
    cancelled: "#ff6b6b",
  };

  const SKILL_LEVEL_COLORS = {
    beginner: "#feca57",
    intermediate: "#00d2ff",
    expert: "#00f5a0",
  };

  const WORKER_STATUS_COLORS = {
    active: "#00f5a0",
    inactive: "#ff6b6b",
    on_leave: "#feca57",
  };

  function erpTabTitle(tab) {
    return {
      dashboard: "Dashboard Overview",
      services: "Service Management",
      workers: "Labor Directory",
      bookings: "Bookings & Orders",
    }[tab] || "Admin";
  }

  // ── Screen management ──
  function showLogin() {
    adminState.loggedIn = false;
    const layout = $("#erpLayout");
    if (layout) layout.classList.add("hidden");
    const login = $("#loginScreen");
    if (login) login.classList.remove("hidden");
  }

  async function enterDashboard() {
    const login = $("#loginScreen");
    const layout = $("#erpLayout");
    if (login) login.classList.add("hidden");
    if (layout) layout.classList.remove("hidden");
    try {
      await loadAdminData();
    } catch (e) {
      showToast(e.message, "fa-exclamation-circle");
    }
    showTab(adminState.tab);
  }

  function showTab(tab) {
    adminState.tab = tab;
    const sections = { dashboard: "tabDashboard", services: "tabServices", workers: "tabWorkers", bookings: "tabBookings" };
    Object.entries(sections).forEach(([key, id]) => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle("hidden", key !== tab);
    });
    $$(".erp-nav-item").forEach((n) => n.classList.toggle("active", n.dataset.erpTab === tab));
    if (tab === "bookings" || tab === "dashboard") markBookingsRead();
    const title = $("#erpTopbarTitle");
    if (title) title.textContent = erpTabTitle(tab);
    const sidebar = $("#erpSidebar");
    if (sidebar) sidebar.classList.remove("open");
    renderErpTab();
  }

  function renderErpTab() {
    if (adminState.tab === "dashboard") renderDashboardTab();
    else if (adminState.tab === "services") renderServicesTab();
    else if (adminState.tab === "workers") renderWorkersTab();
    else if (adminState.tab === "bookings") renderBookingsTab();
  }

  // ── Dashboard Tab ──
  function renderDashboardTab() {
    const container = $("#tabDashboard");
    if (!container) return;
    const s = adminState.stats || {
      totalRevenue: 0, totalBookings: 0, activeWorkers: 0, avgOrderValue: 0,
      totalServices: 0, totalReviews: 0, bookingsByStatus: { pending: 0, assigned: 0, completed: 0, cancelled: 0 },
    };
    const bStatus = s.bookingsByStatus || {};
    const statusKeys = ["pending", "assigned", "completed", "cancelled"];
    const maxCount = Math.max(1, ...statusKeys.map((k) => bStatus[k] || 0));

    container.innerHTML = `
      <div class="stats-grid">
        <div class="glass-card stat-card">
          <div class="stat-card-icon revenue"><i class="fas fa-rupee-sign"></i></div>
          <div>
            <div class="stat-card-value">₹${Number(s.totalRevenue).toLocaleString()}</div>
            <div class="stat-card-label">Total Revenue</div>
          </div>
        </div>
        <div class="glass-card stat-card">
          <div class="stat-card-icon bookings"><i class="fas fa-calendar-check"></i></div>
          <div>
            <div class="stat-card-value">${s.totalBookings}</div>
            <div class="stat-card-label">Total Bookings</div>
          </div>
        </div>
        <div class="glass-card stat-card">
          <div class="stat-card-icon workers"><i class="fas fa-users"></i></div>
          <div>
            <div class="stat-card-value">${s.activeWorkers}</div>
            <div class="stat-card-label">Active Workers</div>
          </div>
        </div>
        <div class="glass-card stat-card">
          <div class="stat-card-icon aov"><i class="fas fa-chart-line"></i></div>
          <div>
            <div class="stat-card-value">₹${s.avgOrderValue}</div>
            <div class="stat-card-label">Avg Order Value</div>
          </div>
        </div>
      </div>

      <div class="erp-dash-grid">
        <div class="glass-card erp-card">
          <div class="erp-card-head">
            <h3><i class="fas fa-chart-bar" style="color:var(--secondary)"></i> Booking Status</h3>
            <span class="erp-card-sub">Distribution</span>
          </div>
          <div class="chart-wrap">
            ${statusKeys.map((k) => {
              const count = bStatus[k] || 0;
              const pct = Math.round((count / maxCount) * 100);
              const color = STATUS_COLORS[k];
              return `
                <div class="chart-row">
                  <span class="chart-label">${esc(k[0].toUpperCase() + k.slice(1))}</span>
                  <div class="chart-bar-track"><div class="chart-bar" style="width:${pct}%;background:${color};"></div></div>
                  <span class="chart-value">${count}</span>
                </div>
              `;
            }).join("")}
          </div>
        </div>
        <div class="glass-card erp-card">
          <div class="erp-card-head">
            <h3><i class="fas fa-layer-group" style="color:var(--accent)"></i> Service Categories</h3>
            <span class="erp-card-sub">${adminState.services.length} total</span>
          </div>
          <div class="cat-card-grid">
            ${adminState.services.map((svc) => {
              const icon = svc.icon || "fa-tools";
              const count = adminState.workers.filter((w) => w.service_id === svc.id && w.status !== "inactive").length;
              return `
                <div class="cat-card" onclick="selectErpTab('workers')">
                  <div class="cat-card-icon"><i class="fas ${esc(icon)}"></i></div>
                  <div class="cat-card-name">${esc(svc.title)}</div>
                  <div class="cat-card-count">${count} worker${count === 1 ? "" : "s"}</div>
                </div>
              `;
            }).join("")}
          </div>
        </div>
      </div>

      <div class="glass-card erp-card">
        <div class="erp-card-head">
          <h3><i class="fas fa-bolt" style="color:var(--warning)"></i> Recent Bookings</h3>
          <button class="btn btn-primary btn-sm" id="dashAllBookings"><i class="fas fa-list"></i> View All</button>
        </div>
        <div class="table-wrap">
          <table class="erp-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Service</th>
                <th>Worker / Technician</th>
                <th>Booked On</th>
                <th>Date</th>
                <th>Time</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody id="dashBookingRows"></tbody>
          </table>
        </div>
      </div>
    `;

    const viewAll = $("#dashAllBookings");
    if (viewAll) viewAll.addEventListener("click", () => showTab("bookings"));

    const rows = $("#dashBookingRows");
    rows.innerHTML = "";
    adminState.bookings.slice(0, 6).forEach((b) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>
          <div class="td-strong">${bookingName(b)}</div>
          <div class="td-phone">${bookingPhone(b)}</div>
        </td>
        <td>${bookingService(b)}</td>
        <td>${bookingWorker(b)}</td>
        <td class="td-sub">${bookingPlacedAt(b)}</td>
        <td>${esc(b.booking_date)}</td>
        <td>${esc(b.booking_time)}</td>
        <td class="td-rupee">₹${Number(b.amount || 0).toLocaleString()}</td>
        <td><span class="status-pill" style="background:${STATUS_COLORS[b.status] || "#888"}22;color:${STATUS_COLORS[b.status] || "#888"};border-color:${STATUS_COLORS[b.status] || "#888"}55;">${esc(b.status)}</span></td>
      `;
      rows.appendChild(tr);
    });
    if (!adminState.bookings.length) {
      rows.innerHTML = `<tr><td colspan="8" class="td-empty">No bookings yet.</td></tr>`;
    }
  }

  // ── Services Tab ──
  function renderServicesTab() {
    const container = $("#tabServices");
    if (!container) return;
    container.innerHTML = `
      <div class="erp-toolbar">
        <div class="erp-actions">
          <h3><i class="fas fa-plus-circle" style="color:var(--accent)"></i> Service Manager</h3>
        </div>
      </div>
      <div class="erp-grid-2">
        <div class="glass-card erp-card">
          <div class="erp-card-head"><h3>${adminState.editingService ? "Edit Service" : "New Service"}</h3></div>
          <form id="serviceForm">
            <input type="hidden" id="svcId">
            <div class="form-grid-2">
              <div class="form-group">
                <label>Title</label>
                <input type="text" class="text-input" id="svcTitle" placeholder="e.g. Home Cleaning" required>
              </div>
              <div class="form-group">
                <label>Category (slug)</label>
                <input type="text" class="text-input" id="svcCategory" placeholder="e.g. cleaning" required>
              </div>
            </div>
            <div class="form-group">
              <label>Description</label>
              <textarea class="text-input" id="svcDesc" rows="3" placeholder="Short service description" required></textarea>
            </div>
            <div class="form-grid-2">
              <div class="form-group">
                <label>Price (₹)</label>
                <input type="number" class="text-input" id="svcPrice" min="0" step="1" placeholder="e.g. 499" required>
              </div>
              <div class="form-group">
                <label>Font Awesome Icon</label>
                <input type="text" class="text-input" id="svcIcon" placeholder="e.g. fa-broom" required>
              </div>
            </div>
            <div class="form-group">
              <label>Service Image URL</label>
              <input type="url" class="text-input" id="svcImage" placeholder="https://images.unsplash.com/photo-...">
            </div>
            <button type="submit" class="btn btn-primary btn-full" id="serviceSubmitBtn"><i class="fas fa-save"></i> Save Service</button>
          </form>
        </div>
        <div class="glass-card erp-card">
          <div class="erp-card-head">
            <h3>All Services</h3>
            <button class="btn btn-primary btn-sm" id="newServiceBtn"><i class="fas fa-plus"></i> New</button>
          </div>
          <div class="erp-list" id="adminServiceList"></div>
        </div>
      </div>
    `;

    const serviceList = $("#adminServiceList");
    serviceList.innerHTML = "";
    adminState.services.forEach((svc) => {
      const count = adminState.workers.filter((w) => w.service_id === svc.id).length;
      const item = document.createElement("div");
      item.className = "erp-list-item";
      item.innerHTML = `
        <div class="erp-item-icon"><i class="fas ${esc(svc.icon || "fa-tools")}"></i></div>
        <div class="erp-item-body">
          <div class="erp-item-title">${esc(svc.title)}</div>
          <div class="erp-item-sub">₹${esc(svc.price)} · ${esc(svc.category)} · ${count} workers</div>
        </div>
        <div class="erp-item-actions">
          <button class="icon-btn edit" data-edit-service="${svc.id}" title="Edit"><i class="fas fa-edit"></i></button>
          <button class="icon-btn delete" data-del-service="${svc.id}" title="Delete"><i class="fas fa-trash-alt"></i></button>
        </div>
      `;
      serviceList.appendChild(item);
    });

    container.querySelectorAll("[data-edit-service]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const svc = adminState.services.find((s) => s.id === btn.dataset.editService);
        if (!svc) return;
        adminState.editingService = svc;
        $("#svcId").value = svc.id;
        $("#svcTitle").value = svc.title;
        $("#svcCategory").value = svc.category;
        $("#svcDesc").value = svc.description;
        $("#svcPrice").value = svc.price;
        $("#svcIcon").value = svc.icon || "fa-wrench";
        $("#svcImage").value = svc.image || "";
        $("#serviceSubmitBtn").innerHTML = '<i class="fas fa-sync-alt"></i> Update Service';
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });

    container.querySelectorAll("[data-del-service]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!(await confirmDialog("Delete this service and all its workers?", { title: "Delete service?" }))) return;
        try {
          await api("/api/services/" + btn.dataset.delService, { method: "DELETE" });
          showToast("Service deleted.", "fa-trash-alt");
          await loadAdminData();
          showTab(adminState.tab);
        } catch (err) { showToast(err.message, "fa-exclamation-circle"); }
      });
    });

    $("#newServiceBtn").addEventListener("click", () => {
      adminState.editingService = null;
      $("#serviceForm").reset();
      $("#svcId").value = "";
      $("#svcIcon").value = "fa-wrench";
      $("#svcImage").value = "";
      $("#serviceSubmitBtn").innerHTML = '<i class="fas fa-save"></i> Save Service';
    });

    $("#serviceForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = $("#svcId").value;
      const payload = {
        title: $("#svcTitle").value.trim(),
        category: $("#svcCategory").value.trim().toLowerCase(),
        description: $("#svcDesc").value.trim(),
        price: parseFloat($("#svcPrice").value) || 0,
        icon: $("#svcIcon").value.trim(),
        image: $("#svcImage").value.trim(),
      };
      try {
        if (id) {
          await api("/api/services/" + id, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
          showToast("Service updated!", "fa-sync-alt");
        } else {
          await api("/api/services", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
          showToast("Service created!", "fa-plus-circle");
        }
        adminState.editingService = null;
        await loadAdminData();
        showTab(adminState.tab);
      } catch (err) { showToast(err.message, "fa-exclamation-circle"); }
    });
  }

  // ── Workers Tab ──
  function renderWorkersTab() {
    const container = $("#tabWorkers");
    if (!container) return;
    container.innerHTML = `
      <div class="erp-toolbar">
        <div class="erp-actions">
          <h3><i class="fas fa-plus-circle" style="color:var(--accent)"></i> Worker Manager</h3>
        </div>
      </div>
      <div class="erp-grid-2">
        <div class="glass-card erp-card" id="newWorkerCard">
          <div class="erp-card-head"><h3>${adminState.editingWorker ? "Edit Worker" : "New Worker"}</h3></div>
          <form id="workerForm">
            <input type="hidden" id="workerId">
            <div class="form-group">
              <label>Service Category</label>
              <select class="select-input" id="workerService" required>
                <option value="">Select a service...</option>
                ${adminState.services.map((s) => `<option value="${s.id}">${esc(s.title)}</option>`).join("")}
              </select>
            </div>
            <div class="form-grid-2">
              <div class="form-group">
                <label>Full Name</label>
                <input type="text" class="text-input" id="workerName" placeholder="Worker name" required>
              </div>
              <div class="form-group">
                <label>Phone</label>
                <input type="tel" class="text-input" id="workerPhone" placeholder="+91 00000 00000" required>
              </div>
            </div>
            <div class="form-grid-2">
              <div class="form-group">
                <label>Experience (Years)</label>
                <input type="number" class="text-input" id="workerExp" min="0" max="60" placeholder="e.g. 5" required>
              </div>
              <div class="form-group">
                <label>Hourly Rate (₹)</label>
                <input type="number" class="text-input" id="workerRate" min="0" step="10" placeholder="e.g. 350">
              </div>
            </div>
            <div class="form-grid-2">
              <div class="form-group">
                <label>Skill</label>
                <input type="text" class="text-input" id="workerSkill" placeholder="e.g. HVAC Repair">
              </div>
              <div class="form-group">
                <label>Skill Level</label>
                <select class="select-input" id="workerSkillLevel">
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="expert">Expert</option>
                </select>
              </div>
            </div>
            <div class="form-grid-2">
              <div class="form-group">
                <label>Status</label>
                <select class="select-input" id="workerStatus">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div class="form-group">
                <label>Initial Rating</label>
                <input type="number" class="text-input" id="workerRating" min="0" max="5" step="0.1" placeholder="e.g. 4.5">
              </div>
            </div>
            <div class="form-group" style="display:${adminState.editingWorker ? "block" : "none"}" id="photoPreviewGroup"></div>
            <div class="form-group">
              <label>Profile Photo</label>
              <input type="text" class="text-input" id="workerPhotoUrl" placeholder="Paste image URL (https://...)">
              <div class="file-upload" id="photoUpload">
                <i class="fas fa-cloud-upload-alt"></i>
                <p>Or click to upload a file</p>
                <input type="file" id="workerPhoto" accept="image/*">
                <img class="upload-preview" id="photoPreview" alt="preview">
              </div>
            </div>
            <div class="form-group" style="display:${adminState.editingWorker ? "block" : "none"}" id="idCardPreviewGroup"></div>
            <div class="form-group">
              <label>ID Card Image</label>
              <div class="file-upload" id="idCardUpload">
                <i class="fas fa-id-card"></i>
                <p>Click to upload ID card photo</p>
                <input type="file" id="workerIdCard" accept="image/*">
                <img class="upload-preview" id="idCardPreview" alt="preview">
              </div>
            </div>
            <button type="submit" class="btn btn-primary btn-full" id="workerSubmitBtn"><i class="fas fa-save"></i> Save Worker</button>
          </form>
        </div>
        <div class="glass-card erp-card">
          <div class="erp-card-head">
            <h3>Labor Directory</h3>
            <button class="btn btn-primary btn-sm" id="newWorkerBtn"><i class="fas fa-plus"></i> New</button>
          </div>
          <div class="erp-list" id="adminWorkerList"></div>
        </div>
      </div>
    `;

    const avatarColors = ["linear-gradient(135deg,#6c5ce7,#a855f7)", "linear-gradient(135deg,#00d2ff,#00f5a0)", "linear-gradient(135deg,#fd79a8,#e17055)", "linear-gradient(135deg,#feca57,#ff6b6b)", "linear-gradient(135deg,#00b894,#00d2ff)"];

    const workerList = $("#adminWorkerList");
    workerList.innerHTML = "";
    adminState.workers.forEach((w) => {
      const svc = adminState.services.find((s) => s.id === w.service_id);
      const initials = (w.name || "?").split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase();
      const color = avatarColors[(w.name || "A").charCodeAt(0) % avatarColors.length];
      const skillColor = SKILL_LEVEL_COLORS[w.skill_level] || "#feca57";
      const wsColor = WORKER_STATUS_COLORS[w.status] || "#888";
      const item = document.createElement("div");
      item.className = "erp-list-item";
      item.innerHTML = `
        ${w.photo_url ? `<img src="${w.photo_url}" class="erp-item-avatar" alt="">` : `<div class="erp-item-avatar" style="background:${color}">${esc(initials)}</div>`}
        <div class="erp-item-body">
          <div class="erp-item-title">${esc(w.name)} <span class="ws-pill" style="color:${wsColor};border-color:${wsColor}55;">${esc(w.status || "active")}</span></div>
          <div class="erp-item-sub">${esc(svc ? svc.title : "Unknown")} · ${w.hourly_rate ? "₹" + esc(w.hourly_rate) + "/hr" : "₹—/hr"} · ${esc(w.experience)} yrs · ⭐ ${Number(w.rating).toFixed(1)}</div>
          <div class="erp-item-tags">
            <span class="skill-pill" style="color:${skillColor};border-color:${skillColor}55;">${esc(w.skill || "General")}</span>
            <span class="skill-pill" style="color:${skillColor};border-color:${skillColor}55;">${esc(w.skill_level || "beginner")}</span>
          </div>
        </div>
        <div class="erp-item-actions">
          <button class="icon-btn edit" data-edit-worker="${w.id}" title="Edit"><i class="fas fa-edit"></i></button>
          <button class="icon-btn delete" data-del-worker="${w.id}" title="Delete"><i class="fas fa-trash-alt"></i></button>
        </div>
      `;
      workerList.appendChild(item);
    });
    if (!adminState.workers.length) {
      workerList.innerHTML = `<p class="td-empty">No workers yet.</p>`;
    }

    container.querySelectorAll("[data-edit-worker]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const w = adminState.workers.find((x) => x.id === btn.dataset.editWorker);
        if (!w) return;
        adminState.editingWorker = w;
        $("#workerId").value = w.id;
        $("#workerService").value = w.service_id;
        $("#workerName").value = w.name;
        $("#workerPhone").value = w.phone;
        $("#workerExp").value = w.experience;
        $("#workerRate").value = w.hourly_rate;
        $("#workerSkill").value = w.skill || "";
        $("#workerSkillLevel").value = w.skill_level || "beginner";
        $("#workerStatus").value = w.status || "active";
        $("#workerRating").value = w.rating;
        const photoGroup = $("#photoPreviewGroup");
        photoGroup.style.display = "block";
        photoGroup.innerHTML = `<label>Current Photo</label><img src="${w.photo_url || ""}" class="upload-preview show" style="display:${w.photo_url ? "block" : "none"}" alt="current">`;
        $("#workerPhotoUrl").value = w.photo_url || "";
        const idCardGroup = $("#idCardPreviewGroup");
        idCardGroup.style.display = "block";
        idCardGroup.innerHTML = `<label>Current ID Card</label><img src="${w.id_card_url || ""}" class="upload-preview show" style="display:${w.id_card_url ? "block" : "none"}" alt="current">`;
        $("#workerSubmitBtn").innerHTML = '<i class="fas fa-sync-alt"></i> Update Worker';
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });

    container.querySelectorAll("[data-del-worker]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!(await confirmDialog("Delete this worker?", { title: "Delete worker?" }))) return;
        try {
          await api("/api/workers/" + btn.dataset.delWorker, { method: "DELETE" });
          showToast("Worker deleted.", "fa-trash-alt");
          await loadAdminData();
          showTab(adminState.tab);
        } catch (err) { showToast(err.message, "fa-exclamation-circle"); }
      });
    });

    const wireUpload = (clickEl, inputEl, previewEl) => {
      clickEl.addEventListener("click", (e) => {
        if (e.target === inputEl) return;
        inputEl.click();
      });
      inputEl.addEventListener("change", () => {
        const file = inputEl.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          previewEl.src = ev.target.result;
          previewEl.classList.add("show");
          previewEl.style.display = "block";
        };
        reader.readAsDataURL(file);
      });
    };
    const photoInput = $("#workerPhoto");
    const idInput = $("#workerIdCard");
    wireUpload($("#photoUpload"), photoInput, $("#photoPreview"));
    wireUpload($("#idCardUpload"), idInput, $("#idCardPreview"));

    $("#newWorkerBtn").addEventListener("click", () => {
      const form = $("#workerForm");
      adminState.editingWorker = null;
      form.reset();
      $("#workerId").value = "";
      $("#workerPhotoUrl").value = "";
      $("#photoPreviewGroup").style.display = "none";
      $("#idCardPreviewGroup").style.display = "none";
      $("#photoPreview").classList.remove("show");
      $("#idCardPreview").classList.remove("show");
      $("#workerStatus").value = "active";
      $("#workerSkillLevel").value = "beginner";
      const serviceSel = $("#workerService");
      if (serviceSel && !serviceSel.value && adminState.services.length) {
        serviceSel.value = adminState.services[0].id;
      }
      $("#workerSubmitBtn").innerHTML = '<i class="fas fa-save"></i> Save Worker';
      const card = $("#newWorkerCard");
      if (card) card.scrollIntoView({ behavior: "smooth", block: "start" });
      const firstField = serviceSel || $("#workerService");
      if (firstField) firstField.focus({ preventScroll: true });
    });

    $("#workerForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = $("#workerId").value;
      const serviceId = $("#workerService").value;
      if (!serviceId) {
        showToast("Please select a service category first.", "fa-exclamation-circle");
        $("#workerService").focus();
        return;
      }
      // Sheets backend: no multipart uploads — send JSON with photo/id-card
      // as https URL (preferred) or base64 data-URL (small images only).
      const payload = {
        service_id: serviceId,
        name: $("#workerName").value.trim(),
        phone: $("#workerPhone").value.trim(),
        experience: parseInt($("#workerExp").value, 10) || 0,
        rating: parseFloat($("#workerRating").value) || 0,
        hourly_rate: parseFloat($("#workerRate").value) || 0,
        skill: $("#workerSkill").value.trim(),
        skill_level: $("#workerSkillLevel").value,
        status: $("#workerStatus").value,
        photo_url: $("#workerPhotoUrl").value.trim(),
        id_card_url: "",
      };
      try {
        if (photoInput.files[0]) payload.photo_url = await readFileAsDataUrl(photoInput.files[0]);
        const existing = id ? adminState.workers.find((x) => x.id === id) : null;
        if (idInput.files[0]) {
          payload.id_card_url = await readFileAsDataUrl(idInput.files[0]);
        } else if (existing) {
          payload.id_card_url = existing.id_card_url || "";
        }
        if (id) {
          await api("/api/workers/" + id, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
          showToast("Worker updated!", "fa-sync-alt");
        } else {
          await api("/api/workers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
          showToast("Worker added!", "fa-user-plus");
        }
        adminState.editingWorker = null;
        await loadAdminData();
        showTab(adminState.tab);
        if (!id) {
          const emptyForm = $("#workerForm");
          if (emptyForm) emptyForm.reset();
          const card = $("#newWorkerCard");
          if (card) card.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      } catch (err) { showToast(err.message, "fa-exclamation-circle"); }
    });
  }

  // ── Bookings Tab ──
  function renderBookingsTab() {
    const container = $("#tabBookings");
    if (!container) return;
    const filters = [
      { value: "all", label: "All" },
      { value: "pending", label: "Pending" },
      { value: "assigned", label: "Assigned" },
      { value: "completed", label: "Completed" },
      { value: "cancelled", label: "Cancelled" },
    ];
    const filtered = adminState.bookingFilter === "all"
      ? adminState.bookings
      : adminState.bookings.filter((b) => b.status === adminState.bookingFilter);

    container.innerHTML = `
      <div class="erp-toolbar">
        <div class="erp-actions"><h3><i class="fas fa-calendar-check" style="color:var(--secondary)"></i> Booking Orders</h3></div>
        <button class="btn btn-primary btn-sm" id="newBookingBtn"><i class="fas fa-plus"></i> New Booking</button>
      </div>
      <div class="filter-pills">
        ${filters.map((f) => `
          <button class="filter-pill ${adminState.bookingFilter === f.value ? "active" : ""}" data-bk-filter="${f.value}">${esc(f.label)} <span class="filter-count" style="color:${STATUS_COLORS[f.value] || "#fff"}">${adminState.bookings.filter((b) => f.value === "all" || b.status === f.value).length}</span></button>
        `).join("")}
      </div>
      <div class="glass-card erp-card">
        <div class="table-wrap">
          <table class="erp-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Service</th>
                <th>Worker / Technician</th>
                <th>Booked On</th>
                <th>Date</th>
                <th>Time</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="bookingRows"></tbody>
          </table>
        </div>
      </div>
    `;

    $$(".filter-pill").forEach((pill) => {
      pill.addEventListener("click", () => {
        adminState.bookingFilter = pill.dataset.bkFilter;
        renderBookingsTab();
      });
    });

    $("#newBookingBtn").addEventListener("click", () => openBookingForm());

    const rows = $("#bookingRows");
    rows.innerHTML = "";
    filtered.forEach((b) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>
          <div class="td-strong">${bookingName(b)}</div>
          <div class="td-phone">${bookingPhone(b)}</div>
        </td>
        <td>${bookingService(b)}</td>
        <td>${bookingWorker(b)}</td>
        <td class="td-sub">${bookingPlacedAt(b)}</td>
        <td>${esc(b.booking_date)}</td>
        <td>${esc(b.booking_time)}</td>
        <td class="td-rupee">₹${Number(b.amount || 0).toLocaleString()}</td>
        <td>
          <select class="status-select" data-bk-status="${b.id}" style="color:${STATUS_COLORS[b.status] || "#888"};border-color:${STATUS_COLORS[b.status] || "#888"}55;background:${STATUS_COLORS[b.status] || "#888"}22;">
            ${["pending", "assigned", "completed", "cancelled"].map((st) => `<option value="${st}" ${b.status === st ? "selected" : ""}>${st}</option>`).join("")}
          </select>
        </td>
        <td>
          <div class="erp-item-actions">
            <button class="icon-btn edit" data-edit-booking="${b.id}" title="Edit"><i class="fas fa-edit"></i></button>
            <button class="icon-btn delete" data-del-booking="${b.id}" title="Delete"><i class="fas fa-trash-alt"></i></button>
          </div>
        </td>
      `;
      rows.appendChild(tr);
    });
    if (!filtered.length) {
      rows.innerHTML = `<tr><td colspan="9" class="td-empty">No bookings match this filter.</td></tr>`;
    }

    container.querySelectorAll("[data-bk-status]").forEach((sel) => {
      sel.addEventListener("change", async () => {
        try {
          await api("/api/bookings/" + sel.dataset.bkStatus, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: sel.value }),
          });
          showToast("Booking status updated to " + sel.value + ".", "fa-sync-alt");
          await loadAdminData();
          renderBookingsTab();
        } catch (err) { showToast(err.message, "fa-exclamation-circle"); }
      });
    });

    container.querySelectorAll("[data-edit-booking]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const b = adminState.bookings.find((x) => x.id === btn.dataset.editBooking);
        if (b) openBookingForm(b);
      });
    });

    container.querySelectorAll("[data-del-booking]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!(await confirmDialog("Delete this booking?", { title: "Delete booking?" }))) return;
        try {
          await api("/api/bookings/" + btn.dataset.delBooking, { method: "DELETE" });
          showToast("Booking deleted.", "fa-trash-alt");
          await loadAdminData();
          renderBookingsTab();
        } catch (err) { showToast(err.message, "fa-exclamation-circle"); }
      });
    });
  }

  function openBookingForm(booking) {
    adminState.editingBooking = booking || null;
    const modalContent = $("#genericModalContent");
    if (!modalContent) return;
    modalContent.innerHTML = `
      <h3 class="modal-title"><i class="fas fa-calendar-plus"></i> ${booking ? "Edit Booking" : "New Booking"}</h3>
      <form id="bookingForm">
        <input type="hidden" id="bkId">
        <div class="form-group">
          <label>Service</label>
          <select class="select-input" id="bkService" required>
            <option value="">Select a service...</option>
            ${adminState.services.map((s) => `<option value="${s.id}">${esc(s.title)}</option>`).join("")}
          </select>
        </div>
        <div class="form-group">
          <label>Worker (optional)</label>
          <select class="select-input" id="bkWorker">
            <option value="">Not assigned</option>
            ${adminState.workers.map((w) => `<option value="${w.id}">${esc(w.name)}</option>`).join("")}
          </select>
        </div>
        <div class="form-grid-2">
          <div class="form-group">
            <label>Customer Name</label>
            <input type="text" class="text-input" id="bkName" placeholder="Customer name" required>
          </div>
          <div class="form-group">
            <label>Phone</label>
            <input type="tel" class="text-input" id="bkPhone" placeholder="+91 00000 00000" required>
          </div>
        </div>
        <div class="form-grid-2">
          <div class="form-group">
            <label>Customer Email</label>
            <input type="email" class="text-input" id="bkEmail" placeholder="customer@example.com">
          </div>
          <div class="form-group">
            <label>Address</label>
            <input type="text" class="text-input" id="bkAddress" placeholder="Service address">
          </div>
        </div>
        <div class="form-grid-2">
          <div class="form-group">
            <label>Date</label>
            <input type="date" class="text-input" id="bkDate" required>
          </div>
          <div class="form-group">
            <label>Time</label>
            <select class="select-input" id="bkTime">
              <option>08:00 AM</option>
              <option>09:00 AM</option>
              <option>10:00 AM</option>
              <option>11:00 AM</option>
              <option>12:00 PM</option>
              <option>01:00 PM</option>
              <option>02:00 PM</option>
              <option>03:00 PM</option>
              <option>04:00 PM</option>
              <option>05:00 PM</option>
              <option>06:00 PM</option>
            </select>
          </div>
        </div>
        <div class="form-grid-2">
          <div class="form-group">
            <label>Amount (₹)</label>
            <input type="number" class="text-input" id="bkAmount" min="0" step="1" placeholder="e.g. 499">
          </div>
          <div class="form-group">
            <label>Status</label>
            <select class="select-input" id="bkStatus">
              <option value="pending">Pending</option>
              <option value="assigned">Assigned</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>Address / Notes</label>
          <textarea class="text-input" id="bkNotes" rows="2" placeholder="Address or special instructions"></textarea>
        </div>
        <button type="submit" class="btn btn-primary btn-full"><i class="fas fa-check-circle"></i> ${booking ? "Update Booking" : "Create Booking"}</button>
      </form>
    `;

    if (booking) {
      $("#bkId").value = booking.id;
      $("#bkService").value = booking.service_id || "";
      $("#bkWorker").value = booking.worker_id || "";
      $("#bkName").value = booking.user_name || booking.customer_name || booking.customerName || booking.name || booking.customer || "";
      $("#bkPhone").value = booking.user_phone || booking.customer_phone || booking.customerPhone || booking.phone || "";
      $("#bkEmail").value = booking.customer_email || "";
      $("#bkAddress").value = booking.address || "";
      $("#bkDate").value = booking.booking_date;
      $("#bkTime").value = booking.booking_time;
      $("#bkAmount").value = booking.amount || "";
      $("#bkStatus").value = booking.status;
      $("#bkNotes").value = booking.notes || "";
    } else {
      $("#bkDate").min = new Date().toISOString().split("T")[0];
    }

    openModal("genericModal");

    $("#bookingForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = $("#bkId").value;
      const serviceId = $("#bkService").value;
      const svc = adminState.services.find((s) => s.id === serviceId);
      const pricing = adminServicePricing(svc);
      const payload = {
        service_id: serviceId,
        worker_id: $("#bkWorker").value || null,
        user_name: $("#bkName").value.trim(),
        user_phone: $("#bkPhone").value.trim(),
        customer_email: $("#bkEmail").value.trim(),
        address: $("#bkAddress").value.trim(),
        service_name: svc ? svc.title : "",
        worker_name: workerName($("#bkWorker").value),
        labor_name: workerName($("#bkWorker").value),
        booking_date: $("#bkDate").value,
        booking_time: $("#bkTime").value,
        amount: parseFloat($("#bkAmount").value) || pricing.amount,
        visiting_fee: pricing.visitingFee,
        booking_type: pricing.bookingType,
        status: $("#bkStatus").value,
        notes: $("#bkNotes").value.trim(),
      };
      try {
        if (id) {
          await api("/api/bookings/" + id, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
          showToast("Booking updated!", "fa-sync-alt");
        } else {
          await api("/api/bookings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
          showToast("Booking created!", "fa-calendar-plus");
        }
        adminState.editingBooking = null;
        closeModal("genericModal");
        await loadAdminData();
        showTab("bookings");
      } catch (err) { showToast(err.message, "fa-exclamation-circle"); }
    });
  }

  // ── Exposed helper for inline onclick ──
  window.selectErpTab = function (tab) {
    if (!adminState.loggedIn) return;
    showTab(tab);
  };

  // ── Bindings ──
  function bindModalClose() {
    document.addEventListener("click", (e) => {
      const closeBtn = e.target.closest(".modal-close");
      if (closeBtn) closeModal(closeBtn.dataset.close);
      if (e.target.classList.contains("modal-backdrop")) {
        const modal = e.target.closest(".modal");
        if (modal) closeModal(modal.id);
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") $$(".modal.open").forEach((m) => closeModal(m.id));
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindModalClose();

    const loginForm = $("#adminLoginForm");
    if (loginForm) {
      loginForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const user = $("#loginUser").value.trim();
        const pass = $("#loginPass").value.trim();
        if (user === ADMIN_USERNAME && pass === ADMIN_PASSWORD) {
          adminState.loggedIn = true;
          sessionStorage.setItem(SESSION_KEY, "1");
          showToast("Welcome back, Admin!", "fa-user-shield");
          enterDashboard();
        } else {
          showToast("Invalid username or password.", "fa-exclamation-circle");
        }
      });
    }

    const backBtn = $("#adminBackBtn");
    if (backBtn) backBtn.addEventListener("click", () => { window.location.href = "/"; });

    const logoutBtn = $("#logoutBtn");
    if (logoutBtn) logoutBtn.addEventListener("click", () => {
      adminState.loggedIn = false;
      sessionStorage.removeItem(SESSION_KEY);
      showToast("Logged out.", "fa-power-off");
      window.location.href = "/";
    });

    const backSiteBtn = $("#backSiteBtn");
    if (backSiteBtn) backSiteBtn.addEventListener("click", () => { window.location.href = "/"; });

    const hamburger = $("#erpHamburger");
    if (hamburger) hamburger.addEventListener("click", () => {
      const sidebar = $("#erpSidebar");
      if (sidebar) sidebar.classList.toggle("open");
    });

    $$(".erp-nav-item").forEach((item) => {
      item.addEventListener("click", () => showTab(item.dataset.erpTab));
    });

    if (sessionStorage.getItem(SESSION_KEY) === "1") {
      adminState.loggedIn = true;
      enterDashboard();
    } else {
      showLogin();
    }
  });
})();