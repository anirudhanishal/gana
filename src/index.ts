/**
 * @fileoverview Main application entry point and Hono app configuration.
 * Only Song Details API implemented.
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'

export const runtime = 'edge'

const app = new Hono()

/* Global middleware */
app.use('*', cors())
app.use('*', logger())
app.use('*', prettyJSON())

/* Root */
app.get('/', (c) => {
  return c.json({
    message: 'Gaana API',
    status: 'running',
    note: 'Use /api/songs?seokey=SONG_KEY'
  })
})

/* API Root */
app.get('/api', (c) => {
  return c.json({
    endpoint: '/api/songs?seokey=SONG_KEY',
    example: '/api/songs?seokey=aankhon-ki-gustakhiyan-maaf-ho'
  })
})

/* SONG DETAILS API */
app.get('/api/songs', async (c) => {
  const seokey = c.req.query('seokey')

  if (!seokey) {
    return c.json(
      {
        success: false,
        error: 'Missing seokey parameter'
      },
      400
    )
  }

  const apiUrl =
    `https://gaana.com/apiv2?seokey=${seokey}&type=songDetail`

  const response = await fetch(apiUrl)
  const data = await response.json()

  return c.json({
    api: apiUrl,
    raw: data
  })
})

/* 404 */
app.notFound((c) => {
  return c.json(
    {
      success: false,
      message: 'Invalid endpoint',
      example: '/api/songs?seokey=aankhon-ki-gustakhiyan-maaf-ho'
    },
    404
  )
})

export default app
