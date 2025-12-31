/**
 * @fileoverview Formatters service for passing through raw Gaana API responses.
 * Configured to return original, unmodified data as requested.
 * @module services/formattersService
 */

import { BaseService } from './baseService.js'

/**
 * Service class for handling API responses.
 * Configured to return raw data without transformation.
 *
 * @class FormattersService
 */
export class FormattersService extends BaseService {
  /**
   * Returns raw playlist search API response.
   * @param result - The raw API response
   * @param limit - Ignored to preserve raw data
   */
  formatJsonPlaylistSearch(result: unknown, limit: number): any {
    return result
  }

  /**
   * Returns raw album search result object.
   * @param album - The raw album object
   */
  formatJsonAlbumSearch(album: Record<string, unknown>): any {
    return album
  }

  /**
   * Returns raw album detail API response.
   * @param results - The raw API response
   */
  async formatJsonAlbumDetails(results: unknown): Promise<any> {
    return results
  }

  /**
   * Returns raw album API response.
   * @param results - The raw API response
   * @param info - Ignored to preserve raw data
   */
  async formatJsonAlbums(results: unknown, info: boolean): Promise<any> {
    return results
  }

  /**
   * Returns raw song/track API response.
   * @param results - The raw API response
   */
  async formatJsonSongs(results: Record<string, unknown>): Promise<any> {
    return results
  }

  /**
   * Returns raw song full details API response.
   * @param results - The raw API response
   */
  async formatJsonSongFullDetails(results: Record<string, unknown>): Promise<any> {
    return results
  }

  /**
   * Returns raw song details API response.
   * @param results - The raw API response
   */
  async formatJsonSongDetails(results: Record<string, unknown>): Promise<any> {
    return results
  }

  /**
   * Returns raw chart API response.
   * @param results - The raw API response
   */
  async formatJsonCharts(results: unknown): Promise<any> {
    return results
  }

  /**
   * Returns raw playlist API response.
   * @param results - The raw API response
   */
  async formatJsonPlaylists(results: unknown): Promise<any> {
    return results
  }

  /**
   * Returns raw new releases API response.
   * @param results - The raw API response
   */
  async formatJsonNewReleases(results: unknown): Promise<any> {
    return results
  }

  /**
   * Returns raw trending API response.
   * @param results - The raw API response
   */
  async formatJsonTrending(results: unknown): Promise<any> {
    return results
  }

  /**
   * Returns raw artist details API response.
   * @param results - The raw API response
   */
  async formatJsonArtistInfo(results: unknown): Promise<any> {
    return results
  }

  /**
   * Returns raw artist top tracks API response.
   * @param results - The raw API response
   */
  async formatJsonArtistTopTracks(results: unknown): Promise<any> {
    return results
  }
}