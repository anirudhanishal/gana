/**
 * @fileoverview Handler for new releases endpoint.
 * Returns newly released songs filtered by language (optional).
 * @module handlers/newreleases
 */

import { Context } from 'hono'
import { gaanaService } from '../services/instances.js'
import { validateQueryParam, validationSchemas } from '../utils/validation.js'

/**
 * Handles GET requests for new releases.
 *
 * @param {Context} c - Hono context object
 * @returns {Promise<Response>} JSON response with new releases or error
 *
 * @example
 * ```typescript
 * GET /api/new-releases?language=hi
 * GET /api/new-releases
 * ```
 */
export async function handleNewReleases(c: Context) {
  // Validate language (optional)
  const languageValidation = validateQueryParam(c, 'language', validationSchemas.language, false)
  if (!languageValidation.success) {
    return c.json({ error: languageValidation.error }, languageValidation.status)
  }

  try {
    const newReleasesData = await gaanaService.getNewReleases(languageValidation.data || '')
    return c.json(newReleasesData)
  } catch (err) {
    console.error('New releases error:', err)
    return c.json(
      {
        error: err instanceof Error ? err.message : 'Failed to get new releases'
      },
      500
    )
  }
}
