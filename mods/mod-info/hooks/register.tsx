import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Run } from '../types'

// The bar fills one notch per model step up to this many. Total work is unknown,
// so it is only an estimate: raise it for longer tasks.
const MAX_STEPS = 20
const BAR_WIDTH = 20

const isOn = atom({ plugin: 'mod-info', key: 'isOn' } as const, true)
const run = atom({ plugin: 'mod-info', key: 'run' } as const, null, {
  shape: 'run-1',
})

const clock = (ms: number) => {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

async function total($: EngineInterface): Promise<number> {
  return (await $.session.usage()).cost?.usd ?? 0
}

export const register: Register = on => {
  let tick: { cancel: () => void } | undefined

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'mod-info',
      description: 'Toggle the task progress popup',
    })

    return next(e)
  })

  on('command.run', { command: 'mod-info' }, async $ => {
    const next = !(await read($, isOn))
    await update($, isOn, () => next)

    return { text: next ? 'Task popup on.' : 'Task popup off.' }
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId !== undefined) return next(e)

    const usd = await total($)
    const startedAt = await $.clock.now()
    await update($, run, () => ({
      isActive: true,
      steps: 0,
      tools: 0,
      startedAt,
      startUsd: usd,
      nowUsd: usd,
      endedAt: null,
    }))
    // Redraw once a second so the elapsed time ticks between steps.
    tick?.cancel()
    tick = $.clock.every(1000, () => {
      void update($, run, (r: Run | null) => (r?.isActive ? { ...r } : r))
    })

    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    if (e.agentId === undefined) {
      const usd = await total($)
      await update($, run, (r: Run | null) =>
        r?.isActive ? { ...r, steps: r.steps + 1, nowUsd: usd } : r,
      )
    }

    return yield* next(e)
  })

  on('tool.call', async ($, e, next) => {
    if (e.agentId === undefined) {
      await update($, run, (r: Run | null) =>
        r?.isActive ? { ...r, tools: r.tools + 1 } : r,
      )
    }

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      tick?.cancel()
      tick = undefined
      const endedAt = await $.clock.now()
      const usd = await total($)
      await update($, run, (r: Run | null) =>
        r ? { ...r, isActive: false, nowUsd: usd, endedAt } : r,
      )
    }

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const r = await read($, run)
    if (e.props.hasSurvey || !r?.isActive || !(await read($, isOn))) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)
    const filled = Math.round((Math.min(r.steps, MAX_STEPS) / MAX_STEPS) * BAR_WIDTH)
    const bar = '█'.repeat(filled) + '░'.repeat(BAR_WIDTH - filled)
    const elapsed = clock((r.endedAt ?? (await $.clock.now())) - r.startedAt)
    const cost = Math.max(0, r.nowUsd - r.startUsd).toFixed(2)

    return (
      <Box>
        <Text dimColor>
          {bar} {r.steps} steps · {elapsed} · ~${cost}
        </Text>
      </Box>
    )
  })
}
