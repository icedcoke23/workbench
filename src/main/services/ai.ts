import { getAI } from '../database/repositories/settings'
import { getDefaultSystemPrompt } from '../lib/prompts'
import type { AISettings } from '@shared/types'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>
}

/** 获取已配置的 AI 设置，并补全默认 systemPrompt */
export function resolveAISettings(): AISettings | null {
  const s = getAI()
  if (!s.useCustomAI || !s.apiKey || !s.baseUrl) return null
  if (!s.systemPrompt) s.systemPrompt = getDefaultSystemPrompt()
  return s
}

/** 非流式调用（兼容 OpenAI 协议） */
export async function invokeAI(
  settings: AISettings,
  messages: ChatMessage[],
  temperature = 0.3,
  timeoutMs = 60_000
): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const url = joinUrl(settings.baseUrl, '/chat/completions')
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({
        model: settings.modelId,
        messages,
        temperature,
        stream: false
      }),
      signal: controller.signal
    })
    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      throw new Error(`AI 请求失败 ${resp.status}: ${text.slice(0, 200)}`)
    }
    const data = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    return data.choices?.[0]?.message?.content ?? ''
  } finally {
    clearTimeout(timer)
  }
}

/** 流式调用，逐 chunk 回调 */
export async function streamAI(
  settings: AISettings,
  messages: ChatMessage[],
  onChunk: (delta: string) => void,
  temperature = 0.7,
  timeoutMs = 120_000
): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let full = ''
  try {
    const url = joinUrl(settings.baseUrl, '/chat/completions')
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({
        model: settings.modelId,
        messages,
        temperature,
        stream: true
      }),
      signal: controller.signal
    })
    if (!resp.ok || !resp.body) {
      throw new Error(`AI 请求失败 ${resp.status}`)
    }
    const reader = resp.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split('\n\n')
      buffer = parts.pop() ?? ''
      for (const part of parts) {
        const line = part.split('\n').find((l) => l.trim().startsWith('data: '))
        if (!line) continue
        const data = line.trim().slice(6)
        if (data === '[DONE]') return full
        try {
          const parsed = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string } }>
          }
          const delta = parsed.choices?.[0]?.delta?.content ?? ''
          if (delta) {
            full += delta
            onChunk(delta)
          }
        } catch {
          // 忽略解析错误
        }
      }
    }
  } finally {
    clearTimeout(timer)
  }
  return full
}

/** 调用 Vision 模型解析图片 */
export async function invokeVision(
  settings: AISettings,
  imageBase64: string,
  systemPrompt: string,
  userPrompt: string,
  temperature = 0.1
): Promise<string> {
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: [
        { type: 'text', text: userPrompt },
        { type: 'image_url', image_url: { url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/png;base64,${imageBase64}` } }
      ]
    }
  ]
  const model = settings.visionModelId || settings.modelId
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 60_000)
  try {
    const url = joinUrl(settings.baseUrl, '/chat/completions')
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({ model, messages, temperature, stream: false }),
      signal: controller.signal
    })
    if (!resp.ok) throw new Error(`AI Vision 请求失败 ${resp.status}`)
    const data = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> }
    return data.choices?.[0]?.message?.content ?? ''
  } finally {
    clearTimeout(timer)
  }
}

function joinUrl(base: string, path: string): string {
  return base.replace(/\/+$/, '') + path
}

/** 用户输入净化（防注入 + 限长） */
export function sanitizeUserInput(input: string, max = 2000): string {
  return input.replace(/【/g, '[').replace(/】/g, ']').replace(/\n{3,}/g, '\n\n').trim().substring(0, max)
}

/** 从 AI 返回文本中提取 JSON */
export function extractJSON(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    const m = text.match(/\{[\s\S]*\}/)
    if (m) return JSON.parse(m[0])
    throw new Error('无法解析 AI 返回的 JSON')
  }
}
