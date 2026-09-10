const { Router } = require('express');
const { serviceClient } = require('../config/supabase');
const { asyncHandler, AppError } = require('../middleware/error');

const router = Router();

/** GET /api/categories — active categories with product counts */
router.get('/', asyncHandler(async (req, res) => {
  const { data: categories, error } = await serviceClient
    .from('categories')
    .select('id, name, description, unit_types, sort_order, active, products(count)')
    .order('sort_order')
    .order('name');

  if (error) throw AppError(error.message);

  const rows = (categories || []).map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    unit_types: c.unit_types || [],
    sort_order: c.sort_order,
    active: c.active,
    product_count: c.products?.[0]?.count ?? 0,
  }));

  res.json({ data: rows });
}));

module.exports = router;