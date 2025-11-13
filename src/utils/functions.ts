/**
 * @fileoverview Legacy utility functions class for backward compatibility.
 * @deprecated This class is maintained for backward compatibility.
 * Use individual utility functions from their respective modules instead:
 * - `extractSeokey` from `utils/seokey`
 * - `findArtistNames`, `findArtistSeoKeys`, `findArtistIds` from `utils/artists`
 * - `findGenres` from `utils/genres`
 * - `isExplicit` from `utils/content`
 * @module utils/functions
 */

import { extractSeokey as extractSeokeyUtil } from './seokey.js'
import {
  findArtistNames as findArtistNamesUtil,
  findArtistSeoKeys as findArtistSeoKeysUtil,
  findArtistIds as findArtistIdsUtil
} from './artists.js'
import { findGenres as findGenresUtil } from './genres.js'
import { isExplicit as isExplicitUtil } from './content.js'

/**
 * Legacy utility functions class.
 * Re-exports individual utility functions for backward compatibility.
 *
 * @class Functions
 * @deprecated Use individual utility functions from their respective modules instead.
 */
export class Functions {
  /**
   * @deprecated Use `findArtistNames` from `utils/artists` instead.
   */
  findArtistNames(results: Array<{ name: string }>): string {
    return findArtistNamesUtil(results)
  }

  /**
   * @deprecated Use `findArtistSeoKeys` from `utils/artists` instead.
   */
  findArtistSeoKeys(results: Array<{ seokey: string }>): string {
    return findArtistSeoKeysUtil(results)
  }

  /**
   * @deprecated Use `findArtistIds` from `utils/artists` instead.
   */
  findArtistIds(results: Array<{ artist_id: string }>): string {
    return findArtistIdsUtil(results)
  }

  /**
   * @deprecated Use `findGenres` from `utils/genres` instead.
   */
  findGenres(results: Array<{ name: string }>): string {
    return findGenresUtil(results)
  }

  /**
   * @deprecated Use `isExplicit` from `utils/content` instead.
   */
  isExplicit(explicit: number): boolean {
    return isExplicitUtil(explicit)
  }

  /**
   * @deprecated Use `extractSeokey` from `utils/seokey` instead.
   */
  extractSeokey(input: string): string {
    return extractSeokeyUtil(input)
  }
}
