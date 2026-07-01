import { writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import themeTemplate from '../nodeget-theme.json' with { type: 'json' }
import pkg from '../package.json' with { type: 'json' }
import { buildDefaultConfig } from "../config/default.mjs"

themeTemplate.version = pkg.version
const defaultConfig = buildDefaultConfig()

// 项目根目录
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
// 输出配置路径
const themeConfigPath = resolve(projectRoot, 'dist/nodeget-theme.json')
const userConfigPath = resolve(projectRoot, 'dist/config.json')

// 写入主题 JSON 文件
writeFileSync(themeConfigPath, JSON.stringify(themeTemplate, null, 2) + '\n', 'utf-8')

// 写入占位 config.json（随主题包发布，site_tokens 用占位符，不泄露真实凭据）
const placeholderConfig = {
  user_preferences: defaultConfig.user_preferences,
  site_tokens: [
    {
      name: "placeholder",
      backend_url: "wss://your-backend.example.com",
      token: "YOUR_TOKEN_HERE"
    }
  ]
}
writeFileSync(userConfigPath, JSON.stringify(placeholderConfig, null, 2) + '\n', 'utf-8')
console.log('[build-template-config] wrote placeholder config.json (site_tokens masked)')
