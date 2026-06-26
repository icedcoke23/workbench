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
  const searchHotkey = settings.searchHotkey || 'CommandOrControl+F'

  // 设置剪贴板内容
  if (params.pdfPath && existsSync(params.pdfPath)) {
    await setClipboardFile(params.pdfPath)
  } else if (params.text) {
    clipboard.writeText(params.text)
  } else {
    return { ok: false, message: '无可发送内容' }
  }

  const psScript = buildPsScript(groupName, delay, searchHotkey)
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
  const ps = `Set-Clipboard -LiteralPath "${filePath.replace(/"/g, '""')}"`
  try {
    await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], {
      timeout: 10_000,
      windowsHide: true
    })
  } catch {
    // 忽略：回退到文本
  }
}

function buildPsScript(groupName: string, delay: number, searchHotkey: string): string {
  const titles = WECOM_TITLES.map((t) => `'${t}'`).join(',')
  const wait = (ms: number) => `Start-Sleep -Milliseconds ${ms}`
  const searchKeys = acceleratorToSendKeys(searchHotkey)
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
# 打开搜索（${escapePs(searchHotkey)}）
$wsh.SendKeys('${searchKeys}')
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

/**
 * 将 Electron accelerator（如 CommandOrControl+F）转换为 WScript.Shell SendKeys 格式（如 ^f）
 * CommandOrControl/Ctrl → ^，Alt → %，Shift → +，字母键转小写
 */
function acceleratorToSendKeys(accelerator: string): string {
  const parts = accelerator.split('+')
  let prefix = ''
  let key = ''
  for (const p of parts) {
    const lower = p.trim().toLowerCase()
    if (lower === 'commandorcontrol' || lower === 'ctrl' || lower === 'control' || lower === 'cmd' || lower === 'command') {
      prefix += '^'
    } else if (lower === 'alt') {
      prefix += '%'
    } else if (lower === 'shift') {
      prefix += '+'
    } else {
      key = lower
    }
  }
  return prefix + (key || 'f')
}

function escapePs(s: string): string {
  // WScript.Shell SendKeys 特殊字符需要大括号转义
  return s.replace(/[+^%~(){}[\]]/g, (c) => `{${c}}`)
}
