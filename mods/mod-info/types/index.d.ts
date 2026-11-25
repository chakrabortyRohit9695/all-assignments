export type Run = {
  isActive: boolean
  steps: number
  tools: number
  startedAt: number
  startUsd: number
  nowUsd: number
  endedAt: number | null
}

declare module 'claude-code' {
  interface PluginState {
    'mod-info': { isOn: boolean; run: Run | null }
  }
}
