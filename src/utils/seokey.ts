/**
 * @fileoverview SEO key extraction utilities for parsing Gaana URLs and identifiers.
 * @module utils/seokey
 */

/**
 * Extracts the seokey from a Gaana URL or returns the input if already a seokey.
 *
 * Supports multiple URL formats:
 * - Full URLs: `https://gaana.com/song/tune-ka-mathabhar`
 * - HTTP URLs: `http://gaana.com/album/thriller`
 * - Protocol-less: `gaana.com/artist/arijit-singh`
 * - With www: `www.gaana.com/playlist/hits-2024`
 * - Plain seokey: `tune-ka-mathabhar`
 *
 * Also handles URLs with query parameters and fragments:
 * - `https://gaana.com/song/seokey?param=value`
 * - `https://gaana.com/song/seokey#fragment`
 *
 * @param {string} input - Gaana URL or seokey string
 * @returns {string} Extracted seokey, or empty string if invalid
 *
 * @example
 * ```typescript
 * extractSeokey("https://gaana.com/song/tune-ka-mathabhar")
 * // Returns: "tune-ka-mathabhar"
 *
 * extractSeokey("gaana.com/album/thriller?ref=home")
 * // Returns: "thriller"
 *
 * extractSeokey("tune-ka-mathabhar")
 * // Returns: "tune-ka-mathabhar"
 * ```
 */
export function extractSeokey(input: string): string {
  if (!input) return ''

  // Remove leading/trailing whitespace
  const trimmed = input.trim()
  if (!trimmed) return ''

  // Try to match URL patterns (with or without protocol)
  // Matches: https://gaana.com/song/seokey, http://gaana.com/song/seokey, gaana.com/song/seokey
  // Also handles URLs with query params, fragments, etc.
  const urlPatterns = [
    /(?:https?:\/\/)?(?:www\.)?gaana\.com\/(song|album|artist|playlist)\/([a-zA-Z0-9\-]+)/i,
    /gaana\.com\/(song|album|artist|playlist)\/([a-zA-Z0-9\-]+)/i
  ]

  for (const pattern of urlPatterns) {
    const match = trimmed.match(pattern)
    if (match && match[2]) {
      return match[2]
    }
  }

  // If no URL pattern matched, assume it's already a seokey
  // Remove any query params or fragments if present
  const seokey = trimmed.split('?')[0].split('#')[0]
  return seokey
}

