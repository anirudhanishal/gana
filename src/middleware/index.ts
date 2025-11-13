/**
 * @fileoverview Middleware functions for request handling.
 * Provides error handling and logging middleware for the API.
 * @module middleware/index
 */

import { Context, Next } from 'hono'

/**
 * Error handling middleware.
 * Catches and handles errors that occur during request processing.
 * Returns a standardized error response with 500 status code.
 *
 * @param {Context} ctx - Hono context object
 * @param {Next} next - Next middleware function
 * @returns {Promise<Response | void>} Error response or void if no error
 */
export const errorHandler = async (ctx: Context, next: Next) => {
  try {
    await next()
  } catch (error) {
    console.error('Error:', error)
    return ctx.json(
      {
        success: false,
        error: 'Internal server error',
        timestamp: new Date()
      },
      500
    )
  }
}

/**
 * Request logging middleware.
 * Logs HTTP method, path, and request duration to console.
 *
 * @param {Context} ctx - Hono context object
 * @param {Next} next - Next middleware function
 * @returns {Promise<void>}
 */
export const logger = async (ctx: Context, next: Next) => {
  const start = Date.now()
  await next()
  const duration = Date.now() - start
  console.log(`${ctx.req.method} ${ctx.req.path} - ${duration}ms`)
}
