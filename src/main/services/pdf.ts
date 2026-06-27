import { BrowserWindow } from 'electron'
import { writeFile, mkdir } from 'fs/promises'
import { join, extname } from 'path'
import dayjs from 'dayjs'

/** 将 HTML 渲染为 PDF 并保存，返回 PDF 文件路径。
 * 大 HTML 用临时文件加载，规避 data URL ~2MB 限制；printToPDF 加超时避免卡死。 */
export async function renderHtmlToPdf(html: string, outDir: string, name: string): Promise<string> {
  await mkdir(outDir, { recursive: true })
  const ts = dayjs().format('YYYYMMDD-HHmmss')
  const pdfPath = join(outDir, `${name}-${ts}.pdf`)

  const win = new BrowserWindow({
    show: false,
    webPreferences: { offscreen: false, sandbox: true, contextIsolation: true }
  })

  try {
    // 大内容改用临时文件加载，避免 data URL 大小限制
    const { writeFile: writeTmp } = await import('fs/promises')
    const { tmpdir } = await import('os')
    const tmpHtml = join(tmpdir(), `wb-pdf-${ts}.html`)
    await writeTmp(tmpHtml, html, 'utf8')
    await win.loadFile(tmpHtml)
    await new Promise((resolve) => {
      onceLoaded(win, resolve)
    })
    // printToPDF 加 30s 超时，避免卡死导致隐藏窗口永不销毁
    const pdfData = await Promise.race([
      win.webContents.printToPDF({
        pageSize: 'A4',
        printBackground: true,
        // 用默认 margin，与 @page margin:20mm 配合，避免冲突裁切
        margins: { marginType: 'default' }
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('printToPDF 超时（30s）')), 30_000)
      )
    ])
    await writeFile(pdfPath, pdfData)
    // 清理临时文件
    await import('fs/promises').then((f) => f.unlink(tmpHtml).catch(() => {}))
    return pdfPath
  } finally {
    if (!win.isDestroyed()) win.destroy()
  }
}

function onceLoaded(win: BrowserWindow, resolve: (v: unknown) => void): void {
  if (win.webContents.isLoading()) {
    win.webContents.once('did-finish-load', () => resolve(null))
  } else {
    resolve(null)
  }
}

/** 将任意文本内容包装为可打印 HTML */
export function wrapContentHtml(title: string, markdown: string): string {
  // 先转义，再做 markdown 转换（标题、列表、段落）
  const escaped = markdown
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  // h2 优先匹配（## 开头），再 h1（# 开头），避免 # 被 h2 规则误吞
  let html = escaped
    .replace(/^##\s*【?(.+?)】?$/gm, '<h2>$1</h2>')
    .replace(/^#\s*(.+)$/gm, '<h1>$1</h1>')
  // 列表项包裹 <ul>，连续 <li> 合并为一组
  html = html.replace(/(<li>.*?<\/li>(?:\s*<li>.*?<\/li>)*)/gs, (m) => `<ul>${m}</ul>`)
  // 段落分隔
  html = html.replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>')
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><style>
    @page { size: A4; margin: 20mm; }
    body { font-family: "Microsoft YaHei","PingFang SC",sans-serif; color:#222; line-height:1.8; font-size:14px; }
    h1 { color:#4f46e5; } h2 { color:#4f46e5; border-left:5px solid #4f46e5; padding-left:10px; margin-top:18px; }
    ul { margin: 6px 0; padding-left: 22px; }
    li { margin: 4px 0; } .title { text-align:center; font-size:22px; font-weight:bold; margin-bottom:24px; color:#4f46e5;}
  </style></head><body><div class="title">${title}</div><p>${html}</p></body></html>`
}

export function extOf(filePath: string): string {
  return extname(filePath).toLowerCase()
}
