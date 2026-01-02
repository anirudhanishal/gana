/**
 * @fileoverview Single-file Gaana API (Songs, Albums, & Search).
 * * 1. Song Details
 * - Route: /api/songs?seokey={seokey}
 * - Source: type=songDetail
 * * 2. Album Details
 * - Route: /api/albums?seokey={seokey}
 * - Source: type=albumDetail
 * * 3. Song Search List
 * - Route: /api/search/songs?keyword={query}&page={0}
 * - Source: type=search&secType=track
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
async function fetchGaana(queryParams: Record<string, string>) {
  // Build query string
  const queryString = new URLSearchParams(queryParams).toString()
  const url = `${BASE_URL}?${queryString}`
  
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

    const rawData = await fetchGaana({
      type: 'songDetail',
      seokey: seokey
    })
    
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

    const rawData = await fetchGaana({
      type: 'albumDetail',
      seokey: seokey
    })
    
    const decryptedData = traverseAndDecrypt(rawData)
    return c.json(decryptedData)
  } catch (error) {
    return c.json({ error: 'Internal Server Error' }, 500)
  }
})

/**
 * 3. Song Search List Route
 * Endpoint: /api/search/songs?keyword=...&page=0
 */
app.get('/api/search/songs', async (c) => {
  try {
    const keyword = c.req.query('keyword')
    // Changed default page from '1' to '0'
    const page = c.req.query('page') || '0'
    const country = c.req.query('country') || 'IN'
    
    if (!keyword) return c.json({ error: 'Parameter "keyword" is required' }, 400)

    // Params: country=IN&keyword=...&page=...&secType=track&type=search
    const rawData = await fetchGaana({
      type: 'search',
      secType: 'track',
      country: country,
      keyword: keyword,
      page: page
    })

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
    service: 'Gaana API',
    status: 'active',
    endpoints: {
      song_details: '/api/songs?seokey=aankhon-ki-gustakhiyan-maaf-ho',
      album_details: '/api/albums?seokey=hum-dil-de-chuke-sanam',
      song_search: '/api/search/songs?keyword=Humane%20Sagar&page=0'
    }
  })
})

export default app