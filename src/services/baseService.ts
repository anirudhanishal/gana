/**
 * @fileoverview Base service class providing shared functionality for all API services.
 * Handles HTTP requests to Gaana API with timeout support and browser-like headers.
 * @module services/baseService
 */

import { Functions } from '../utils/functions.js'
import { Errors } from '../utils/errors.js'
import { getBrowserHeaders } from '../constants/userAgents.js'

/**
 * Base service class that provides common functionality for all API services.
 * All service classes should extend this class to inherit shared methods.
 *
 * @class BaseService
 */
export class BaseService {
  /** Utility functions instance for common operations */
  protected functions: Functions
  /** Error response generator instance */
  protected errors: Errors

  /**
   * Creates a new BaseService instance.
   * Initializes utility functions and error handlers.
   */
  constructor() {
    this.functions = new Functions()
    this.errors = new Errors()
  }

  /**
   * Generic fetch method for Gaana API with timeout support and browser-like headers.
   *
   * Automatically adds browser-like headers (User-Agent, Origin, Referer, etc.) to make
   * requests appear legitimate and reduce the chance of being blocked.
   *
   * Uses AbortController for timeout handling. If the request exceeds the timeout,
   * it will be aborted and a 'Request timeout' error will be thrown.
   *
   * @param {string} url - Full URL to fetch
   * @param {'GET' | 'POST'} [method='POST'] - HTTP method (default: POST)
   * @param {Record<string, string>} [headers={}] - Additional headers to include
   * @param {number} [timeout=5000] - Request timeout in milliseconds (default: 5000ms)
   * @returns {Promise<unknown>} Parsed JSON response from the API
   * @throws {Error} If request times out or fetch fails
   *
   * @example
   * ```typescript
   * const data = await this.fetchJson('https://gaana.com/api/endpoint', 'POST', {}, 8000)
   * ```
   */
  protected async fetchJson(
    url: string,
    method: 'GET' | 'POST' = 'POST',
    headers: Record<string, string> = {},
    timeout: number = 5000
  ): Promise<unknown> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      // Merge browser headers with provided headers (provided headers take precedence)
      const browserHeaders = getBrowserHeaders()
      const finalHeaders = {
        ...browserHeaders,
        ...headers
      }

      const response = await fetch(url, {
        method,
        headers: finalHeaders,
        signal: controller.signal
      })
      clearTimeout(timeoutId)
      return await response.json()
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout')
      }
      throw error
    }
  }
}
