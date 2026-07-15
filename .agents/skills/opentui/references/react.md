# @opentui/react — React binding

Write the UI as React components; the binding maps JSX to OpenTUI renderables. All of React's model applies — `useState`, `useEffect`, context, custom hooks.

## Setup

```bash
bun add @opentui/core @opentui/react react
```

tsconfig needs the standard automatic JSX transform:

```json
{ "compilerOptions": { "jsx": "react-jsx" } }
```

Files are `.tsx`, run directly with `bun run src/index.tsx`. (`bun create tui` with the react template produces this setup.)

## Entry point

```tsx
import { createCliRenderer } from "@opentui/core"
import { createRoot } from "@opentui/react"

const renderer = await createCliRenderer()
createRoot(renderer).render(<App />)
```

Pass renderer options (`exitOnCtrlC`, `targetFps`) to `createCliRenderer` as usual.

## Elements

JSX intrinsic elements are lowercase and map 1:1 to core renderables: `<box>`, `<text>`, `<input>`, `<select>`, `<scrollbox>`, `<code>`. Layout/visual props go in `style`; behavioral props (`focused`, `placeholder`, event handlers) sit directly on the element.

```tsx
function App() {
  const [value, setValue] = useState("")

  return (
    <box title="Enter your name" style={{ border: true, height: 3 }}>
      <input
        placeholder="Type here..."
        focused
        onInput={setValue}
        onSubmit={(value) => console.log("Submitted:", value)}
      />
    </box>
  )
}
```

- `style` takes the flexbox + visual props from core: `flexDirection`, `flexGrow`, `gap`, `padding`, `width`/`height` (cells or `"50%"`), `border`, `borderStyle`, `backgroundColor`.
- `<text fg="#FFFF00">` for colored text; children are the content.
- `<input>`: `focused` (boolean — this is how focus is controlled in React), `placeholder`, `onInput(value)`, `onSubmit(value)`.
- `<code content={src} filetype="typescript" syntaxStyle={style} />` — build `syntaxStyle` with `SyntaxStyle.fromStyles({...})` from `@opentui/core` (see core.md).

## Hooks

```tsx
import { useKeyboard, useRenderer } from "@opentui/react"
```

**`useKeyboard(handler)`** — global key events, regardless of focus. This is where app-level shortcuts live:

```tsx
useKeyboard((key) => {
  if (key.name === "escape") process.exit(0)
})
```

**`useRenderer()`** — the renderer instance, for console overlay, destroy, etc.:

```tsx
const renderer = useRenderer()
useEffect(() => {
  renderer.console.show() // make console.log visible in an overlay
}, [])
```

`useTerminalDimensions()` gives reactive `{ width, height }` for responsive layouts.

## Focus pattern

Only the `focused` element receives typed input. Drive it with state; `useKeyboard` handles the switching key since it fires regardless of focus:

```tsx
function App() {
  const [focused, setFocused] = useState<"username" | "password">("username")

  useKeyboard((key) => {
    if (key.name === "tab") setFocused((p) => (p === "username" ? "password" : "username"))
  })

  return (
    <box style={{ border: true, padding: 2, flexDirection: "column", gap: 1 }}>
      <box title="Username" style={{ border: true, width: 40, height: 3 }}>
        <input focused={focused === "username"} onInput={setUsername} onSubmit={handleSubmit} />
      </box>
      <box title="Password" style={{ border: true, width: 40, height: 3 }}>
        <input focused={focused === "password"} onInput={setPassword} onSubmit={handleSubmit} />
      </box>
    </box>
  )
}
```

## Custom components

Register a custom renderable class as a new JSX element with `extend`:

```tsx
import { BoxRenderable, OptimizedBuffer, RGBA, type BoxOptions, type RenderContext } from "@opentui/core"
import { extend } from "@opentui/react"

class ConsoleButton extends BoxRenderable {
  public label: string = "Button"

  constructor(ctx: RenderContext, options: BoxOptions & { label: string }) {
    super(ctx, options)
    this.height = 3
    this.width = 24
  }

  protected renderSelf(buffer: OptimizedBuffer): void {
    super.renderSelf(buffer)
    const centerX = this.x + Math.floor(this.width / 2 - this.label.length / 2)
    const centerY = this.y + Math.floor(this.height / 2)
    buffer.drawText(this.label, centerX, centerY, RGBA.fromInts(255, 255, 255, 255))
  }
}

declare module "@opentui/react" {
  interface OpenTUIComponents {
    consoleButton: typeof ConsoleButton
  }
}

extend({ consoleButton: ConsoleButton })

// now: <consoleButton label="Click me!" />
```

The `declare module` block is what makes TypeScript accept the new element — don't skip it.
