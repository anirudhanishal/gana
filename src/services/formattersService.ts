/**
 * @fileoverview Formatters service for passing through raw Gaana API responses.
 * Configured to return original data with specific URL decryption logic.
 * @module services/formattersService
 */

import { BaseService } from './baseService.js'
import * as crypto from 'crypto'

/**
 * Service class for handling API responses.
 * Configured to return raw data but decrypts specific stream URLs.
 *
 * @class FormattersService
 */
export class FormattersService extends BaseService {
  // Key and IV constants derived from the provided decryption logic
  private readonly IV = Buffer.from('xC4dmVJAq14BfntX', 'utf-8')
  private readonly KEY = Buffer.from('gy1t#b@jl(b$wtme', 'utf-8')

  /**
   * Decrypts the Gaana stream URL message.
   * Logic ported from Python:
   * 1. Extract offset from first char.
   * 2. Slice encrypted data after offset + 16 (IV length).
   * 3. Base64 decode.
   * 4. AES-128-CBC decrypt.
   * 5. Filter printable characters and reconstruct URL.
   */
  private decryptLink(encryptedData: string): string {
    try {
      if (!encryptedData || encryptedData.length < 20) return encryptedData

      const offset = parseInt(encryptedData[0], 10)
      if (isNaN(offset)) return encryptedData

      // Extract Ciphertext (skipping offset + 16-char IV string)
      const ciphertextB64 = encryptedData.substring(offset + 16)
      const ciphertext = Buffer.from(ciphertextB64, 'base64')

      const decipher = crypto.createDecipheriv('aes-128-cbc', this.KEY, this.IV)
      // Disable auto padding to handle raw bytes manually like the Python script
      decipher.setAutoPadding(false)

      let decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
      let rawText = decrypted.toString('utf-8')

      // Remove non-printable characters (equivalent to python's filter(lambda x: x.isprintable()))
      // This handles PKCS7 padding and other noise
      rawText = rawText.replace(/[^\x20-\x7E]/g, '')

      // Check for valid HLS path
      if (rawText.includes('hls/')) {
        const pathStart = rawText.indexOf('hls/')
        const cleanPath = rawText.substring(pathStart)
        return `https://vodhlsgaana-ebw.akamaized.net/${cleanPath}`
      }
      
      return rawText || encryptedData
    } catch (error) {
      // Return original on failure to avoid breaking the response
      return encryptedData
    }
  }

  /**
   * Recursively traverses the object to find and decrypt "urls" objects.
   * Target pattern:
   * "urls": {
   * "quality": {
   * "message": "ENCRYPTED_STRING",
   * ...
   * }
   * }
   */
  private traverseAndDecrypt(data: any): any {
    if (!data || typeof data !== 'object') return data

    // Check if we hit the "urls" node
    if (data.urls && typeof data.urls === 'object' && !Array.isArray(data.urls)) {
      const qualities = ['auto', 'high', 'medium', 'low']
      for (const quality of qualities) {
        if (data.urls[quality] && data.urls[quality].message) {
          // Replace the encrypted message with the decrypted URL
          data.urls[quality].message = this.decryptLink(data.urls[quality].message)
        }
      }
    }

    // Recursively traverse children (works for both Arrays and Objects)
    for (const key in data) {
        // Skip prototype properties
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            const value = data[key]
            if (typeof value === 'object' && value !== null) {
                this.traverseAndDecrypt(value)
            }
        }
    }

    return data
  }

  /**
   * Returns raw playlist search API response with decrypted URLs.
   */
  formatJsonPlaylistSearch(result: unknown, limit: number): any {
    return this.traverseAndDecrypt(result)
  }

  /**
   * Returns raw album search result object with decrypted URLs.
   */
  formatJsonAlbumSearch(album: Record<string, unknown>): any {
    return this.traverseAndDecrypt(album)
  }

  /**
   * Returns raw album detail API response with decrypted URLs.
   */
  async formatJsonAlbumDetails(results: unknown): Promise<any> {
    return this.traverseAndDecrypt(results)
  }

  /**
   * Returns raw album API response with decrypted URLs.
   */
  async formatJsonAlbums(results: unknown, info: boolean): Promise<any> {
    return this.traverseAndDecrypt(results)
  }

  /**
   * Returns raw song/track API response with decrypted URLs.
   */
  async formatJsonSongs(results: Record<string, unknown>): Promise<any> {
    return this.traverseAndDecrypt(results)
  }

  /**
   * Returns raw song full details API response with decrypted URLs.
   */
  async formatJsonSongFullDetails(results: Record<string, unknown>): Promise<any> {
    return this.traverseAndDecrypt(results)
  }

  /**
   * Returns raw song details API response with decrypted URLs.
   */
  async formatJsonSongDetails(results: Record<string, unknown>): Promise<any> {
    return this.traverseAndDecrypt(results)
  }

  /**
   * Returns raw chart API response with decrypted URLs.
   */
  async formatJsonCharts(results: unknown): Promise<any> {
    return this.traverseAndDecrypt(results)
  }

  /**
   * Returns raw playlist API response with decrypted URLs.
   */
  async formatJsonPlaylists(results: unknown): Promise<any> {
    return this.traverseAndDecrypt(results)
  }

  /**
   * Returns raw new releases API response with decrypted URLs.
   */
  async formatJsonNewReleases(results: unknown): Promise<any> {
    return this.traverseAndDecrypt(results)
  }

  /**
   * Returns raw trending API response with decrypted URLs.
   */
  async formatJsonTrending(results: unknown): Promise<any> {
    return this.traverseAndDecrypt(results)
  }

  /**
   * Returns raw artist details API response with decrypted URLs.
   */
  async formatJsonArtistInfo(results: unknown): Promise<any> {
    return this.traverseAndDecrypt(results)
  }

  /**
   * Returns raw artist top tracks API response with decrypted URLs.
   */
  async formatJsonArtistTopTracks(results: unknown): Promise<any> {
    return this.traverseAndDecrypt(results)
  }
}