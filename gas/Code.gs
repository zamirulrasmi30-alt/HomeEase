/**
 * HomeEase backend — Google Apps Script + Google Sheets as the database.
 *
 * SETUP
 * 1. Create a Google Sheet (any name). This script creates + seeds 4 tabs
 *    (Services, Workers, Reviews, Bookings) automatically on first run.
 * 2. Go to https://script.google.com -> New project -> paste this file.
 * 3. Run `setup` once (accept permissions) to create/seed the sheets.
 * 4. Deploy -> New deployment -> type "Web app":
 *      Execute as: Me
 *      Who has access: Anyone
 *    Copy the /exec URL into public/config.js (window.SCRIPT_URL).
 * 5. IMPORTANT: after EVERY edit here, Deploy -> Manage deployments ->
 *    Edit -> New version, or the live URL keeps serving old code.
 */

const SHEETS = {
  Services: ['id', 'title', 'category', 'description', 'price', 'icon', 'image', 'created_at'],
  Workers: ['id', 'service_id', 'name', 'phone', 'experience', 'rating', 'photo_url', 'id_card_url', 'skill', 'skill_level', 'hourly_rate', 'status', 'created_at'],
  Reviews: ['id', 'worker_id', 'user_name', 'rating', 'comment', 'created_at'],
  Bookings: ['id', 'service_id', 'worker_id', 'user_name', 'user_phone', 'customer_email', 'address', 'service_name', 'worker_name', 'labor_name', 'notes', 'booking_date', 'booking_time', 'amount', 'visiting_fee', 'booking_type', 'status', 'booking_ref', 'utr_number', 'payment_method', 'payment_status', 'created_at'],
};

/** Manual run-once entry point: creates tabs + seed data. */
function setup() {
  seedAll();
}

/* ---------------- HTTP entry points ---------------- */

function doGet(e) {
  const p = (e && e.parameter) || {};
  try {
    const out = { success: true, data: routeGet(String(p.action || ''), p) };
    // JSONP fallback for browsers where fetch() is blocked (CORS/extensions).
    // The static frontend (public/gas-api.js) appends ?callback= automatically.
    if (p.callback) return jsonp(String(p.callback), out);
    return json(out);
  } catch (err) {
    const out = { success: false, error: String((err && err.message) || err) };
    if (p.callback) return jsonp(String(p.callback), out);
    return json(out);
  }
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    return json({ success: true, data: routePost(String(body.action || ''), body) });
  } catch (err) {
    return json({ success: false, error: String((err && err.message) || err) });
  }
}

function routeGet(action, p) {
  switch (action) {
    case 'getServices': return readAll('Services');
    case 'getService': return findService(p.category || p.id);
    case 'getWorkers': return p.service_id ? readAll('Workers').filter(w => String(w.service_id) === String(p.service_id)) : readAll('Workers');
    case 'getWorker': return findById('Workers', p.id);
    case 'getReviews': return readAll('Reviews').filter(r => String(r.worker_id) === String(p.worker_id || ''));
    case 'getBookings': {
      const all = readAll('Bookings').sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
      return !p.status || p.status === 'all' ? all : all.filter(b => String(b.status) === String(p.status));
    }
    case 'getBooking': return findById('Bookings', p.id);
    case 'getStats': return buildStats();
    default: throw new Error('Unknown action: ' + action);
  }
}

function routePost(action, b) {
  switch (action) {
    case 'createService': return insertRow('Services', pick(b, SHEETS.Services, { id: uuid(), created_at: now() }));
    case 'updateService': return updateRow('Services', b.id, pick(b, SHEETS.Services));
    case 'deleteService': {
      deleteRow('Services', b.id);
      // cascade: workers of this service go too (mirrors old server.js)
      readAll('Workers').filter(w => String(w.service_id) === String(b.id)).forEach(w => deleteRow('Workers', w.id));
      return { message: 'Service deleted' };
    }
    case 'createWorker': return insertRow('Workers', coerceWorker(pick(b, SHEETS.Workers, { id: uuid(), created_at: now() })));
    case 'updateWorker': return updateRow('Workers', b.id, coerceWorker(pick(b, SHEETS.Workers)));
    case 'deleteWorker': {
      deleteRow('Workers', b.id);
      return { message: 'Worker deleted' };
    }
    case 'createReview': {
      const review = insertRow('Reviews', pick(b, SHEETS.Reviews, { id: uuid(), created_at: now() }));
      refreshWorkerRating(b.worker_id);
      return review;
    }
    case 'createBooking': return insertRow('Bookings', coerceBooking(pick(b, SHEETS.Bookings, { id: uuid(), created_at: now(), status: 'pending' })));
    case 'updateBooking': return updateRow('Bookings', b.id, pick(b, SHEETS.Bookings));
    case 'deleteBooking': {
      deleteRow('Bookings', b.id);
      return { message: 'Booking deleted' };
    }
    default: throw new Error('Unknown action: ' + action);
  }
}

