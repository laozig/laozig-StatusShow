import { readFileSync } from 'node:fs'

const raw = readFileSync('./.env.local', 'utf8')
const m = raw.match(/NODEGET_CONFIG='([\s\S]*?)'/)
if (!m) throw new Error('NODEGET_CONFIG not found in .env.local')
const cfg = JSON.parse(m[1])
const { backend_url, token } = cfg.site_tokens[0]

const ws = new WebSocket(backend_url)
const since = Date.now() - 24 * 60 * 60 * 1000

const call = (method, params) => new Promise((resolve, reject) => {
  const id = String(Date.now())
  const timer = setTimeout(() => reject(new Error('timeout')), 15000)
  ws.addEventListener('message', function onMessage(ev) {
    const msg = JSON.parse(String(ev.data))
    if (String(msg.id) !== id) return
    ws.removeEventListener('message', onMessage)
    clearTimeout(timer)
    if (msg.error) reject(new Error(msg.error.message || 'rpc error'))
    else resolve(msg.result)
  })
  ws.send(JSON.stringify({
    jsonrpc: '2.0',
    id,
    method,
    params: { token, ...params },
  }))
})

ws.addEventListener('open', async () => {
  try {
    const result = await call('task_query', {
      task_data_query: {
        condition: [
          { timestamp_from: since },
          { limit: 200 },
        ],
      },
    })

    const rows = Array.isArray(result) ? result : []
    const matched = rows.filter((row) => {
      const r = row?.task_event_result
      return r && typeof r === 'object' && (
        'service' in r ||
        'blocked' in r ||
        'region' in r ||
        JSON.stringify(r).includes('netflix') ||
        JSON.stringify(r).includes('youtube')
      )
    })

    console.log(JSON.stringify(matched, null, 2))
  } catch (e) {
    console.error(String(e))
  } finally {
    ws.close()
  }
})

ws.addEventListener('error', () => {
  console.error('ws error')
})
