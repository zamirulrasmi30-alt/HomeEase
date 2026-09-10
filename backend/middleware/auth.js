const crypto = require('crypto');

/**
 * Stateless admin authentication using an HMAC-signed token.
 * Admin secret lives in ADMIN_SECRET env. Tokens last 12 hours.
 */

const SECRET = process.env.ADMIN_SECRET || 'buildsupply-admin-dev-secret-change-me';
const TTL_MS = 12 * 60 * 60 * 1000;

function sign(payload) {
  return crypto
    .createHmac('sha256', SECRET)
    .update(JSON.stringify(payload))
    .digest('hex');
}

/** Verify {secret} and mint a token. */
function login(secret) {
  if (!SECRET || secret !== SECRET) return null;
  const payload = { sub: 'admin', iat: Date.now(), exp: Date.now() + TTL_MS };
  return `${Buffer.from(JSON.stringify(payload)).toString('base64url')}.${sign(payload)}`;
}

function verify(token) {
  if (!token) return false;
  const [body, sig] = token.split('.');
  if (!body || !sig) return false;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    const expected = sign(payload);
    if (sig !== expected) return false;
    if (payload.sub !== 'admin') return false;
    if (Date.now() > payload.exp) return false;
    return true;
  } catch {
    return false;
  }
}

function adminAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.headers['x-admin-token'];
  if (!verify(token)) {
    return res.status(401).json({ error: 'Unauthorized. Please log in as admin.' });
  }
  next();
}

module.exports = { login, verify, adminAuth };