const BASE = import.meta.env.VITE_API_URL || '/api';

async function request(path, options = {}, isAdmin = false) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (isAdmin) {
    const token = localStorage.getItem('bs_admin_token');
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (res.status === 204) return null;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return body;
}

// ---------------------------------------------------------------- Public API
export const api = {
  health: () => request('/health'),
  categories: () => request('/categories'),
  products: (params = {}) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
    return request(`/products${q ? `?${q}` : ''}`);
  },
  product: (id) => request(`/products/${id}`),
  stock: (productId) => request(`/stock${productId ? `?product_id=${encodeURIComponent(productId)}` : ''}`),
  placeOrder: (payload) => request('/orders', { method: 'POST', body: JSON.stringify(payload) }),
  trackOrder: (orderNumber, phone) =>
    request(`/orders/${encodeURIComponent(orderNumber)}/status?phone=${encodeURIComponent(phone)}`),
  requestQuote: (payload) => request('/quotes', { method: 'POST', body: JSON.stringify(payload) }),
  pricingQuote: (payload) => request('/pricing/quote', { method: 'POST', body: JSON.stringify(payload) }),
};

// ---------------------------------------------------------------- Admin API
const adminToken = () => localStorage.getItem('bs_admin_token');
const isAdminAuthed = () => Boolean(adminToken());

const admin = {
  isAuthed: isAdminAuthed,
  getToken: adminToken,
  logout: () => localStorage.removeItem('bs_admin_token'),
  login: async (username, password) => {
    const { data } = await request('/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    localStorage.setItem('bs_admin_token', data.token);
    return data;
  },

  // Orders
  orders: (params = {}) => {
    const q = new URLSearchParams(params);
    return request(`/admin/orders${q.toString() ? `?${q}` : ''}`, {}, true);
  },
  order: (id) => request(`/admin/orders/${id}`, {}, true),
  recordAdvance: (id, amount) =>
    request(`/admin/orders/${id}/advance`, { method: 'POST', body: JSON.stringify({ amount }) }, true),
  dispatch: (id, { vehicle_number, driver_contact } = {}) =>
    request(`/admin/orders/${id}/dispatch`, { method: 'POST', body: JSON.stringify({ vehicle_number, driver_contact }) }, true),
  deliver: (id, balance_collected = 0) =>
    request(`/admin/orders/${id}/deliver`, { method: 'POST', body: JSON.stringify({ balance_collected }) }, true),
  cancel: (id, reason = '') =>
    request(`/admin/orders/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }, true),
  patchOrder: (id, patch) =>
    request(`/admin/orders/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }, true),
  invoiceUrl: (id, doc = 'invoice') => `${BASE}/admin/invoices/${id}?doc=${doc}`,
  downloadInvoice: (id, doc = 'invoice') => openWithToken(`${BASE}/admin/invoices/${id}?doc=${doc}`),

  // Stock
  inventory: () => request('/admin/stock/summary', {}, true),
  ledger: (params = {}) => {
    const q = new URLSearchParams(params);
    return request(`/admin/stock/ledger${q.toString() ? `?${q}` : ''}`, {}, true);
  },
  receiveStock: (payload) => request('/admin/stock/receive', { method: 'POST', body: JSON.stringify(payload) }, true),
  adjustStock: (payload) => request('/admin/stock/adjust', { method: 'POST', body: JSON.stringify(payload) }, true),

  // Catalog
  categories: () => request('/categories', {}, true),
  products: (params = {}) => {
    const q = new URLSearchParams(params);
    return request(`/products${q.toString() ? `?${q}` : ''}`, {}, true);
  },
  createCategory: (payload) => request('/admin/categories', { method: 'POST', body: JSON.stringify(payload) }, true),
  updateCategory: (id, patch) => request(`/admin/categories/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }, true),
  deleteCategory: (id) => request(`/admin/categories/${id}`, { method: 'DELETE' }, true),
  createProduct: (payload) => request('/admin/products', { method: 'POST', body: JSON.stringify(payload) }, true),
  updateProduct: (id, patch) => request(`/admin/products/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }, true),
  deleteProduct: (id) => request(`/admin/products/${id}`, { method: 'DELETE' }, true),
  uploadImage: async (file) => {
    const token = localStorage.getItem('bs_admin_token');
    const fd = new FormData();
    fd.append('image', file);
    const res = await fetch(`${BASE}/admin/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Upload failed (${res.status})`);
    return body.data;
  },

  analytics: (params = {}) => {
    const q = new URLSearchParams(params);
    return request(`/admin/analytics${q.toString() ? `?${q}` : ''}`, {}, true);
  },
};

// Downloads that need Authorization header are opened in a same-tab trick:
// read the token from localStorage inside an inline fetch.
function openWithToken(url) {
  const token = localStorage.getItem('bs_admin_token');
  return fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    .then((r) => r.blob())
    .then((blob) => {
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'document.pdf';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 5000);
    });
}

export { admin, isAdminAuthed };
export default api;