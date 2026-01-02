/**
 * @fileoverview Single-file Gaana API.
 * * Universal Root Endpoints:
 * 1. Link Handler: /?link={url} (Auto-detects Song, Album, or Label)
 * 2. Search Handler: /?search={query}&page={0}&country={IN}&limit={10}
 * * * Specific Endpoints:
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

    rawText = rawText.replace(/[^\x20-\x7E]/g, '')

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
 * Recursively traverses the API response to find and decrypt "message" fields.
 */
function traverseAndDecrypt(data: any): any {
  if (!data || typeof data !== 'object') return data

  if (data.urls && typeof data.urls === 'object' && !Array.isArray(data.urls)) {
    const qualities = ['auto', 'high', 'medium', 'low']
    for (const quality of qualities) {
      if (data.urls[quality]?.message) {
        data.urls[quality].message = decryptLink(data.urls[quality].message)
      }
    }
  }

  if (data.key === 'stream_url' && data.value && typeof data.value === 'object') {
    const qualities = ['auto', 'high', 'medium', 'low']
    for (const quality of qualities) {
      if (data.value[quality]?.message) {
        data.value[quality].message = decryptLink(data.value[quality].message)
      }
    }
  }

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
 * Limits the number of results in the search response.
 * Handles Gaana Search structure: { gr: [ { gd: [ ...tracks... ] } ] }
 */
function limitResults(data: any, limit: string | number | undefined): any {
  if (!data || !limit) return data
  
  const limitNum = parseInt(String(limit), 10)
  if (isNaN(limitNum) || limitNum <= 0) return data

  // Check for Search Response Structure "gr" -> "gd"
  if (data.gr && Array.isArray(data.gr)) {
    for (const group of data.gr) {
      if (group.gd && Array.isArray(group.gd)) {
        // Slice the array to the requested limit
        group.gd = group.gd.slice(0, limitNum)
      }
    }
  }
  
  return data
}

/**
 * Generic fetch function for Gaana API.
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
 * Helper to extract seokey from params or full URLs.
 */
function getSeokeyFromContext(c: any): string | null {
  const rawInput = c.req.query('seokey') || c.req.query('url')
  if (!rawInput) return null

  if (rawInput.includes('/')) {
     const parts = rawInput.split('/').filter((p: string) => p.trim() !== '')
     return parts.length > 0 ? parts[parts.length - 1] : null
  }
  return rawInput
}

/**
 * Helper to extract ID from a full Gaana URL string.
 */
function extractIdFromUrl(url: string): string {
  const parts = url.split('/').filter((p) => p.trim() !== '')
  return parts.length > 0 ? parts[parts.length - 1] : ''
}

// ==========================================
// 3. APP & ROUTES
// ==========================================

const app = new Hono()

app.use('*', cors())

/**
 * ROOT HANDLER:
 * 1. ?search={query} -> Search Songs (includes page, country, limit)
 * 2. ?link={url} -> Detect and Fetch Song/Album/Label
 */
app.get('/', async (c) => {
  const link = c.req.query('link')
  const search = c.req.query('search')

  // --- 1. SEARCH HANDLER ---
  if (search) {
    try {
      const page = c.req.query('page') || '0'
      const country = c.req.query('country') || 'IN'
      const limit = c.req.query('limit') // New Limit Parameter
      
      const rawData = await fetchGaana({
        country: country,
        page: page,
        secType: 'track',
        type: 'search',
        keyword: search
      })
      
      const limitedData = limitResults(rawData, limit)
      return c.json(traverseAndDecrypt(limitedData))
    } catch (error) {
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  }

  // --- 2. LINK HANDLER ---
  if (link) {
    try {
      let type = ''
      let seokey = extractIdFromUrl(link)
      let extraParams: Record<string, string> = {}

      if (link.includes('/song/')) {
        type = 'songDetail'
      } else if (link.includes('/album/')) {
        type = 'albumDetail'
      } else if (link.includes('/music-label/')) {
        type = 'musiclabelalbums'
        extraParams = { page: '0', sorting: 'popularity' }
      } else {
        return c.json({ error: 'Unsupported link type. Use Song, Album, or Label URL.' }, 400)
      }

      const rawData = await fetchGaana({
        type: type,
        seokey: seokey,
        ...extraParams
      })

      return c.json(traverseAndDecrypt(rawData))
    } catch (error) {
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  }

  // --- 3. DOCUMENTATION ---
  return c.json({
    service: 'Gaana API',
    status: 'active',
    usage: {
      universal_search: '/?search=Humane%20Sagar&limit=5',
      universal_link: '/?link=https://gaana.com/song/kudi-jach-gayi-14',
      song_details: '/api/songs?seokey=kudi-jach-gayi-14',
      album_details: '/api/albums?seokey=aau-ketedina-odia',
      label_albums: '/api/labels/albums?seokey=rajshri-music',
      search: '/api/search/songs?keyword=Humane%20Sagar&limit=3',
      artist_songs: '/api/artists/songs?id=1242888',
      artist_albums: '/api/artists/albums?id=1'
    }
  })
})

// --- Specific API Endpoints ---

// 1. Song Details
app.get('/api/songs', async (c) => {
  try {
    const seokey = getSeokeyFromContext(c)
    if (!seokey) return c.json({ error: 'seokey/url required' }, 400)
    const rawData = await fetchGaana({ type: 'songDetail', seokey })
    return c.json(traverseAndDecrypt(rawData))
  } catch (error) { return c.json({ error: 'Error' }, 500) }
})

// 2. Album Details
app.get('/api/albums', async (c) => {
  try {
    const seokey = getSeokeyFromContext(c)
    if (!seokey) return c.json({ error: 'seokey/url required' }, 400)
    const rawData = await fetchGaana({ type: 'albumDetail', seokey })
    return c.json(traverseAndDecrypt(rawData))
  } catch (error) { return c.json({ error: 'Error' }, 500) }
})

// 3. Search (With Limit Support)
app.get('/api/search/songs', async (c) => {
  try {
    const keyword = c.req.query('keyword')
    const page = c.req.query('page') || '0'
    const country = c.req.query('country') || 'IN'
    const limit = c.req.query('limit') // New Limit Parameter

    if (!keyword) return c.json({ error: 'keyword required' }, 400)
    
    const rawData = await fetchGaana({
      country: country,
      page: page,
      secType: 'track',
      type: 'search',
      keyword: keyword
    })

    const limitedData = limitResults(rawData, limit)
    return c.json(traverseAndDecrypt(limitedData))
  } catch (error) { return c.json({ error: 'Error' }, 500) }
})

// 4. Artist Songs
app.get('/api/artists/songs', async (c) => {
  try {
    const id = c.req.query('id')
    const page = c.req.query('page') || '0'
    const sortBy = c.req.query('sortBy') || 'popularity'
    if (!id) return c.json({ error: 'id required' }, 400)
    const rawData = await fetchGaana({ type: 'artistTrackList', id, order: '0', page, sortBy })
    return c.json(traverseAndDecrypt(rawData))
  } catch (error) { return c.json({ error: 'Error' }, 500) }
})

// 5. Artist Albums
app.get('/api/artists/albums', async (c) => {
  try {
    const id = c.req.query('id')
    const page = c.req.query('page') || '0'
    const sortBy = c.req.query('sortBy') || 'popularity'
    if (!id) return c.json({ error: 'id required' }, 400)
    const rawData = await fetchGaana({ type: 'artistAlbumList', id, order: '0', page, sortBy })
    return c.json(traverseAndDecrypt(rawData))
  } catch (error) { return c.json({ error: 'Error' }, 500) }
})

// 6. Label Albums
app.get('/api/labels/albums', async (c) => {
  try {
    const seokey = getSeokeyFromContext(c)
    const page = c.req.query('page') || '0'
    const sorting = c.req.query('sorting') || 'popularity'
    if (!seokey) return c.json({ error: 'seokey/url required' }, 400)
    const rawData = await fetchGaana({ type: 'musiclabelalbums', seokey, page, sorting })
    return c.json(traverseAndDecrypt(rawData))
  } catch (error) { return c.json({ error: 'Error' }, 500) }
})

export default app