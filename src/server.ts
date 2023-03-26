import express from 'express'
import morgan from 'morgan'
import { createServer as createViteServer } from 'vite'
import { appendFile, mkdir, writeFile } from 'node:fs/promises'
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
app.use(express.json())
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
app.use(vite.middlewares)

await new Promise<void>((r) => app.listen(5173, r))
console.log('http://localhost:5173')
