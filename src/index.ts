/**
 * @fileoverview Single-file Gaana API (Songs, Albums, Search, Artist & Label Data).
 * Provides endpoints to fetch and decrypt data directly from Gaana's API.
 * * Endpoints:
 * 1. Song Details: /api/songs
 * 2. Album Details: /api/albums
 * 3. Song Search: /api/search/songs
 * 4. Artist Song List: /api/artists/songs
 * 5. Artist Album List: /api/artists/albums
 * 6. Label Album List: /api/labels/albums
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
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
]

// ==========================================
// 2. HELPER FUNCTIONS
// ==========================================

/**
 * Decrypts encrypted stream URLs using AES-128-CBC.
 * Handles the custom Gaana encryption format including offset handling.
 */
function decryptLink(encryptedData: string): string {
  try {
    if (!encryptedData || encryptedData.length < 20) return encryptedData

    // Extract offset from the first character
    const offset = parseInt(encryptedData[0], 10)
    if (isNaN(offset)) return encryptedData

    // Slice the string to get the actual ciphertext (skipping offset + IV space)
    const ciphertextB64 = encryptedData.substring(offset + 16)
    const ciphertext = Buffer.from(ciphertextB64, 'base64')

    // Initialize decipher
    const decipher = crypto.createDecipheriv('aes-128-cbc', DEC_KEY, DEC_IV)
    decipher.setAutoPadding(false)

    // Decrypt
    let decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
    let rawText = decrypted.toString('utf-8')

    // Remove non-printable characters (padding cleanup)
    rawText = rawText.replace(/[^\x20-\x7E]/g, '')

    // Fix HLS paths to point to the correct Akamai CDN
    if (rawText.includes('hls/')) {
      const pathStart = rawText.indexOf('hls/')
      const cleanPath = rawText.substring(pathStart)
      return `https://vodhlsgaana-ebw.akamaized.net/${cleanPath}`
    }
    
    return rawText || encryptedData
  } catch (e) {
    // Return original data if decryption fails to avoid breaking the response
    return encryptedData
  }
}

/**
 * Recursively traverses the API response to find and decrypt "message" fields.
 * Handles both standard "urls" object and "stream_url" key-value patterns.
 */
