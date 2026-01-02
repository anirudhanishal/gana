/**
 * @fileoverview Single-file Gaana API (Songs & Albums).
 * * 1. Song Details
 * - API: https://gaana.com/apiv2?seokey={seokey}&type=songDetail
 * - Route: /api/songs?seokey={seokey}
 * * 2. Album Details
 * - API: https://gaana.com/apiv2?seokey={seokey}&type=albumDetail
 * - Route: /api/albums?seokey={seokey}
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import * as crypto from 'crypto'

// ==========================================
// 1. CONFIGURATION
// ==========================================

const BASE_URL = 'https://gaana.com/apiv2'

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
 * Decrypts encrypted stream URLs.
 */
function decryptLink(encryptedData: string): string {
  try {
    if (!encryptedData || encryptedData.length < 20) return encryptedData

    const offset = parseInt(encryptedData[0], 10)
    if (isNaN(offset)) return encryptedData

    const ciphertextB64 = encryptedData.substring(offset + 16)
    const ciphertext = Buffer.from(ciphertextB64, 'base64')

    const decipher = crypto.createDecipheriv('aes-128-cbc', DEC_KEY, DEC_IV)
    decipher.setAutoPadding(false)

    let decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
    let rawText = decrypted.toString('utf-8')

    // Clean up
    rawText = rawText.replace(/[^\x20-\x7E]/g, '')

    // Fix HLS paths
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
 * Generic fetcher for Gaana API.
 */
async function fetchGaanaData(seokey: string, type: 'songDetail' | 'albumDetail') {
  // Construct URL exactly as requested
  const url = `${BASE_URL}?seokey=${seokey}&type=${type}`
  
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

/**
 * Helper to extract seokey from params
 */
function getSeokeyFromContext(c: any): string | null {
  const seokey = c.req.query('seokey')
  const urlParam = c.req.query('url')
  
  if (seokey) return seokey
  
  // Fallback extraction if user passes full url
  if (urlParam) {
     const parts = urlParam.split('/').filter(Boolean)
     return parts[parts.length - 1]
  }
  return null
}

// ==========================================
// 3. APP & ROUTES
// ==========================================

const app = new Hono()

app.use('*', cors())

/**
 * 1. Song Details Route
 * Endpoint: /api/songs?seokey=...
 */
app.get('/api/songs', async (c) => {
  try {
    const seokey = getSeokeyFromContext(c)
    if (!seokey) return c.json({ error: 'Parameter "seokey" is required' }, 400)

    const rawData = await fetchGaanaData(seokey, 'songDetail')
    const decryptedData = traverseAndDecrypt(rawData)

    return c.json(decryptedData)
  } catch (error) {
    return c.json({ error: 'Internal Server Error' }, 500)
  }
})

/**
 * 2. Album Details Route
 * Endpoint: /api/albums?seokey=...
 */
app.get('/api/albums', async (c) => {
  try {
    const seokey = getSeokeyFromContext(c)
    if (!seokey) return c.json({ error: 'Parameter "seokey" is required' }, 400)

    const rawData = await fetchGaanaData(seokey, 'albumDetail')
    const decryptedData = traverseAndDecrypt(rawData)

    return c.json(decryptedData)
  } catch (error) {
    return c.json({ error: 'Internal Server Error' }, 500)
  }
})

/**
 * Root Route (Documentation)
 */
app.get('/', (c) => {
  return c.json({
    service: 'Gaana API (Songs & Albums)',
    status: 'active',
    endpoints: {
      song: '/api/songs?seokey=aankhon-ki-gustakhiyan-maaf-ho',
      album: '/api/albums?seokey=hum-dil-de-chuke-sanam'
    }
  })
})

export default app