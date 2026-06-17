import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import themeTemplate from '../nodeget-theme.json' with { type: 'json' }
import { buildConfig } from "../config/index.mjs"

function injectNodegetConfigFromDotEnv(projectRoot) {
  if (process.env.NODEGET_CONFIG) return

  const envFiles = ['.env.local', '.env']
  for (const name of envFiles) {
    const file = resolve(projectRoot, name)
    if (!existsSync(file)) continue

    const raw = readFileSync(file, 'utf8')
    const match = raw.match(/NODEGET_CONFIG='([\s\S]*?)'/)
    if (!match) continue

    process.env.NODEGET_CONFIG = match[1]
    console.log(`[build-config] loaded NODEGET_CONFIG from ${name}`)
    return
  }
}

// 计算项目根目录和输出文件路径
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
injectNodegetConfigFromDotEnv(projectRoot)
const outputPath = resolve(projectRoot, 'dist/config.json')
// 写入输出文件
const finalConfig = buildConfig()
writeFileSync(outputPath, JSON.stringify(finalConfig, null, 2) + '\n')
console.log(`[build-config] wrote ${finalConfig.site_tokens.length} site_tokens to ${outputPath}`)