/* ---------------- Sheet helpers ---------------- */

function ss() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function sheet(name) {
  let sh = ss().getSheetByName(name);
  if (!sh) {
    sh = ss().insertSheet(name);
    sh.appendRow(SHEETS[name]);
    sh.setFrozenRows(1);
  } else if (sh.getLastRow() === 0) {
    sh.appendRow(SHEETS[name]);
  }
  return sh;
}

function readAll(name) {
  const sh = sheet(name);
  const last = sh.getLastRow();
  if (last < 2) return [];
  const headers = SHEETS[name];
  return sh.getRange(2, 1, last - 1, headers.length).getValues().map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i] === '' ? '' : row[i]; });
    return obj;
  });
}

function rowIndexById(name, id) {
  const rows = readAll(name);
  const i = rows.findIndex(r => String(r.id) === String(id));
  return i === -1 ? -1 : i + 2; // + header row
}

function findById(name, id) {
  const found = readAll(name).find(r => String(r.id) === String(id));
  if (!found) throw new Error(name.slice(0, -1) + ' not found');
  return found;
}

function findService(key) {
  const k = String(key || '');
  const found = readAll('Services').find(s => String(s.category) === k || String(s.id) === k);
  if (!found) throw new Error('Service not found');
  return found;
}

function insertRow(name, obj) {
  const headers = SHEETS[name];
  sheet(name).appendRow(headers.map(h => (obj[h] === undefined || obj[h] === null ? '' : obj[h])));
  return obj;
}

function updateRow(name, id, patch) {
  const idx = rowIndexById(name, id);
  if (idx === -1) throw new Error(name.slice(0, -1) + ' not found');
  const headers = SHEETS[name];
  const current = readAll(name)[idx - 2];
  const merged = { ...current, ...patch, id: current.id };
  sheet(name).getRange(idx, 1, 1, headers.length).setValues([headers.map(h => (merged[h] === undefined || merged[h] === null ? '' : merged[h]))]);
  return merged;
}

function deleteRow(name, id) {
  const idx = rowIndexById(name, id);
  if (idx !== -1) sheet(name).deleteRow(idx);
  return true;
}

function buildStats() {
  const services = readAll('Services');
  const workers = readAll('Workers');
  const bookings = readAll('Bookings');
  const completed = bookings.filter(b => String(b.status) === 'completed');
  const revenue = completed.reduce((s, b) => s + (Number(b.amount) || 0), 0);
  return {
    totalRevenue: revenue,
    totalBookings: bookings.length,
    activeWorkers: workers.filter(w => String(w.status) !== 'inactive').length,
    avgOrderValue: completed.length ? Math.round(revenue / completed.length) : 0,
    totalServices: services.length,
    totalReviews: readAll('Reviews').length,
    bookingsByStatus: {
      pending: bookings.filter(b => String(b.status) === 'pending').length,
      assigned: bookings.filter(b => String(b.status) === 'assigned').length,
      completed: completed.length,
      cancelled: bookings.filter(b => String(b.status) === 'cancelled').length,
    },
  };
}

/* ---------------- Coercion / utils ---------------- */

function pick(src, keys, defaults) {
  const out = { ...(defaults || {}) };
  keys.forEach(k => {
    if (src && src[k] !== undefined) out[k] = src[k];
  });
  return out;
}

function coerceWorker(w) {
  if (w.experience !== undefined && w.experience !== '') w.experience = Number(w.experience) || 0;
  if (w.rating !== undefined && w.rating !== '') w.rating = Number(w.rating) || 0;
  if (w.hourly_rate !== undefined && w.hourly_rate !== '') w.hourly_rate = Number(w.hourly_rate) || 0;
  if (!w.status) w.status = 'active';
  if (!w.skill_level) w.skill_level = 'beginner';
  return w;
}

