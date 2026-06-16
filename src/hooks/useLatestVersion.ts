import { useEffect, useState } from 'react'
import { parseGitRepo } from '../utils/git'

// 语义化版本比较:latest 是否严格新于 current(避免本地领先时误报)
function isNewer(latest: string, current: string): boolean {
  const a = latest.replace(/^v/, '').split('.').map(Number)
  const b = current.replace(/^v/, '').split('.').map(Number)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] || 0
    const y = b[i] || 0
    if (x !== y) return x > y
  }
  return false
}

const trimSlash = (s: string) => s.replace(/\/$/, '')

async function pickVersion(url: string, field: 'version'): Promise<string | null> {
  try {
    const r = await fetch(url, { cache: 'no-cache' })
    if (!r.ok) return null
    const j = await r.json()
    return j?.[field] ? String(j[field]) : null
  } catch {
    return null
  }
}

async function fetchLatest(repo?: string, distPage?: string): Promise<string | null> {
  // 1. 优先自己的部署站(CF Pages CDN,国内基本可达;需 _headers 放行 CORS)
  if (distPage) {
    const v = await pickVersion(`${trimSlash(distPage)}/nodeget-theme.json`, 'version')
    if (v) return v
  }
  // 2. 回退 GitHub 上 main 分支的 package.json
  const git = repo ? parseGitRepo(repo) : null
  if (git) {
    const v = await pickVersion(
      `https://raw.githubusercontent.com/${git.user}/${git.repo}/main/package.json`,
      'version',
    )
    if (v) return v
  }
  return null
}

// 进程级缓存:Footer 与 UpdateNotice 共用,只请求一次
let cache: Promise<string | null> | null = null

/** 检测是否有比当前构建更新的版本。current 来自构建时注入的 __APP_VERSION__。 */
export function useLatestVersion(repo?: string, distPage?: string) {
  const [latest, setLatest] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    if (!cache) cache = fetchLatest(repo, distPage)
    cache.then(v => { if (alive) setLatest(v) })
    return () => { alive = false }
  }, [repo, distPage])

  const current = __APP_VERSION__
  const outdated = latest != null && isNewer(latest, current)
  return { current, latest, outdated }
}
