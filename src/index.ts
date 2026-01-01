/**
 * Main API Entry File
 * Direct Gaana API proxy
 * Returns original response without modification
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'

const app = new Hono()

app.use('*', cors())
app.use('*', logger())
app.use('*', prettyJSON())

/* Root */
app.get('/', (c) => {
  return c.json({
    message: 'Gaana API',
    status: 'running',
    note: 'All endpoints available under /api'
  })
})

/* API Router */
app.get('/api', (c) => {
  return c.json({
    endpoints: {
      search: '/api/search?q=keyword',
      song: '/api/songs?id=seokey',
      album: '/api/albums?id=seokey',
      playlist: '/api/playlists?id=seokey',
      artist: '/api/artists?id=artist_id',
      trending: '/api/trending',
      charts: '/api/charts',
      newReleases: '/api/new-releases'
    }
  })
})

/* SEARCH */
app.get('/api/search', async (c) => {
  const q = c.req.query('q') || ''
  const url = `https://gaana.com/apiv2?country=IN&page=1&secType=track&type=search&keyword=${q}`
  const res = await fetch(url)
  const data = await res.json()
  return c.json({ api: url, raw: data })
})

/* SONG DETAILS */
app.get('/api/songs', async (c) => {
  const id = c.req.query('id')
  const url = `https://gaana.com/apiv2?type=songDetail&seokey=${id}`
  const res = await fetch(url)
  const data = await res.json()
  return c.json({ api: url, raw: data })
})

/* ALBUM DETAILS */
app.get('/api/albums', async (c) => {
  const id = c.req.query('id')
  const url = `https://gaana.com/apiv2?type=albumDetail&seokey=${id}`
  const res = await fetch(url)
  const data = await res.json()
  return c.json({ api: url, raw: data })
})

/* PLAYLIST DETAILS */
app.get('/api/playlists', async (c) => {
  const id = c.req.query('id')
  const url = `https://gaana.com/apiv2?type=playlistDetail&seokey=${id}`
  const res = await fetch(url)
  const data = await res.json()
  return c.json({ api: url, raw: data })
})

/* ARTIST DETAILS */
app.get('/api/artists', async (c) => {
  const id = c.req.query('id')

  const url =
    `https://gaana.com/apiv2?language=&order=0&page=0&sortBy=popularity&type=artistTrackList&id=${id}`

  const res = await fetch(url)
  const data = await res.json()

  return c.json({
    api: url,
    raw: data
  })
})

/* TRENDING */
app.get('/api/trending', async (c) => {
  const url = `https://gaana.com/apiv2?type=miscTrendingSongs`
  const res = await fetch(url)
  const data = await res.json()
  return c.json({ api: url, raw: data })
})

/* CHARTS */
app.get('/api/charts', async (c) => {
  const url = `https://apiv2.gaana.com/home/playlist/top-charts?view=all&limit=0`
  const res = await fetch(url)
  const data = await res.json()
  return c.json({ api: url, raw: data })
})

/* NEW RELEASES */
app.get('/api/new-releases', async (c) => {
  const lang = c.req.query('language') || 'hi'
  const url = `https://gaana.com/apiv2?page=0&type=miscNewRelease&language=${lang}`
  const res = await fetch(url)
  const data = await res.json()
  return c.json({ api: url, raw: data })
})

/* 404 */
app.notFound((c) => {
  return c.json(
    {
      success: false,
      message: 'Invalid API endpoint'
    },
    404
  )
})

export default app
