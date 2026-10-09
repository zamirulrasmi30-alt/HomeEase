const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/** Extract readable message from a Supabase error. */
const supabaseErrorMessage = (error, fallback = 'Database error') => {
  if (!error) return fallback;
  if (error.message) return error.message;
  if (error.details) return error.details;
  if (error.hint) return error.hint;
  if (error.code === '23505') return 'Duplicate value violates a unique constraint.';
  return fallback;
};

function notFound(req, res) {
  res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found` });
}

function errorHandler(err, req, res, _next) {
  const status = err.statusCode || err.status || 500;
  const message =
    err.statusCode == null && err.status == null && status === 500
      ? supabaseErrorMessage(err, 'Internal server error')
      : err.message || 'Internal server error';
  if (status >= 500) console.error('[api:error]', err);
  res.status(status).json({
    error: message,
    code: err.code || (msgIsPgCode(message) ? msgToCode(message) : undefined),
  });
}

function msgIsPgCode(m) {
  return /^(22|23|42)[0-9]{3}/.test(m || '');
}
function msgToCode(m) {
  const m2 = String(m);
  const match = m2.match(/^[P0-9]*(2[23]|42)\d{3}/);
  return match ? match[0] : undefined;
}

const AppError = (message, statusCode = 400) => {
  const e = new Error(message);
  e.statusCode = statusCode;
  return e;
};

module.exports = { asyncHandler, AppError, errorHandler, notFound, supabaseErrorMessage };