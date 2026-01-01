/**
 * @fileoverview Main application entry point and Hono app configuration.
 * Provides Song Details API using Gaana public endpoint.
 * @module index
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'

export const runtime = 'edge'

/**
 * Main API instance
 */
const apiApp = new Hono()

/* Global middleware */
apiApp.use('*', cors())
apiApp.use('*', logger())
apiApp.use('*', prettyJSON())

/**
 * API Root
 */
apiApp.get('/', (c) => {
  return c.json({
    message: 'Gaana API',
    version: '1.0.0',
    status: 'running',
    documentation: 'https://github.com/notdeltaxd/Gaana-API',
    endpoints: {
      song: 'GET /api/songs?seokey=SONG_KEY'
    }
  })
})

/**
 * SONG DETAILS API
 * Example:
 * /api/songs?seokey=aankhon-ki-gustakhiyan-maaf-ho
 */
apiApp.get('/songs', async (c) => {
  const seokey = c.req.query('seokey')

  if (!seokey) {
    return c.json(
      {
        success: false,
        error: 'Missing required parameter: seokey'
      },
      400
    )
  }

  const apiUrl =
    `https://gaana.com/apiv2?seokey=${seokey}&type=songDetail`

  const response = await fetch(apiUrl, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0'
    }
  })

  const data = await response.json()

  return c.json({
    api: apiUrl,
    raw: data
  })
})

/**
 * 404 handler for API routes
 */
apiApp.notFound((c) => {
  return c.json(
    {
      success: false,
      error: 'Invalid API endpoint',
      example: '/api/songs?seokey=aankhon-ki-gustakhiyan-maaf-ho'
    },
    404
  )
})

/**
 * Root app
 */
const app = new Hono()

app.use('*', cors())
app.use('*', logger())
app.use('*', prettyJSON())

/**
 * Root endpoint
 */
app.get('/', (c) => {
  return c.json({
    message: 'Gaana API',
    status: 'running',
    note: 'All endpoints are available under /api',
    example: '/api/songs?seokey=aankhon-ki-gustakhiyan-maaf-ho'
  })
})

/**
 * Mount API
 */
app.route('/api', apiApp)

/**
 * Root 404
 */
app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: 'Not found',
      note: 'Use /api for available endpoints'
    },
    404
  )
})

export default app
