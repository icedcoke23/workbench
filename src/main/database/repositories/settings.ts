import { db, parseJSON } from '../db'
import type { AppSettings, AISettings, ScratchSettings, SyncSettings, WeChatSettings } from '@shared/types'

export function get(key: string): string | null {
  const row = db().prepare(`SELECT value FROM settings WHERE key = ?`).get(key) as { value: string } | undefined
  return row?.value ?? null
}

export function set(key: string, value: string): void {
  db().prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`).run(key, value)
}

const DEFAULT_AI: AISettings = {
  apiKey: '',
  baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
  modelId: 'glm-4-flash',
  visionModelId: 'glm-4v-flash',
  systemPrompt: '',
  useCustomAI: false,
  maxConcurrent: 5
}

const DEFAULT_SYNC: SyncSettings = {
  enabled: false,
  serverUrl: '',
  token: '',
  lastSyncAt: null,
  autoSync: true
}

const DEFAULT_WECHAT: WeChatSettings = {
  defaultGroupName: '',
  searchHotkey: 'CommandOrControl+Alt+W',
  sendDelayMs: 800,
  autoActivate: true
}

const DEFAULT_SCRATCH: ScratchSettings = {
  guiUrl: 'http://localhost:8601',
  autoLaunch: true,
  workspaceDir: ''
}

export function getAI(): AISettings {
  return parseJSON<AISettings>(get('ai'), DEFAULT_AI)
}
export function setAI(s: AISettings): void {
  set('ai', JSON.stringify(s))
}

export function getSync(): SyncSettings {
  return parseJSON<SyncSettings>(get('sync'), DEFAULT_SYNC)
}
export function setSync(s: SyncSettings): void {
  set('sync', JSON.stringify(s))
}

export function getWeChat(): WeChatSettings {
  return parseJSON<WeChatSettings>(get('wechat'), DEFAULT_WECHAT)
}
export function setWeChat(s: WeChatSettings): void {
  set('wechat', JSON.stringify(s))
}

export function getScratch(): ScratchSettings {
  const s = parseJSON<ScratchSettings>(get('scratch'), DEFAULT_SCRATCH)
  return { ...DEFAULT_SCRATCH, ...s }
}
export function setScratch(s: ScratchSettings): void {
  set('scratch', JSON.stringify(s))
}

export function getAll(): AppSettings {
  return {
    ai: getAI(),
    sync: getSync(),
    wechat: getWeChat(),
    scratch: getScratch()
  }
}
