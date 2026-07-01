import { writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import themeTemplate from '../nodeget-theme.json' with { type: 'json' }
import { buildConfig } from "../config/index.mjs"

// 计算项目根目录和输出文件路径
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
// 真实配置写入 config.real.json（含 token，仅本地部署用，不进主题包 zip）
const realConfigPath = resolve(projectRoot, 'dist/config.real.json')
// 写入输出文件
const finalConfig = buildConfig()
writeFileSync(realConfigPath, JSON.stringify(finalConfig, null, 2) + '\n')
console.log(`[build-config] wrote ${finalConfig.site_tokens.length} site_tokens to ${realConfigPath} (real config, excluded from zip)`)
