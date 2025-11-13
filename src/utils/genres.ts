/**
 * @fileoverview Genre-related utility functions for formatting genre data.
 * @module utils/genres
 */

/**
 * Interface for objects with a name property (used for genres).
 * @interface
 */
interface NamedObject {
  name: string
}

/**
 * Extracts and joins genre names from an array of genre objects.
 *
 * Safely handles empty arrays and invalid data by returning an empty string.
 *
 * @param {Array<NamedObject>} results - Array of objects with name property
 * @returns {string} Comma-separated string of genre names, or empty string on error
 *
 * @example
 * ```typescript
 * const genres = [{ name: "Pop" }, { name: "Rock" }]
 * findGenres(genres)
 * // Returns: "Pop, Rock"
 *
 * findGenres([])
 * // Returns: ""
 * ```
 */
export function findGenres(results: Array<NamedObject>): string {
  try {
    return results.map((i) => i.name).join(', ')
  } catch {
    return ''
  }
}

