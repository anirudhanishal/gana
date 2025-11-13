/**
 * @fileoverview Standardized HTTP response utilities for Hono framework.
 * @module utils/response
 */

import { Context } from 'hono'
import { HTTP_STATUS } from '../constants/index.js'
import type { ApiResponse } from '../types/index.js'

/**
 * Sends a successful JSON response with standardized format.
 *
 * @template T - Type of the data being returned
 * @param {Context} ctx - Hono context object
 * @param {T} data - Response data payload
 * @param {number} [statusCode=HTTP_STATUS.OK] - HTTP status code (default: 200)
 * @returns {Response} JSON response with success format
 *
 * @example
 * ```typescript
 * return sendSuccess(c, { songs: [...] }, 200)
 * // Returns: { success: true, data: { songs: [...] }, timestamp: "..." }
 * ```
 */
export const sendSuccess = <T>(ctx: Context, data: T, statusCode = HTTP_STATUS.OK) => {
  return ctx.json<ApiResponse<T>>(
    {
      success: true,
      data,
      timestamp: new Date()
    },
    statusCode
  )
}

/**
 * Sends an error JSON response with standardized format.
 *
 * @param {Context} ctx - Hono context object
 * @param {string} message - Error message to return
 * @param {number} [statusCode=HTTP_STATUS.INTERNAL_SERVER_ERROR] - HTTP status code (default: 500)
 * @returns {Response} JSON response with error format
 *
 * @example
 * ```typescript
 * return sendError(c, "Resource not found", 404)
 * // Returns: { success: false, error: "Resource not found", timestamp: "..." }
 * ```
 */
export const sendError = (ctx: Context, message: string, statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR) => {
  return ctx.json<ApiResponse<null>>(
    {
      success: false,
      error: message,
      timestamp: new Date()
    },
    statusCode
  )
}
