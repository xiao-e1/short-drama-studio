/** Represents an expected HTTP error. */
class HttpError extends Error {
  /** @param {number} status HTTP status @param {string} message public message @param {string} [code] machine code */
  constructor(status, message, code = 'REQUEST_FAILED') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Wraps an async Express handler.
 * @param {Function} handler async route handler
 * @returns {Function} Express middleware
 */
const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

/** Handles unmatched API routes.
 * @param {import('express').Request} req request
 * @param {import('express').Response} res response
 * @returns {void}
 */
function notFoundHandler(req, res) {
  res.status(404).json({ error: '接口不存在', code: 'NOT_FOUND' });
}

/** Converts errors to a stable JSON response.
 * @param {Error & {status?: number, code?: string}} error error
 * @param {import('express').Request} req request
 * @param {import('express').Response} res response
 * @param {import('express').NextFunction} next next callback
 * @returns {void}
 */
function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  const status = error.status || 500;
  if (status >= 500) console.error(`[${req.method} ${req.path}]`, error);
  res.status(status).json({
    error: status >= 500 && !error.status ? '服务器内部错误，请稍后重试' : error.message,
    code: error.code || 'INTERNAL_ERROR',
  });
}

module.exports = { HttpError, asyncHandler, notFoundHandler, errorHandler };

