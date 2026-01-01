/**
 * @fileoverview Single-file Gaana Song Details API.
 * Contains all logic: Server, Middleware, Services, Utilities, and Validation.
 */

import { Hono, Context, Next } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import { z } from 'zod'
import * as crypto from 'crypto'

// ==========================================
// 1. CONSTANTS
// ==========================================

const apiEndpoints = {
  songDetailsUrl: 'https://gaana.com/apiv2?type=songDetail&seokey=',
} as const

const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
]

// ==========================================
// 2. UTILITIES
// ==========================================

function getRandomUserAgent(): string {
  return userAgents[Math.floor(Math.random() * userAgents.length)]
}

function getBrowserHeaders(): Record<string, string> {
  const ua = getRandomUserAgent()
  return {
    'User-Agent': ua,
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    Origin: 'https://gaana.com',
    Referer: 'https://gaana.com/',
  }
}

/**
 * Extracts seokey from a URL or returns the input if it's already a seokey.
 */
function extractSeokey(input: string): string | null {
  if (!input) return null
  try {
    // If it looks like a URL
    if (input.startsWith('http')) {
      const url = new URL(input)
      // specific logic for gaana.com/song/seokey
      const parts = url.pathname.split('/').filter(Boolean)
      return parts.length > 0 ? parts[parts.length - 1] : null
    }
    return input
  } catch {
    return input // fallback
  }
}

// ==========================================
// 3. VALIDATION SCHEMAS (ZOD)
// ==========================================

const validationSchemas = {
  seokey: z
    .string()
    .min(1, 'Seokey is required')
    .max(500, 'Seokey is too long')
    .refine((val) => val.trim().length > 0, 'Seokey cannot be empty')
    .refine((val) => !/[<>'"&]/.test(val), 'Seokey contains invalid characters'),
}

// ==========================================
// 4. SERVICES
// ==========================================

class BaseService {
  protected async fetchJson(
    url: string,
    method: 'GET' | 'POST' = 'POST',
    headers: Record<string, string> = {},
    timeout: number = 5000
  ): Promise<unknown> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const finalHeaders = { ...getBrowserHeaders(), ...headers }
      const response = await fetch(url, {
        method,
        headers: finalHeaders,
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      return await response.json()
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout')
      }
      throw error
    }
  }
}

class FormattersService extends BaseService {
  private readonly IV = Buffer.from('xC4dmVJAq14BfntX', 'utf-8')
  private readonly KEY = Buffer.from('gy1t#b@jl(b$wtme', 'utf-8')

  private decryptLink(encryptedData: string): string {
    try {
      if (!encryptedData || encryptedData.length < 20) return encryptedData

      const offset = parseInt(encryptedData[0], 10)
      if (isNaN(offset)) return encryptedData

      const ciphertextB64 = encryptedData.substring(offset + 16)
      const ciphertext = Buffer.from(ciphertextB64, 'base64')

      const decipher = crypto.createDecipheriv('aes-128-cbc', this.KEY, this.IV)
      decipher.setAutoPadding(false)

      let decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
      let rawText = decrypted.toString('utf-8')

      // Remove non-printable characters
      rawText = rawText.replace(/[^\x20-\x7E]/g, '')

      if (rawText.includes('hls/')) {
        const pathStart = rawText.indexOf('hls/')
        const cleanPath = rawText.substring(pathStart)
        return `https://vodhlsgaana-ebw.akamaized.net/${cleanPath}`
      }
      
      return rawText || encryptedData
    } catch (error) {
      return encryptedData
    }
  }

  private traverseAndDecrypt(data: any): any {
    if (!data || typeof data !== 'object') return data

    if (data.urls && typeof data.urls === 'object' && !Array.isArray(data.urls)) {
      const qualities = ['auto', 'high', 'medium', 'low']
      for (const quality of qualities) {
        if (data.urls[quality] && data.urls[quality].message) {
          data.urls[quality].message = this.decryptLink(data.urls[quality].message)
        }
      }
    }

    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        const value = data[key]
        if (typeof value === 'object' && value !== null) {
          this.traverseAndDecrypt(value)
        }
      }
    }

    return data
  }

  async formatJsonSongFullDetails(results: Record<string, unknown>): Promise<any> {
    return this.traverseAndDecrypt(results)
  }
}