function coerceBooking(b) {
  // Accept legacy/alternate frontend field names (mirrors old server.js).
  if (!b.user_name) b.user_name = b.customer_name || b.name || '';
  if (!b.user_phone) b.user_phone = b.customer_phone || '';
  if (!b.worker_name) b.worker_name = b.labor_name || '';
  if (!b.labor_name) b.labor_name = b.worker_name || '';
  if (b.amount !== undefined && b.amount !== '') b.amount = Number(b.amount) || 0;
  if (b.visiting_fee !== undefined && b.visiting_fee !== '') b.visiting_fee = Number(b.visiting_fee) || 0;
  b.booking_type = b.booking_type === 'inspection' ? 'inspection' : 'fixed';
  if (!b.status) b.status = 'pending';
  return b;
}

function refreshWorkerRating(workerId) {
  if (!workerId) return;
  const reviews = readAll('Reviews').filter(r => String(r.worker_id) === String(workerId));
  if (!reviews.length) return;
  const avg = reviews.reduce((s, r) => s + (Number(r.rating) || 0), 0) / reviews.length;
  try {
    updateRow('Workers', workerId, { rating: Math.round(avg * 10) / 10 });
  } catch (e) { /* worker may have been deleted */ }
}

function uuid() {
  return Utilities.getUuid();
}

function now() {
  return new Date().toISOString();
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function jsonp(callback, obj) {
  const safe = String(callback).replace(/[^A-Za-z0-9_$]/g, '').slice(0, 64) || 'callback';
  return ContentService.createTextOutput(safe + '(' + JSON.stringify(obj) + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

/* ---------------- Seed data (mirrors previous defaults) ---------------- */

function seedAll() {
  const svcRows = readAll('Services');
  if (!svcRows.length) {
    const IMG = {
      cleaning: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
      'ac-mechanic': 'https://images.unsplash.com/photo-1603366591683-a5abc153411f?auto=format&fit=crop&w=1200&q=80',
      'vehicle-mechanic': 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=1200&q=80',
      plumber: 'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?auto=format&fit=crop&w=1200&q=80',
      electrician: 'https://images.unsplash.com/photo-1548962727-4b25973b73f2?auto=format&fit=crop&w=1200&q=80',
    };
    [
      ['Home Cleaning', 'cleaning', 'Professional home cleaning services for a spotless living space.', 49, 'fas fa-broom'],
      ['AC Mechanic', 'ac-mechanic', 'Expert AC repair, installation, and maintenance services.', 79, 'fas fa-snowflake'],
      ['Vehicle Mechanic', 'vehicle-mechanic', 'Skilled mechanics for all types of vehicle repairs and servicing.', 99, 'fas fa-car'],
      ['Plumber', 'plumber', 'Reliable plumbing solutions for leaks, installations, and repairs.', 69, 'fas fa-faucet'],
      ['Electrician', 'electrician', 'Certified electricians for wiring, fixtures, and electrical repairs.', 89, 'fas fa-bolt'],
    ].forEach(s => insertRow('Services', {
      id: uuid(), title: s[0], category: s[1], description: s[2], price: s[3], icon: s[4], image: IMG[s[1]], created_at: now(),
    }));
  }
  const services = readAll('Services');
  const byCat = c => (services.find(s => String(s.category) === c) || {}).id || '';
  if (!readAll('Workers').length) {
    [
      [byCat('ac-mechanic'), 'Rajesh Kumar', '+91 98765 43210', 8, 4.7, 'HVAC Repair', 'expert', 500],
      [byCat('ac-mechanic'), 'Amit Singh', '+91 87654 32109', 5, 4.3, 'HVAC Repair', 'intermediate', 350],
      [byCat('cleaning'), 'Priya Sharma', '+91 76543 21098', 3, 4.8, 'Home Cleaning', 'beginner', 200],
      [byCat('vehicle-mechanic'), 'Vikram Patel', '+91 65432 10987', 12, 4.9, 'Auto Repair', 'expert', 500],
      [byCat('plumber'), 'Suresh Reddy', '+91 54321 09876', 7, 4.5, 'Pipe Fitting', 'intermediate', 350],
      [byCat('electrician'), 'Anil Mehta', '+91 43210 98765', 10, 4.6, 'Wiring & Fixtures', 'expert', 500],
      [byCat('electrician'), 'Deepak Joshi', '+91 32109 87654', 4, 4.2, 'Wiring & Fixtures', 'intermediate', 350],
      [byCat('plumber'), 'Manoj Gupta', '+91 21098 76543', 6, 4.4, 'Pipe Fitting', 'intermediate', 350],
    ].forEach(w => insertRow('Workers', {
      id: uuid(), service_id: w[0], name: w[1], phone: w[2], experience: w[3], rating: w[4],
      photo_url: '', id_card_url: '', skill: w[5], skill_level: w[6], hourly_rate: w[7], status: 'active', created_at: now(),
    }));
  }
}
