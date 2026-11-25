# mod-info

A one-line popup above the prompt while a task runs: a progress bar, the step
count, elapsed time and the estimated dollar cost since the task started. It
disappears when the task finishes. Type `/mod-info` to toggle it ("Task popup
on." / "Task popup off."). The bar fills one notch per model step up to
`MAX_STEPS` (20, in `hooks/register.tsx`); total work is unknown, so it is an
estimate, so raise that constant for longer tasks. Only top-level turns are
tracked, not subagents. State lives in session state; no setup or config files.
