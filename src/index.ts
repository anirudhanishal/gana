/**
 * @fileoverview Single-file Gaana API.
 * * * * DIRECT ROOT MAPPINGS (Strict Priority):
 * 1. Label Albums:  /?labels={seokey}&page={0}&limit={10}&sorting={popularity}
 * 2. Artist Songs:  /?artistssongsid={id}&page={0}&limit={10}&sortBy={popularity}
 * 3. Artist Albums: /?artistsalbumsid={id}&page={0}&limit={10}&sortBy={popularity}
 * 4. Song Search:   /?search={query}&page={0}&limit={10}
 * 5. Universal Link:/?link={url} (Auto-detects Song/Album/Label)
 * * * * * API ENDPOINTS (Legacy Support):
 * /api/songs, /api/albums, /api/search/songs, /api/artists/songs, /api/artists/albums, /api/labels/albums
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
 * Returns the correct batch size for a specific Gaana API type.
 * - musiclabelalbums: Returns 50 items (Special Case)
 * - artistTrackList/artistAlbumList/search: Returns 20 items (Standard)
 */
function getBatchSize(type: string): number {
  if (type === 'musiclabelalbums') {
    return 50
  }
  return 20
}

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
  } catch (e) { return encryptedData }
}

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

function applySlice(data: any, start: number, end: number | undefined): any {
  if (!data) return data
  if (data.gr && Array.isArray(data.gr)) {
    for (const group of data.gr) {
      if (group.gd && Array.isArray(group.gd)) {
        group.gd = group.gd.slice(start, end)
      }
    }
  }
  return data
}

function applySliceToEntities(data: any, start: number, end: number | undefined): any {
  if (!data) return data
  if (data.entities && Array.isArray(data.entities)) {
    data.entities = data.entities.slice(start, end)
  }
  return data
}

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

function extractIdFromUrl(url: string): string {
  const parts = url.split('/').filter((p) => p.trim() !== '')
  return parts.length > 0 ? parts[parts.length - 1] : ''
}

function getPagination(pageStr: string | undefined, limitStr: string | undefined, batchSize: number) {
  const limit = parseInt(limitStr || '10', 10) || 10
  const page = parseInt(pageStr || '0', 10) || 0
  const totalOffset = page * limit
  
  const gaanaPage = Math.floor(totalOffset / batchSize).toString()
  const sliceStart = totalOffset % batchSize
  const sliceEnd = sliceStart + limit
  
  return { gaanaPage, sliceStart, sliceEnd }
}

function getSeokeyFromContext(c: any): string | null {
  const rawInput = c.req.query('seokey') || c.req.query('url')
  if (!rawInput) return null
  if (rawInput.includes('/')) {
     const parts = rawInput.split('/').filter((p: string) => p.trim() !== '')
     return parts.length > 0 ? parts[parts.length - 1] : null
  }
  return rawInput
}

// ==========================================
// 3. APP & ROUTES
// ==========================================

const app = new Hono()
app.use('*', cors())

/**
 * ROOT HANDLER: Strictly Enforced Priority Order
 */
