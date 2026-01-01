import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { prettyJSON } from 'hono/pretty-json'

export const runtime = 'edge'

const app = new Hono()

app.use('*', cors())
app.use('*', prettyJSON())

/* Root */
app.get('/', (c) => {
  return c.json({
    message: 'Gaana API',
    status: 'running',
    example: '/api/songs?seokey=aankhon-ki-gustakhiyan-maaf-ho'
  })
})

/* API Root */
app.get('/api', (c) => {
  return c.json({
    endpoint: '/api/songs?seokey=SONG_KEY'
  })
})

/* SONG DETAILS */
app.get('/api/songs', async (c) => {
  const seokey = c.req.query('seokey')

  if (!seokey) {
    return c.json(
      { error: 'Missing seokey parameter' },
      400
    )
  }

  const apiUrl =
    `https://gaana.com/apiv2?seokey=${seokey}&type=songDetail`

  const res = await fetch(apiUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Accept': 'application/json'
    }
  })

  const data = await res.json()

  return c.json({
    api: apiUrl,
    raw: data
  })
})

/* 404 */
app.notFound((c) => {
  return c.json(
    { error: 'Invalid endpoint' },
    404
  )
})

export default app
