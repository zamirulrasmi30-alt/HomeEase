const { Router } = require('express');
const { serviceClient } = require('../../config/supabase');
const { asyncHandler, AppError } = require('../../middleware/error');

const router = Router();

/** POST /api/admin/categories  { name, description?, unit_types[], sort_order? } */
router.post('/', asyncHandler(async (req, res) => {
  const { name, description, unit_types, sort_order } = req.body;
  if (!name) throw AppError('Category name is required.');

  const { data, error } = await serviceClient.from('categories').insert({
    name,
    description: description || '',
    unit_types: Array.isArray(unit_types) ? unit_types : [],
    sort_order: sort_order ?? 99,
  }).select('*').single();

  if (error) throw AppError('Failed to create category: ' + error.message);
  res.status(201).json({ data });
}));

/** PATCH /api/admin/categories/:id */
router.patch('/:id', asyncHandler(async (req, res) => {
  const patch = {};
  for (const k of ['name', 'description', 'sort_order', 'active']) {
    if (req.body[k] !== undefined) patch[k] = req.body[k];
  }
  if (req.body.unit_types !== undefined) patch.unit_types = req.body.unit_types;
  if (Object.keys(patch).length === 0) throw AppError('Nothing to update.');

  const { data, error } = await serviceClient.from('categories').update(patch).eq('id', req.params.id).select('*').single();
  if (error) throw AppError('Failed to update category: ' + error.message);
  res.json({ data });
}));

/** DELETE /api/admin/categories/:id  (restricted if products exist) */
router.delete('/:id', asyncHandler(async (req, res) => {
  const { error } = await serviceClient.from('categories').delete().eq('id', req.params.id);
  if (error) throw AppError('Cannot delete category (maybe it still has products): ' + error.message);
  res.status(204).end();
}));

module.exports = router;