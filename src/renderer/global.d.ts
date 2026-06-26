import type { WorkbenchAPI, WorkbenchEvents } from '@shared/api'

declare global {
  interface Window {
    api: WorkbenchAPI
    events: WorkbenchEvents
    platform: string
  }
}

export {}