function traverseAndDecrypt(data: any): any {
  if (!data || typeof data !== 'object') return data

  // Pattern 1: Standard Song/Album Details
  // Structure: "urls": { "auto": { "message": "..." } }
  if (data.urls && typeof data.urls === 'object' && !Array.isArray(data.urls)) {
    const qualities = ['auto', 'high', 'medium', 'low']
    for (const quality of qualities) {
      if (data.urls[quality]?.message) {
        data.urls[quality].message = decryptLink(data.urls[quality].message)
      }
    }
  }

  // Pattern 2: Lists (Artist/Label)
  // Structure: { "key": "stream_url", "value": { "medium": { "message": "..." } } }
  if (data.key === 'stream_url' && data.value && typeof data.value === 'object') {
    const qualities = ['auto', 'high', 'medium', 'low']
    for (const quality of qualities) {
      if (data.value[quality]?.message) {
        data.value[quality].message = decryptLink(data.value[quality].message)
      }
    }
  }

  // Recursively traverse all children
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
 * Generic fetch function to make requests to Gaana API.
 * Uses rotating User-Agents and standard headers.
 */
async function fetchGaana(queryParams: Record<string, string>) {
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
 * Helper to extract seokey from query parameters or URL string.
 */
function getSeokeyFromContext(c: any): string | null {
  const seokey = c.req.query('seokey')
  const urlParam = c.req.query('url')
  
  if (seokey) return seokey
  
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

// Global Middleware
app.use('*', cors())

/**
 * Route: Song Details
 * Method: GET
 * Endpoint: /api/songs
 * Params: seokey (required)
 */
app.get('/api/songs', async (c) => {
  try {
    const seokey = getSeokeyFromContext(c)
    if (!seokey) {
      return c.json({ error: 'Parameter "seokey" is required' }, 400)
    }

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
 * Route: Album Details
 * Method: GET
 * Endpoint: /api/albums
 * Params: seokey (required)
 */
app.get('/api/albums', async (c) => {
  try {
    const seokey = getSeokeyFromContext(c)
    if (!seokey) {
      return c.json({ error: 'Parameter "seokey" is required' }, 400)
    }

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
 * Route: Song Search List
 * Method: GET
 * Endpoint: /api/search/songs
 * Params: keyword (required), page (optional, default 0), country (optional, default IN)
 */
app.get('/api/search/songs', async (c) => {
  try {
    const keyword = c.req.query('keyword')
    const page = c.req.query('page') || '0'
    const country = c.req.query('country') || 'IN'
    
    if (!keyword) {
      return c.json({ error: 'Parameter "keyword" is required' }, 400)
    }

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
 * Route: Artist Song List
 * Method: GET
 * Endpoint: /api/artists/songs
 * Params: id (required), page (optional, default 0), sortBy (optional, default popularity)
 */
app.get('/api/artists/songs', async (c) => {
  try {
    const id = c.req.query('id')
    const page = c.req.query('page') || '0'
    const sortBy = c.req.query('sortBy') || 'popularity'
    const language = c.req.query('language') || ''
    const order = '0'

    if (!id) {
      return c.json({ error: 'Parameter "id" is required' }, 400)
    }

    const rawData = await fetchGaana({
      type: 'artistTrackList',
      id: id,
      language: language,
      order: order,
      page: page,
      sortBy: sortBy
    })

    const decryptedData = traverseAndDecrypt(rawData)
    return c.json(decryptedData)
  } catch (error) {
    return c.json({ error: 'Internal Server Error' }, 500)
  }
})

/**
 * Route: Artist Album List
 * Method: GET
 * Endpoint: /api/artists/albums
 * Params: id (required), page (optional, default 0), sortBy (optional, default popularity)
 */
app.get('/api/artists/albums', async (c) => {
  try {
    const id = c.req.query('id')
    const page = c.req.query('page') || '0'
    const sortBy = c.req.query('sortBy') || 'popularity'
    const order = '0'

    if (!id) {
      return c.json({ error: 'Parameter "id" is required' }, 400)
    }

    const rawData = await fetchGaana({
      type: 'artistAlbumList',
      id: id,
      order: order,
      page: page,
      sortBy: sortBy
    })

    const decryptedData = traverseAndDecrypt(rawData)
    return c.json(decryptedData)
  } catch (error) {
    return c.json({ error: 'Internal Server Error' }, 500)
  }
})

/**
 * Route: Label Album List
 * Method: GET
 * Endpoint: /api/labels/albums
 * Params: seokey (required), page (optional, default 0), sorting (optional, default popularity)
 */
app.get('/api/labels/albums', async (c) => {
  try {
    const seokey = getSeokeyFromContext(c)
    const page = c.req.query('page') || '0'
    const sorting = c.req.query('sorting') || 'popularity'

    if (!seokey) {
      return c.json({ error: 'Parameter "seokey" is required' }, 400)
    }

    const rawData = await fetchGaana({
      type: 'musiclabelalbums',
      seokey: seokey,
      page: page,
      sorting: sorting
    })

    const decryptedData = traverseAndDecrypt(rawData)
    return c.json(decryptedData)
  } catch (error) {
    return c.json({ error: 'Internal Server Error' }, 500)
  }
})

/**
 * Route: Root Documentation
 * Method: GET
 * Endpoint: /
 */
app.get('/', (c) => {
  return c.json({
    service: 'Gaana API',
    status: 'active',
    version: '1.0.0',
    endpoints: {
      song_details: '/api/songs?seokey=aankhon-ki-gustakhiyan-maaf-ho',
      album_details: '/api/albums?seokey=hum-dil-de-chuke-sanam',
      song_search: '/api/search/songs?keyword=Humane%20Sagar&page=0',
      artist_songs: '/api/artists/songs?id=1242888&page=0&sortBy=popularity',
      artist_albums: '/api/artists/albums?id=1&page=0&sortBy=popularity',
      label_albums: '/api/labels/albums?seokey=amara-muzik-one&page=0&sorting=popularity'
    }
  })
})

export default app