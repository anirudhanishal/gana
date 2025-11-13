/**
 * @fileoverview Standardized error messages and error response utilities.
 * @module utils/errors
 */

/**
 * Standard error messages used across the API.
 * @constant
 */
export const ERROR_MESSAGES = {
  INVALID_SEOKEY: 'Missing or invalid seokey.',
  NO_RESULTS: 'Unable to find any results!',
  MISSING_QUERY: 'Missing required query parameter: q',
  MISSING_SEOKEY: 'Missing required query parameter: seokey'
} as const

/**
 * Error response generator class.
 * Provides standardized error responses for common API error scenarios.
 *
 * @class Errors
 */
export class Errors {
  /**
   * Returns an error response for invalid or missing seokey.
   *
   * @returns {{ error: string }} Error response object
   */
  invalidSeokey() {
    return { error: ERROR_MESSAGES.INVALID_SEOKEY }
  }

  /**
   * Returns an error response when no results are found.
   *
   * @returns {{ error: string }} Error response object
   */
  noResults() {
    return { error: ERROR_MESSAGES.NO_RESULTS }
  }

  /**
   * Returns an error response for missing search query parameter.
   *
   * @returns {{ error: string }} Error response object
   */
  missingQuery() {
    return { error: ERROR_MESSAGES.MISSING_QUERY }
  }

  /**
   * Returns an error response for missing seokey parameter.
   *
   * @returns {{ error: string }} Error response object
   */
  missingSeokey() {
    return { error: ERROR_MESSAGES.MISSING_SEOKEY }
  }
}
