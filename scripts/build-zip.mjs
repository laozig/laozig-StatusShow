import { writeFileSync, createWriteStream, renameSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ZipArchive } from 'archiver';


// 项目根目录
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// 输出文件路径
const zipFilename = 'NodeGet-StatusShow.zip'
const zipTempPath = resolve(projectRoot, zipFilename)
const zipDistPath = resolve(projectRoot, 'dist', zipFilename)

// 创建 ZIP 输出流
const zipOutput = createWriteStream(zipTempPath)
const archive = new ZipArchive('zip', { zlib: { level: 9 } })

// 监听完成事件
zipOutput.on('close', () => {
  console.log(`[zip] 压缩完成，总共 ${archive.pointer()} 字节`)
  renameSync(zipTempPath, zipDistPath)
  console.log(`[zip] 移动到 ${zipDistPath}`)
})

// 监听错误
archive.on('error', err => {
  throw err
})

// 关联输出流
archive.pipe(zipOutput)

// 添加 dist 文件夹到压缩包根目录，但排除真实 config.json（含 token）
// config.json 已在 build-template-config.mjs 中写入占位版本，安全随包发布
archive.directory('dist/', false, (entry) => {
  // 排除 zip 自身和真实配置文件（build-config.mjs 写入的 config.real.json）
  if (entry.name === 'NodeGet-StatusShow.zip' || entry.name === 'config.real.json') {
    return false
  }
  return entry
})

// 完成压缩
archive.finalize()
