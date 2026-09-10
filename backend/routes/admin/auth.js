const { Router } = require('express');
const { login } = require('../../middleware/auth');
const { asyncHandler, AppError } = require('../../middleware/error');

const router = Router();

/**
 * POST /api/admin/auth/login
 * { username, password }  ->  signed token.
 * Credentials compared against ADMIN_USERNAME / ADMIN_PASSWORD (defaults documented).
 */
router.post('/login', asyncHandler(async (req, res) => {
  const { username, password } = req.body || {};
  const u = process.env.ADMIN_USERNAME || 'admin';
  const p = process.env.ADMIN_PASSWORD || 'admin123';

  if (username === u && password === p) {
    const token = login(process.env.ADMIN_SECRET || 'buildsupply-admin-dev-secret-change-me');
    res.json({ data: { token, username: u } });
  } else {
    throw AppError('Invalid admin credentials.', 401);
  }
}));

router.get('/me', asyncHandler(async (req, res) => {
  res.json({ data: { authenticated: true, username: process.env.ADMIN_USERNAME || 'admin' } });
}));

module.exports = router;