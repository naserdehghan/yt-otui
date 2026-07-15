# @opentui/solid — Solid binding

Solid's fine-grained reactivity maps well to a frame-rendered TUI: signal updates patch only the affected renderables, no re-render pass.

## Setup

```bash
bun create tui   # choose the solid template
```

Strongly prefer the scaffold here. Solid JSX is a *compile-time* transform (unlike React's `react-jsx`), so it needs build tooling wired up — the template configures Bun to compile Solid JSX correctly. If adding to an existing project instead: `bun add @opentui/core @opentui/solid solid-js`, then replicate the template's JSX/build config rather than inventing your own.

## Entry point

```tsx
import { render } from "@opentui/solid"

render(() => <App />)

// with renderer config:
render(() => <App />, {
  targetFps: 30,
  exitOnCtrlC: false,
})
```

Note the thunk — `render(() => <App />)`, not `render(<App />)`. Solid needs the lazy call to set up reactivity. The renderer is created for you; `render` accepts `createCliRenderer` options as the second argument.

## Elements

Same lowercase intrinsic elements as the other bindings, mapping to core renderables: `<box>`, `<text>`, `<input>`, `<select>`, `<scrollbox>`, `<code>`. Props can sit directly on the element (`<box border padding={2}>`).

## A complete app

```tsx
import { render, useKeyboard, useRenderer } from "@opentui/solid"
import { createSignal } from "solid-js"

const App = () => {
  const [count, setCount] = createSignal(0)
  const renderer = useRenderer()

  useKeyboard((key) => {
    if (key.name === "up") setCount((c) => c + 1)
    if (key.name === "down") setCount((c) => c - 1)
    if (key.name === "escape") renderer.destroy()
  })

  return (
    <box border padding={2}>
      <text>Count: {count()}</text>
      <text fg="#888">Up/Down to change, ESC to close</text>
    </box>
  )
}

render(App)
```

Solid rules apply, and they're the usual gotchas for people coming from React:

- Read signals as calls **inside JSX**: `{count()}` — destructuring or reading outside a tracked scope loses reactivity.
- Components run **once**; there are no re-renders and no hook ordering rules. `useKeyboard` is registered once and stays live.
- Use `createSignal` / `createMemo` / `createEffect` from `solid-js`, `<Show>` / `<For>` for conditional and list rendering.

## Hooks

```tsx
import { useKeyboard, useRenderer } from "@opentui/solid"
```

- `useKeyboard(handler)` — global keys regardless of focus; put app shortcuts (quit, tab switching) here.
- `useRenderer()` — renderer instance: `renderer.destroy()` to quit cleanly, `renderer.console.show()` to see `console.log` output.

Focus works like React: the focused element receives typed input; drive which input is focused from a signal.
