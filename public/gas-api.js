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

  async function gasGet(action, params) {
    const base = getScriptUrl();
    if (!base) throw new Error("SCRIPT_URL is not configured. See public/config.js.");
    const qs = new URLSearchParams({ action });
    for (const [k, v] of Object.entries(params || {})) {
      if (v !== undefined && v !== null && v !== "") qs.append(k, String(v));
    }
    const res = await fetch(base + "?" + qs.toString(), { method: "GET", redirect: "follow" });
    if (!res.ok) throw new Error("Request failed (" + res.status + ")");
    return unwrap(await res.json());
  }

  async function gasPost(action, payload) {
    const base = getScriptUrl();
    if (!base) throw new Error("SCRIPT_URL is not configured. See public/config.js.");
    const res = await fetch(base, {
      method: "POST",
      // text/plain avoids the CORS preflight that GAS cannot answer.
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, ...(payload || {}) }),
      redirect: "follow",
    });
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
