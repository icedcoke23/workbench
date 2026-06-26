/**
 * 生成 Windows 应用图标 (icon.ico) 和 PNG 图标
 * 用法: node scripts/generate-icon.mjs
 */
import sharp from 'sharp'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const BUILD_DIR = resolve(ROOT, 'build')
const SVG_PATH = resolve(BUILD_DIR, 'icon.svg')

// ICO 中包含的尺寸
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]

/**
 * 将多个 PNG Buffer 合并为 ICO 格式
 * @param {Array<{size: number, data: Buffer}>} images
 * @returns {Buffer}
 */
function buildIco(images) {
  const headerSize = 6
  const dirEntrySize = 16
  const totalHeader = headerSize + dirEntrySize * images.length

  // 计算每个图像的偏移
  let offset = totalHeader
  const entries = images.map((img) => {
    const entry = {
      size: img.size,
      data: img.data,
      offset
    }
    offset += img.data.length
    return entry
  })

  // ICONDIR header
  const header = Buffer.alloc(headerSize)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: 1 = ICO
  header.writeUInt16LE(images.length, 4) // count

  // ICONDIRENTRY 列表
  const dirEntries = entries.map((entry) => {
    const buf = Buffer.alloc(dirEntrySize)
    const s = entry.size
    buf.writeUInt8(s >= 256 ? 0 : s, 0) // width (0 表示 256)
    buf.writeUInt8(s >= 256 ? 0 : s, 1) // height
    buf.writeUInt8(0, 2) // color palette count (0 = no palette)
    buf.writeUInt8(0, 3) // reserved
    buf.writeUInt16LE(1, 4) // color planes
    buf.writeUInt16LE(32, 6) // bits per pixel
    buf.writeUInt32LE(entry.data.length, 8) // image size in bytes
    buf.writeUInt32LE(entry.offset, 12) // image data offset
    return buf
  })

  return Buffer.concat([header, ...dirEntries, ...images.map((i) => i.data)])
}

async function main() {
  mkdirSync(BUILD_DIR, { recursive: true })
  const svgBuffer = readFileSync(SVG_PATH)

  console.log('正在生成 PNG 图标...')
  const pngImages = []
  for (const size of ICO_SIZES) {
    const png = await sharp(svgBuffer, { density: 384 })
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer()
    pngImages.push({ size, data: png })
    // 同时保存单独的 PNG
    const pngPath = resolve(BUILD_DIR, `icon-${size}.png`)
    writeFileSync(pngPath, png)
    console.log(`  ✓ ${size}x${size} -> ${pngPath}`)
  }

  // 保存 256 作为通用 icon.png
  const png256 = pngImages.find((i) => i.size === 256)
  if (png256) {
    writeFileSync(resolve(BUILD_DIR, 'icon.png'), png256.data)
    console.log(`  ✓ icon.png (256x256)`)
  }

  console.log('正在生成 ICO 文件...')
  const icoBuffer = buildIco(pngImages)
  const icoPath = resolve(BUILD_DIR, 'icon.ico')
  writeFileSync(icoPath, icoBuffer)
  console.log(`  ✓ ${icoPath} (${icoBuffer.length} bytes, ${pngImages.length} sizes)`)
  console.log('完成！')
}

main().catch((err) => {
  console.error('生成图标失败:', err)
  process.exit(1)
})
