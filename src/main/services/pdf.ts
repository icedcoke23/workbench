import { BrowserWindow } from 'electron'
import { writeFile, mkdir } from 'fs/promises'
import { join, extname } from 'path'
import dayjs from 'dayjs'

/** 将 HTML 渲染为 PDF 并保存，返回 PDF 文件路径 */
export async function renderHtmlToPdf(html: string, outDir: string, name: string): Promise<string> {
  await mkdir(outDir, { recursive: true })
  const ts = dayjs().format('YYYYMMDD-HHmmss')
  const pdfPath = join(outDir, `${name}-${ts}.pdf`)

  const win = new BrowserWindow({
    show: false,
    webPreferences: { offscreen: false, sandbox: true, contextIsolation: true }
  })

  try {
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
    await new Promise((resolve) => {
      onceLoaded(win, resolve)
    })
    const pdfData = await win.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      margins: { marginType: 'custom', top: 0, bottom: 0, left: 0, right: 0 }
    })
    await writeFile(pdfPath, pdfData)
    return pdfPath
  } finally {
    win.destroy()
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
  // 简单 markdown 转换（标题、列表、段落）
  const html = markdown
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^##\s*【?(.+?)】?$/gm, '<h2>$1</h2>')
    .replace(/^#\s*(.+)$/gm, '<h1>$1</h1>')
    .replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><style>
    @page { size: A4; margin: 20mm; }
    body { font-family: "Microsoft YaHei","PingFang SC",sans-serif; color:#222; line-height:1.8; font-size:14px; }
    h1 { color:#4f46e5; } h2 { color:#4f46e5; border-left:5px solid #4f46e5; padding-left:10px; }
    li { margin: 4px 0; } .title { text-align:center; font-size:22px; font-weight:bold; margin-bottom:24px; color:#4f46e5;}
  </style></head><body><div class="title">${title}</div><p>${html}</p></body></html>`
}

export function extOf(filePath: string): string {
  return extname(filePath).toLowerCase()
}
