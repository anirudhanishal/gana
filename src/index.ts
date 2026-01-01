/**
 * @fileoverview Single-file Gaana API (Song Details Only).
 * * Requirement:
 * - API URL: https://gaana.com/apiv2?type=songDetail&seokey=...
 * - Live URL: /api/songs?seokey=...
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import * as crypto from 'crypto'

// ==========================================
// 1. CONFIGURATION & CONSTANTS
// ==========================================

const GAANA_API_URL = 'https://gaana.com/apiv2?type=songDetail&seokey='

// AES-128-CBC Keys for Decryption
const DEC_IV = Buffer.from('xC4dmVJAq14BfntX', 'utf-8')
const DEC_KEY = Buffer.from('gy1t#b@jl(b$wtme', 'utf-8')

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
]

// ==========================================
// 2. HELPER FUNCTIONS
// ==========================================

/**
 * Decrypts encrypted stream URLs from Gaana.
 */
function decryptLink(encryptedData: string): string {
  try {
    if (!encryptedData || encryptedData.length < 20) return encryptedData

    // Logic: Extract offset, slice IV, decode Base64, Decrypt AES-128-CBC
    const offset = parseInt(encryptedData[0], 10)
    if (isNaN(offset)) return encryptedData

    const ciphertextB64 = encryptedData.substring(offset + 16)
    const ciphertext = Buffer.from(ciphertextB64, 'base64')

    const decipher = crypto.createDecipheriv('aes-128-cbc', DEC_KEY, DEC_IV)
    decipher.setAutoPadding(false)

    let decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
    let rawText = decrypted.toString('utf-8')

    // Clean up characters
    rawText = rawText.replace(/[^\x20-\x7E]/g, '')

    // Fix HLS paths for playback
    if (rawText.includes('hls/')) {
      const pathStart = rawText.indexOf('hls/')
      const cleanPath = rawText.substring(pathStart)
      return `https://vodhlsgaana-ebw.akamaized.net/${cleanPath}`
    }
    
    return rawText || encryptedData
  } catch (e) {
    return encryptedData
  }
}

/**
 * Recursively finds and decrypts "message" fields inside "urls" objects.
 */
function traverseAndDecrypt(data: any): any {
  if (!data || typeof data !== 'object') return data

  // Check specific "urls" structure
  if (data.urls && typeof data.urls === 'object' && !Array.isArray(data.urls)) {
    const qualities = ['auto', 'high', 'medium', 'low']
    for (const quality of qualities) {
      if (data.urls[quality]?.message) {
        data.urls[quality].message = decryptLink(data.urls[quality].message)
      }
    }
  }

  // Traverse children
  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      const value = data[key]
      if (typeof value === 'object' && value !== null) {
        traverseAndDecrypt(value)
      }
    }
  }
  return data
}

/**
 * Fetches data from Gaana with browser-like headers.
 */
async function fetchSongDetails(seokey: string) {
  const url = `${GAANA_API_URL}${seokey}`
  const headers = {
    'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
    'Accept': 'application/json, text/plain, */*',
    'Origin': 'https://gaana.com',
    'Referer': 'https://gaana.com/'
  }

  const response = await fetch(url, { method: 'POST', headers })
  const json = await response.json()
  return json
}

// ==========================================
// 3. APP & ROUTES
// ==========================================

const app = new Hono()

// Middleware
app.use('*', cors())

/**
 * Main Route: Song Details
 * Endpoint: /api/songs?seokey=...
 */
app.get('/api/songs', async (c) => {
  try {
    // 1. Get Seokey
    const seokey = c.req.query('seokey')
    const urlParam = c.req.query('url')
    
    // Allow 'url' param too, but extract seokey from it if present
    let finalSeokey = seokey
    if (!finalSeokey && urlParam) {
       const parts = urlParam.split('/').filter(Boolean)
       finalSeokey = parts[parts.length - 1]
    }

    if (!finalSeokey) {
      return c.json({ error: 'Parameter "seokey" is required' }, 400)
    }

    // 2. Fetch from Gaana
    const rawData = await fetchSongDetails(finalSeokey) as any

    // 3. Validation
    if (!rawData || !rawData.tracks || !Array.isArray(rawData.tracks) || rawData.tracks.length === 0) {
      return c.json({ error: 'Song not found or invalid seokey' }, 404)
    }

    // 4. Decrypt URLs
    const songData = traverseAndDecrypt(rawData.tracks[0])

    // 5. Return
    return c.json(songData)
    
  } catch (error) {
    console.error(error)
    return c.json({ error: 'Internal Server Error' }, 500)
  }
})

/**
 * Root Route (Documentation)
 */
app.get('/', (c) => {
  return c.json({
    service: 'Gaana Song Details API',
    status: 'active',
    example: '/api/songs?seokey=aankhon-ki-gustakhiyan-maaf-ho'
  })
})

export default app