app.get('/', async (c) => {
  const q = c.req.query()
  
  // Common Params
  const page = q.page || '0'
  const limit = q.limit || '10'
  const country = q.country || 'IN'
  
  // Allow both 'sorting' (labels) and 'sortBy' (artists) to control order
  const sorting = q.sorting || q.sortBy || 'popularity'

  try {
    // 1. Label Albums (?labels={seokey})
    if (q.labels) {
      const batchSize = getBatchSize('musiclabelalbums') // 50
      const { gaanaPage, sliceStart, sliceEnd } = getPagination(page, limit, batchSize)
      
      const rawData = await fetchGaana({
        type: 'musiclabelalbums',
        seokey: q.labels,
        page: gaanaPage,
        sorting: sorting
      })
      return c.json(applySliceToEntities(traverseAndDecrypt(rawData), sliceStart, sliceEnd))
    }

    // 2. Artist Songs (?artistssongsid={id})
    if (q.artistssongsid) {
      const batchSize = getBatchSize('artistTrackList') // 20
      const { gaanaPage, sliceStart, sliceEnd } = getPagination(page, limit, batchSize)

      const rawData = await fetchGaana({
        type: 'artistTrackList',
        id: q.artistssongsid,
        order: '0',
        page: gaanaPage,
        sortBy: sorting
      })
      return c.json(applySliceToEntities(traverseAndDecrypt(rawData), sliceStart, sliceEnd))
    }

    // 3. Artist Albums (?artistsalbumsid={id})
    if (q.artistsalbumsid) {
      const batchSize = getBatchSize('artistAlbumList') // 20
      const { gaanaPage, sliceStart, sliceEnd } = getPagination(page, limit, batchSize)

      const rawData = await fetchGaana({
        type: 'artistAlbumList',
        id: q.artistsalbumsid,
        order: '0',
        page: gaanaPage,
        sortBy: sorting
      })
      return c.json(applySliceToEntities(traverseAndDecrypt(rawData), sliceStart, sliceEnd))
    }

    // 4. Song Search (?search={query})
    if (q.search) {
      const batchSize = getBatchSize('search') // 20
      const { gaanaPage, sliceStart, sliceEnd } = getPagination(page, limit, batchSize)

      const rawData = await fetchGaana({
        country: country,
        page: gaanaPage,
        secType: 'track',
        type: 'search',
        keyword: q.search
      })
      return c.json(applySlice(traverseAndDecrypt(rawData), sliceStart, sliceEnd))
    }

    // 5. Universal Link (?link={url})
    if (q.link) {
      const seokey = extractIdFromUrl(q.link)
      let fetchParams: any = { seokey }
      let isList = false
      let listType = ''
      
      if (q.link.includes('/song/')) {
        fetchParams.type = 'songDetail'
      } else if (q.link.includes('/album/')) {
        fetchParams.type = 'albumDetail'
      } else if (q.link.includes('/music-label/')) {
        fetchParams.type = 'musiclabelalbums'
        fetchParams.sorting = sorting
        isList = true
        listType = 'musiclabelalbums'
      } else {
        return c.json({ error: 'Unsupported link type. Only Song, Album, or Label URLs supported.' }, 400)
      }

      if (isList) {
        const batchSize = getBatchSize(listType)
        const { gaanaPage, sliceStart, sliceEnd } = getPagination(page, limit, batchSize)
        fetchParams.page = gaanaPage
        
        const rawData = await fetchGaana(fetchParams)
        return c.json(applySliceToEntities(traverseAndDecrypt(rawData), sliceStart, sliceEnd))
      } else {
        const rawData = await fetchGaana(fetchParams)
        return c.json(traverseAndDecrypt(rawData))
      }
    }

    // Documentation
    return c.json({
      service: 'Gaana API',
      status: 'active',
      usage: {
        labels: '/?labels=amara-muzik-one&page=0&limit=10&sorting=popularity',
        artist_songs: '/?artistssongsid=1242888&page=0&limit=10&sortBy=popularity',
        artist_albums: '/?artistsalbumsid=1&page=0&limit=10&sortBy=popularity',
        search: '/?search=Humane%20Sagar&limit=10',
        link: '/?link=https://gaana.com/song/kudi-jach-gayi-14'
      }
    })

  } catch (error) {
    return c.json({ error: 'Internal Server Error' }, 500)
  }
})

// --- SPECIFIC API ROUTES (Standard wrappers for specific logic) ---

app.get('/api/songs', async (c) => {
  const seokey = getSeokeyFromContext(c)
  if (!seokey) return c.json({ error: 'seokey required' }, 400)
  return c.json(traverseAndDecrypt(await fetchGaana({ type: 'songDetail', seokey })))
})

app.get('/api/albums', async (c) => {
  const seokey = getSeokeyFromContext(c)
  if (!seokey) return c.json({ error: 'seokey required' }, 400)
  return c.json(traverseAndDecrypt(await fetchGaana({ type: 'albumDetail', seokey })))
})

app.get('/api/labels/albums', async (c) => {
  const seokey = getSeokeyFromContext(c)
  if (!seokey) return c.json({ error: 'seokey required' }, 400)
  const { gaanaPage, sliceStart, sliceEnd } = getPagination(c.req.query('page'), c.req.query('limit'), 50)
  const data = await fetchGaana({ type: 'musiclabelalbums', seokey, page: gaanaPage, sorting: c.req.query('sorting')||'popularity' })
  return c.json(applySliceToEntities(traverseAndDecrypt(data), sliceStart, sliceEnd))
})

app.get('/api/search/songs', async (c) => {
  const keyword = c.req.query('keyword')
  if (!keyword) return c.json({ error: 'keyword required' }, 400)
  const { gaanaPage, sliceStart, sliceEnd } = getPagination(c.req.query('page'), c.req.query('limit'), 20)
  const data = await fetchGaana({ country: c.req.query('country')||'IN', page: gaanaPage, secType: 'track', type: 'search', keyword })
  return c.json(applySlice(traverseAndDecrypt(data), sliceStart, sliceEnd))
})

app.get('/api/artists/songs', async (c) => {
  const id = c.req.query('id')
  if (!id) return c.json({ error: 'id required' }, 400)
  const { gaanaPage, sliceStart, sliceEnd } = getPagination(c.req.query('page'), c.req.query('limit'), 20)
  const data = await fetchGaana({ type: 'artistTrackList', id, order: '0', page: gaanaPage, sortBy: c.req.query('sortBy')||'popularity' })
  return c.json(applySliceToEntities(traverseAndDecrypt(data), sliceStart, sliceEnd))
})

app.get('/api/artists/albums', async (c) => {
  const id = c.req.query('id')
  if (!id) return c.json({ error: 'id required' }, 400)
  const { gaanaPage, sliceStart, sliceEnd } = getPagination(c.req.query('page'), c.req.query('limit'), 20)
  const data = await fetchGaana({ type: 'artistAlbumList', id, order: '0', page: gaanaPage, sortBy: c.req.query('sortBy')||'popularity' })
  return c.json(applySliceToEntities(traverseAndDecrypt(data), sliceStart, sliceEnd))
})

export default app