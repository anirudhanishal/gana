/**
 * @fileoverview Content rating and metadata utility functions.
 * @module utils/content
 */

/**
 * Determines if content is marked as explicit based on parental warning flag.
 *
 * In Gaana API, explicit content is indicated by a parental warning value of 1.
 *
 * @param {number} explicit - Parental warning flag (0 = safe, 1 = explicit)
 * @returns {boolean} True if content is explicit, false otherwise
 *
 * @example
 * ```typescript
 * isExplicit(1)
 * // Returns: true
 *
 * isExplicit(0)
 * // Returns: false
 * ```
 */
export function isExplicit(explicit: number): boolean {
  return explicit === 1
}

