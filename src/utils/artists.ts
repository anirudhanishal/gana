/**
 * @fileoverview Artist-related utility functions for formatting artist data.
 * @module utils/artists
 */

/**
 * Interface for objects with a name property.
 * @interface
 */
interface NamedObject {
  name: string
}

/**
 * Interface for objects with a seokey property.
 * @interface
 */
interface SeokeyObject {
  seokey: string
}

/**
 * Interface for objects with an artist_id property.
 * @interface
 */
interface ArtistIdObject {
  artist_id: string
}

/**
 * Extracts and joins artist names from an array of artist objects.
 *
 * @param {Array<NamedObject>} results - Array of objects with name property
 * @returns {string} Comma-separated string of artist names
 *
 * @example
 * ```typescript
 * const artists = [{ name: "Arijit Singh" }, { name: "Shreya Ghoshal" }]
 * findArtistNames(artists)
 * // Returns: "Arijit Singh, Shreya Ghoshal"
 * ```
 */
export function findArtistNames(results: Array<NamedObject>): string {
  return results.map((i) => i.name).join(', ')
}

/**
 * Extracts and joins artist seokeys from an array of artist objects.
 *
 * @param {Array<SeokeyObject>} results - Array of objects with seokey property
 * @returns {string} Comma-separated string of artist seokeys
 *
 * @example
 * ```typescript
 * const artists = [{ seokey: "arijit-singh" }, { seokey: "shreya-ghoshal" }]
 * findArtistSeoKeys(artists)
 * // Returns: "arijit-singh, shreya-ghoshal"
 * ```
 */
export function findArtistSeoKeys(results: Array<SeokeyObject>): string {
  return results.map((i) => i.seokey).join(', ')
}

/**
 * Extracts and joins artist IDs from an array of artist objects.
 *
 * @param {Array<ArtistIdObject>} results - Array of objects with artist_id property
 * @returns {string} Comma-separated string of artist IDs
 *
 * @example
 * ```typescript
 * const artists = [{ artist_id: "123" }, { artist_id: "456" }]
 * findArtistIds(artists)
 * // Returns: "123, 456"
 * ```
 */
export function findArtistIds(results: Array<ArtistIdObject>): string {
  return results.map((i) => i.artist_id).join(', ')
}
