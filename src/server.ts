import express from 'express'
import morgan from 'morgan'
import { createServer as createViteServer } from 'vite'
import { mkdir, writeFile, readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

const dir = './data'
await mkdir(dir, { recursive: true })

const vite = await createViteServer({ server: { middlewareMode: true } })
const app = express()
app.use(morgan('dev'))
app.post('/receipts', async (req, res) => {
  const id = randomUUID()
  const mime = req.get('Content-Type')
  if (!mime) return res.sendStatus(400)
  await writeFile(join(dir, `${id}.${mimeToSuffix(mime)}`), req)
  return res.status(201).json(id)
})
app.get('/receipts', async (_req, res) => {
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
app.use(vite.middlewares)

await new Promise<void>((r) => app.listen(5173, r))
console.log('http://localhost:5173')

// MIME subtype -> suffix
function mimeToSuffix(mime: string): string {
  const y = /\w+\/([\w.-]*)/.exec(mime)
  return y ? y[1] : mime
}
