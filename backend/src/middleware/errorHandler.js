import mongoose from 'mongoose';
import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';

/** 404 for unmatched routes — keeps the envelope consistent. */
export function notFoundHandler(req, res, next) {
  next(new ApiError(404, 'NOT_FOUND', `No route for ${req.method} ${req.originalUrl}`));
}

/**
 * Central error serialiser. Emits { error: { code, message, details? } } and
 * never leaks internal stack traces to clients.
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  let status = err.status || 500;
  let code = err.code || 'INTERNAL_ERROR';
  let message = err.expose ? err.message : 'Something went wrong';
  let details = err.details;

  // Normalise common Mongoose errors into the envelope.
  if (err instanceof mongoose.Error.ValidationError) {
    status = 422;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';
    details = Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v.message]));
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    code = 'BAD_REQUEST';
    message = `Invalid value for ${err.path}`;
  } else if (err.code === 11000) {
    status = 409;
    code = 'CONFLICT';
    message = 'Duplicate value';
    details = err.keyValue;
  }

  if (status >= 500) {
    // Log server-side; clients get a generic message.
    console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  }

  const body = { error: { code, message } };
  if (details) body.error.details = details;
  if (!env.isProd && status >= 500) body.error.stack = err.stack;

  res.status(status).json(body);
}