class DetailsService extends BaseService {
  private formatters: FormattersService

  constructor() {
    super()
    this.formatters = new FormattersService()
  }

  async getSongInfo(seokey: string): Promise<Record<string, unknown>> {
    const url = apiEndpoints.songDetailsUrl + seokey
    const result = await this.fetchJson(url)

    if (!result || typeof result !== 'object') {
      return { error: 'Song not found' }
    }

    const r = result as { tracks?: Array<Record<string, unknown>> }
    if (!r.tracks || !Array.isArray(r.tracks) || r.tracks.length === 0) {
      return { error: 'Song not found' }
    }

    return await this.formatters.formatJsonSongFullDetails(r.tracks[0])
  }
}

// Singleton Instance
const detailsService = new DetailsService()

// ==========================================
// 5. HANDLERS
// ==========================================

async function handleGetSong(c: Context) {
  // 1. Get Input
  const pathParam = c.req.param('seokey')
  const queryParam = c.req.query('url') || c.req.query('seokey')
  const input = pathParam || queryParam

  if (!input) {
    return c.json({ error: 'Seokey or URL is required' }, 400)
  }

  // 2. Validate
  const validation = validationSchemas.seokey.safeParse(input)
  if (!validation.success) {
    return c.json({ error: validation.error.issues[0]?.message || 'Invalid input' }, 400)
  }

  try {
    // 3. Extract Seokey
    const seokey = extractSeokey(validation.data)
    if (!seokey) {
      return c.json({ error: 'Invalid URL or Seokey format' }, 400)
    }

    // 4. Fetch Data
    const songInfo = await detailsService.getSongInfo(seokey)

    if (songInfo.error) {
      return c.json(songInfo, 404)
    }

    return c.json(songInfo)
  } catch (err) {
    console.error('Get song error:', err)
    return c.json({ error: err instanceof Error ? err.message : 'Failed to get song' }, 500)
  }
}

async function handleHealth(c: Context) {
  return c.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    service: 'Gaana Song API'
  })
}

// ==========================================
// 6. MIDDLEWARE
// ==========================================

const customErrorHandler = async (ctx: Context, next: Next) => {
  try {
    await next()
  } catch (error) {
    console.error('Error:', error)
    return ctx.json({ success: false, error: 'Internal server error' }, 500)
  }
}

const customLogger = async (ctx: Context, next: Next) => {
  const start = Date.now()
  await next()
  const duration = Date.now() - start
  console.log(`${ctx.req.method} ${ctx.req.path} - ${duration}ms`)
}

// ==========================================
// 7. APP SETUP
// ==========================================

const apiApp = new Hono()

// Apply Middleware
apiApp.use('*', cors())
apiApp.use('*', logger())
apiApp.use('*', prettyJSON())
apiApp.use('*', customLogger)
apiApp.use('*', customErrorHandler)

// Define Routes
apiApp.get('/', (c) => {
  return c.json({
    message: '🎵 Gaana Song Details API',
    endpoints: {
      song: 'GET /api/songs/:id or GET /api/songs?seokey=:id',
      health: 'GET /api/health'
    }
  })
})

apiApp.get('/health', handleHealth)
apiApp.get('/songs', handleGetSong)
apiApp.get('/songs/:seokey', handleGetSong)

// 404 Handler for API
apiApp.notFound((ctx) => {
  return ctx.json({ success: false, error: 'Not found' }, 404)
})

// Main App
const app = new Hono()

// Root Redirect/Info
app.get('/', (c) => {
  return c.json({
    message: '🎵 Gaana Song Details API',
    status: 'running',
    usage: 'GET /api/songs?seokey=your-song-seokey'
  })
})

// Mount API
app.route('/api', apiApp)

export default app