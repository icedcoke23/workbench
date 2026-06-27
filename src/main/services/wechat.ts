import { clipboard } from 'electron'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { existsSync } from 'fs'
import { getWeChat } from '../database/repositories/settings'

const execFileAsync = promisify(execFile)

const WECOM_TITLES = ['企业微信', 'WeCom']

/**
 * 企业微信自动化发送：
 * 1. 激活企业微信窗口（user32 FindWindow/SetForegroundWindow）
 * 2. 打开搜索 -> 输入群名 -> 回车进入会话
 * 3. 写入剪贴板（文本或文件）-> Ctrl+V 粘贴 -> 回车发送
 *
 * 仅 Windows 可用；通过 PowerShell + WScript.Shell 实现，无需额外依赖。
 */
export async function sendToWeChat(params: {
  text?: string
  pdfPath?: string
  groupName?: string
}): Promise<{ ok: boolean; message: string }> {
  if (process.platform !== 'win32') {
    return { ok: false, message: '企业微信自动化仅支持 Windows' }
  }
  const settings = getWeChat()
  const groupName = params.groupName || settings.defaultGroupName
  if (!groupName) {
    return { ok: false, message: '未配置目标群名' }
  }

  const delay = settings.sendDelayMs ?? 800

  // 设置剪贴板内容
  if (params.pdfPath && existsSync(params.pdfPath)) {
    try {
      await setClipboardFile(params.pdfPath)
    } catch (e) {
      // 剪贴板设置失败时不能继续发送，否则会粘贴旧内容造成误发
      return {
        ok: false,
        message: `设置剪贴板文件失败：${e instanceof Error ? e.message : String(e)}`
      }
    }
  } else if (params.text) {
    clipboard.writeText(params.text)
  } else {
    return { ok: false, message: '无可发送内容' }
  }

  const psScript = buildPsScript(groupName, delay)
  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', psScript],
      { timeout: 30_000, windowsHide: true }
    )
    return { ok: true, message: '已发送到企业微信' + (stdout ? `: ${stdout.trim()}` : '') }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) }
  }
}

/** 通过 PowerShell Set-Clipboard 设置文件（用于发送附件） */
async function setClipboardFile(filePath: string): Promise<void> {
  // 使用单引号字符串并转义单引号，避免 $ 变量展开与注入
  const psLiteral = filePath.replace(/'/g, "''")
  const ps = `Set-Clipboard -LiteralPath '${psLiteral}'`
  await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], {
    timeout: 10_000,
    windowsHide: true
  })
}

function buildPsScript(groupName: string, delay: number): string {
  const titles = WECOM_TITLES.map((t) => `'${t.replace(/'/g, "''")}'`).join(',')
  const wait = (ms: number) => `Start-Sleep -Milliseconds ${ms}`
  return `
$ErrorActionPreference = 'Stop'
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
}
"@
$titles = @(${titles})
$found = $null
foreach ($t in $titles) {
  $h = [Win32]::FindWindow($null, $t)
  if ($h -ne [IntPtr]::Zero) { $found = $h; break }
}
if (-not $found) { throw '未找到企业微信窗口，请先打开并登录企业微信' }
[void][Win32]::ShowWindow($found, 9)
${wait(200)}
[void][Win32]::SetForegroundWindow($found)
${wait(delay)}
$wsh = New-Object -ComObject WScript.Shell
# 打开搜索（Ctrl+F）
$wsh.SendKeys('^f')
${wait(delay)}
# 输入群名
$wsh.SendKeys('${escapePs(groupName)}')
${wait(delay + 400)}
# 回车进入会话
$wsh.SendKeys('{ENTER}')
${wait(delay + 400)}
# 粘贴
$wsh.SendKeys('^v')
${wait(delay + 600)}
# 发送
$wsh.SendKeys('{ENTER}')
${wait(300)}
Write-Output 'OK'
`.trim()
}

function escapePs(s: string): string {
  // WScript.Shell SendKeys 特殊字符需要大括号转义
  return s.replace(/[+^%~(){}[\]]/g, (c) => `{${c}}`)
}
