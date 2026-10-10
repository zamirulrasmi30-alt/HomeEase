/* HomeEase — Google Apps Script API client (shared by app.js + admin.js).
 * No UI/markup in this file. Uses text/plain POST to avoid GAS CORS preflight.
 * Expects GAS to respond with JSON: either a raw array/object, or
 * { success: true, data: ... } / { error: "..." }.
 */
(function () {
  "use strict";

  function getScriptUrl() {
    const url =
      (typeof window !== "undefined" && window.SCRIPT_URL) ||
      (typeof localStorage !== "undefined" && localStorage.getItem("homeease_script_url")) ||
      "";
    return String(url || "").trim();
  }

  function unwrap(json) {
    if (json && typeof json === "object" && ("data" in json || "success" in json || "error" in json)) {
      if (json.error) throw new Error(String(json.error));
      return json.data !== undefined ? json.data : json;
    }
    return json;
  }

  function isNetworkError(err) {
    // Browser fetch() surfaces network/CORS/DNS failures as TypeError.
    return err instanceof TypeError;
  }

  function networkError() {
    return new Error(
      "Cannot reach the booking backend. Check: (1) the Web App is deployed with " +
      "'Who has access: Anyone', (2) it was redeployed as a New version after the " +
      "latest Code.gs change, (3) window.SCRIPT_URL in public/config.js matches the " +
      "current /exec URL, (4) no ad-blocker is blocking script.google.com."
    );
  }

  function buildQuery(action, params) {
    const qs = new URLSearchParams({ action });
    for (const [k, v] of Object.entries(params || {})) {
      if (v !== undefined && v !== null && v !== "") qs.append(k, String(v));
    }
    return qs.toString();
  }

  // JSONP fallback for GETs: a <script> tag is not subject to CORS, so reads
  // still work when fetch() is blocked (privacy extensions, proxies, etc.).
  // Requires gas/Code.gs doGet() callback support (already included).
  function gasJsonp(action, params) {
    return new Promise((resolve, reject) => {
      const base = getScriptUrl();
      if (!base || typeof document === "undefined") {
        reject(networkError());
        return;
      }
      const cb = "__gas_cb_" + Date.now() + "_" + Math.floor(Math.random() * 1e6);
      const script = document.createElement("script");
      const timer = setTimeout(() => {
        cleanup();
        reject(networkError());
      }, 20000);
      const cleanup = () => {
        try { delete window[cb]; } catch (e) { window[cb] = undefined; }
        clearTimeout(timer);
        if (script.parentNode) script.parentNode.removeChild(script);
      };
      window[cb] = (json) => {
        cleanup();
        try {
          resolve(unwrap(json));
        } catch (e) {
          reject(e);
        }
      };
      script.onerror = () => {
        cleanup();
        reject(networkError());
      };
      script.src = base + "?" + buildQuery(action, { ...(params || {}), callback: cb });
      document.head.appendChild(script);
    });
  }

  async function gasGet(action, params) {
    const base = getScriptUrl();
    if (!base) throw new Error("SCRIPT_URL is not configured. See public/config.js.");
    try {
      const res = await fetch(base + "?" + buildQuery(action, params), {
        method: "GET",
        mode: "cors",
        credentials: "omit",
        cache: "no-store",
        redirect: "follow",
      });
      if (!res.ok) throw new Error("Request failed (" + res.status + ")");
      return unwrap(await res.json());
    } catch (err) {
      if (isNetworkError(err)) return gasJsonp(action, params);
      throw err;
    }
  }

  async function gasPost(action, payload) {
    const base = getScriptUrl();
    if (!base) throw new Error("SCRIPT_URL is not configured. See public/config.js.");
    let res;
    try {
      res = await fetch(base, {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        cache: "no-store",
        // text/plain avoids the CORS preflight that GAS cannot answer.
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action, ...(payload || {}) }),
        redirect: "follow",
      });
    } catch (err) {
      // Writes can't fall back to JSONP (GET-only), so surface an actionable error.
      // Note: app.js already persists bookings to localStorage before this call.
      throw networkError();
    }
    if (!res.ok) throw new Error("Request failed (" + res.status + ")");
    return unwrap(await res.json());
  }

  // Back-compat router: lets old "/api/xxx" style calls keep working.
  // api("/api/services") -> gasGet("getServices"), POST/PUT/DELETE mapped to GAS actions.
  async function gasApi(path, options) {
    options = options || {};
    const method = String(options.method || "GET").toUpperCase();
    let body = options.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }
    // FormData (legacy worker photo upload): convert to plain object.
    // File objects become "" here — callers should instead pass a base64
    // data-URL or https URL in photo_url / id_card_url (see admin.js).
    if (typeof FormData !== "undefined" && body instanceof FormData) {
      const obj = {};
      body.forEach((v, k) => { obj[k] = typeof v === "string" ? v : ""; });
      body = obj;
    }
    body = body && typeof body === "object" ? body : {};

    const clean = String(path || "").split("?")[0];
    const query = String(path || "").includes("?")
      ? Object.fromEntries(new URLSearchParams(String(path).split("?").slice(1).join("?")))
      : {};

    // Services
    if (clean === "/api/services" && method === "GET") return gasGet("getServices");
    if (clean === "/api/services" && method === "POST") return gasPost("createService", body);
    let m = clean.match(/^\/api\/services\/(.+)$/);
    if (m && method === "GET") return gasGet("getService", { category: decodeURIComponent(m[1]) });
    if (m && (method === "PUT" || method === "PATCH")) return gasPost("updateService", { id: decodeURIComponent(m[1]), ...body });
    if (m && method === "DELETE") return gasPost("deleteService", { id: decodeURIComponent(m[1]) });

    // Workers
    if (clean === "/api/workers" && method === "GET")
      return gasGet("getWorkers", query.service_id ? { service_id: query.service_id } : {});
    if (clean === "/api/workers" && method === "POST") return gasPost("createWorker", body);
    m = clean.match(/^\/api\/workers\/(.+)$/);
    if (m && method === "GET") return gasGet("getWorker", { id: decodeURIComponent(m[1]) });
    if (m && (method === "PUT" || method === "PATCH")) return gasPost("updateWorker", { id: decodeURIComponent(m[1]), ...body });
    if (m && method === "DELETE") return gasPost("deleteWorker", { id: decodeURIComponent(m[1]) });

    // Reviews
    m = clean.match(/^\/api\/reviews\/(.+)$/);
    if (m && method === "GET") return gasGet("getReviews", { worker_id: decodeURIComponent(m[1]) });
    if (clean === "/api/reviews" && method === "POST") return gasPost("createReview", body);

    // Bookings
    if (clean === "/api/bookings" && method === "GET")
      return gasGet("getBookings", query.status ? { status: query.status } : {});
    if (clean === "/api/bookings" && method === "POST") return gasPost("createBooking", body);
    m = clean.match(/^\/api\/bookings\/(.+)$/);
    if (m && method === "GET") return gasGet("getBooking", { id: decodeURIComponent(m[1]) });
    if (m && (method === "PUT" || method === "PATCH")) return gasPost("updateBooking", { id: decodeURIComponent(m[1]), ...body });
    if (m && method === "DELETE") return gasPost("deleteBooking", { id: decodeURIComponent(m[1]) });

    // Stats
    if (clean === "/api/stats" && method === "GET") return gasGet("getStats");

    throw new Error("Unsupported API path: " + path);
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  }

  window.GAS = { getScriptUrl, gasGet, gasPost, api: gasApi, fileToDataUrl };
})();
