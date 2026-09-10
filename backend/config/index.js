require('dotenv').config();

module.exports = {
  port: process.env.PORT || 4000,
  corsOrigin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
    : ['http://localhost:5173'],
  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },
  gmapsApiKey: process.env.GOOGLE_MAPS_API_KEY || null,
  pricing: {
    gstRate: Number(process.env.GST_RATE || 18),
    freightBase: Number(process.env.FREIGHT_BASE || 500),
    freightPerKm: Number(process.env.FREIGHT_PER_KM || 18),
  },
};