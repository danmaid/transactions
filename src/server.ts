import express from 'express'
import morgan from 'morgan'
import { createServer as createViteServer } from 'vite'
import { appendFile, mkdir, writeFile, readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { IncomingHttpHeaders } from 'node:http'
import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'

const dir = './data'
await mkdir(dir, { recursive: true })
const index = join(dir, '/index.jsonl')

interface HttpEvent {
  method: string
  path: string
  headers: IncomingHttpHeaders
  body: Record<string, unknown>
  id: string
}

const vite = await createViteServer({ server: { middlewareMode: true } })
const app = express()
app.use(morgan('dev'))
app.post('/receipts', async (req, res) => {
  if (!req.readableLength) return res.sendStatus(400)
  const id = randomUUID()
  await writeFile(join(dir, id), req)
  return res.status(201).json(id)
})
app.get('/receipts', async (req, res) => {
  const items = []
  for (const file of await readdir(dir)) {
    if (file.endsWith('.json')) continue
    items.push(file)
  }
  return res.json(items)
})
app.put('/payments/:id', async (req, res) => {
  const id = req.params.id
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
// store index.
app.use(async (req, res, next) => {
  const { method, path, headers, body } = req
  const id = randomUUID()
  const data: HttpEvent = { method, path, headers, body, id }
  await appendFile(index, JSON.stringify(data) + '\n')
  res.locals.id = id
  next()
})
// store content.
app.use(async (req, res, next) => {
  if (!req.readableLength) return next()
  const id = res.locals.id
  const x = req.get('Content-Type')
  if (!x) return next()
  const y = /\w+\/([\w.-]*)/.exec(x)
  if (!y) return next()
  const [_, suffix] = y
  const file = [id, suffix].join('.')
  await writeFile(join(dir, file), req)
  console.log('stored.', file)
  next()
})
app.get('*', async (req, res, next) => {
  if (!req.accepts().includes('application/json')) return next()
  const items = []
  const reader = createReadStream(index)
  for await (const line of createInterface(reader)) {
    console.log(line)
    const ev: HttpEvent = JSON.parse(line)
    items.push(ev)
    if (items.length >= 25) {
      reader.close()
      break
    }
  }
  res.json(items)
})
// POST => Generate ID => PUT => 201 ID
app.post('*', async (req, res) => {
  const { headers, body } = req
  const id = randomUUID()
  const method = 'PUT'
  const path = req.path.endsWith('/') ? req.path + id : req.path + '/' + id
  const data: HttpEvent = { method, path, headers, body, id }
  await appendFile(index, JSON.stringify(data) + '\n')
  res.status(201).json(id)
})
app.use(vite.middlewares)

await new Promise<void>((r) => app.listen(5173, r))
console.log('http://localhost:5173')
