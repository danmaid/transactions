import express from 'express'
import morgan from 'morgan'
import { createServer as createViteServer } from 'vite'
import { mkdir, writeFile, readdir, readFile, access, appendFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'

const dir = './data'
await mkdir(dir, { recursive: true })
const events = join(dir, 'events.jsonl')
await access(events).catch(() => appendFile(events, ''))

const vite = await createViteServer({ server: { middlewareMode: true } })
const app = express()
app.use(morgan('dev'))
app.put('/payments/:id', async (req, res) => {
  const { id } = req.params
  await writeFile(join(dir, id + '.json'), req, { encoding: 'utf-8' })
  return res.sendStatus(200)
})
app.get('/payments', async (_req, res) => {
  const items = []
  for (const file of await readdir(dir)) {
    if (!file.endsWith('.json')) continue
    const f = await readFile(join(dir, file), { encoding: 'utf-8' })
    items.push(JSON.parse(f))
  }
  return res.json(items)
})
app.post('/', async (req, res) => {
  const id = randomUUID()
  await writeFile(join(dir, id), req)

  const meta = { ...req.headers, id }
  await appendFile(events, JSON.stringify(meta) + '\n', { encoding: 'utf-8' })

  return res.status(201).json(id)
})
app.get('/', async (req, res, next) => {
  if (!req.accepts().includes('application/json')) return next()
  const reader = createInterface(createReadStream(events, { encoding: 'utf-8' }))
  const items = new Map()
  for await (const line of reader) {
    const item = JSON.parse(line)
    items.set(item.id, { ...items.get(item.id), ...item })
  }
  return res.json(Array.from(items.values()))
})
app.get('/:id', async (req, res, next) => {
  const { id } = req.params
  const reader = createInterface(createReadStream(events, { encoding: 'utf-8' }))
  let index
  for await (const line of reader) {
    const i = JSON.parse(line)
    if (!i['content-type'] || i.id !== id) continue
    index = i
  }
  if (!index) return next()
  if (index['content-type']) res.setHeader('Content-Type', index['content-type'])
  if (index['content-length']) res.setHeader('Content-Length', index['content-length'])
  return createReadStream(join(dir, id)).pipe(res)
})
app.use(express.json())
app.put('/:id', async (req, res) => {
  const { id } = req.params
  const meta = { ...req.body, id }
  await appendFile(events, JSON.stringify(meta) + '\n', { encoding: 'utf-8' })
  return res.sendStatus(200)
})
app.use(vite.middlewares)

await new Promise<void>((r) => app.listen(5173, r))
console.log('http://localhost:5173')
