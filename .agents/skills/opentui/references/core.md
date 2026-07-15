# @opentui/core — imperative and declarative API

Everything here needs only `@opentui/core`. Two styles exist and mix freely:

- **Renderable classes** (`BoxRenderable`, `InputRenderable`, …) — imperative, `new`-ed with the renderer, added to a parent. Best when you need handles to mutate things later.
- **Declarative helpers** (`Box(...)`, `Text(...)`) — nested function calls that build the same tree. Best for mostly-static layout.

## Renderer

```typescript
import { createCliRenderer } from "@opentui/core"

const renderer = await createCliRenderer({
  exitOnCtrlC: true, // default; Ctrl+C destroys renderer and exits
  targetFps: 30,     // frame budget; 30 is plenty for UIs, raise for animation
})

renderer.root.add(someRenderable) // mount
renderer.console.show()           // overlay that captures console.log output
renderer.destroy()                // restore terminal, stop loop — call this to quit
```

`createCliRenderer` is async — top-level `await` works under Bun.

## Layout: Box and Text

```typescript
import { Box, Text } from "@opentui/core"

renderer.root.add(
  Box(
    { flexDirection: "row", width: "100%", height: 10 },
    Box({ flexGrow: 1, backgroundColor: "#333", padding: 1 }, Text({ content: "Left Panel" })),
    Box({ width: 20, backgroundColor: "#555", padding: 1 }, Text({ content: "Right Panel" })),
  ),
)
```

Layout props are flexbox: `flexDirection`, `flexGrow`, `flexShrink`, `alignItems`, `justifyContent`, `gap`, `padding`, `margin`, `width`/`height` (number = terminal cells, or `"50%"`).

Box borders:

```typescript
{ border: true }                 // single-line border (default style)
{ borderStyle: "single" }        // ┌─┐
{ borderStyle: "double" }        // ╔═╗
{ borderStyle: "rounded" }       // ╭─╮
{ borderStyle: "heavy" }         // ┏━┓
{ border: true, title: "Files" } // title rendered in the top border
```

## Text styling

Plain props on a text renderable:

```typescript
import { TextRenderable, TextAttributes, RGBA } from "@opentui/core"

const styled = new TextRenderable(renderer, {
  id: "styled",
  content: "Important",
  fg: RGBA.fromHex("#FFFF00"),
  bg: RGBA.fromHex("#333333"),
  attributes: TextAttributes.BOLD | TextAttributes.UNDERLINE,
})
```

Rich inline styling via the `t` template literal — use this when one line mixes styles:

```typescript
import { t, bold, dim, italic, underline, strikethrough, fg, bg } from "@opentui/core"

t`${bold("bold")} and ${fg("#FF0000")("red")} and ${bold(fg("#FFFF00")("bold yellow"))}`
```

Colors accept hex strings on most props; `RGBA.fromHex("#...")` / `RGBA.fromInts(r, g, b, a)` where an RGBA object is required.

## Interactive components

Focus is what routes keys to a component. Call `.focus()` on exactly one focusable; `.blur()` releases it.

**Input:**

```typescript
import { InputRenderable, InputRenderableEvents } from "@opentui/core"

const input = new InputRenderable(renderer, {
  id: "name-input",
  width: 25,
  placeholder: "Enter your name...",
  onKeyDown: (key) => {
    if (key.name === "escape") input.blur()
  },
})
input.on(InputRenderableEvents.CHANGE, (value) => { /* value: string */ })
input.focus()
renderer.root.add(input)
```

**Select:**

```typescript
import { SelectRenderable, SelectRenderableEvents } from "@opentui/core"

const menu = new SelectRenderable(renderer, {
  id: "menu",
  width: 30,
  height: 8,
  options: [
    { name: "New File", description: "Create a new file" },
    { name: "Exit", description: "Exit the application" },
  ],
})
menu.on(SelectRenderableEvents.ITEM_SELECTED, (index, option) => {
  if (option.name === "Exit") renderer.destroy()
})
menu.focus()
renderer.root.add(menu)
```

**Code** (tree-sitter syntax highlighting):

```typescript
import { CodeRenderable, SyntaxStyle, RGBA } from "@opentui/core"

const syntaxStyle = SyntaxStyle.fromStyles({
  keyword: { fg: RGBA.fromHex("#FF7B72"), bold: true },
  string: { fg: RGBA.fromHex("#A5D6FF") },
  comment: { fg: RGBA.fromHex("#8B949E"), italic: true },
  number: { fg: RGBA.fromHex("#79C0FF") },
  function: { fg: RGBA.fromHex("#D2A8FF") },
  default: { fg: RGBA.fromHex("#E6EDF3") },
})

const code = new CodeRenderable(renderer, {
  id: "code",
  content: sourceString,
  filetype: "javascript",
  syntaxStyle,
  width: 50,
  height: 10,
})
```

Other bundled components: `ScrollBox` (scrollable container for overflowing content), `TabSelect` (horizontal tab bar), ASCII-font text for large headings, and a `Diff` view. Same pattern as above; check https://opentui.com/docs/components/ for the exact options if you need them.

## Keyboard and paste

Focusable renderables take an `onKeyDown` option (see Input above) and an `onPaste`:

```typescript
const textDecoder = new TextDecoder()
// in options:
onPaste: (event) => {
  console.log("Pasted:", textDecoder.decode(event.bytes))
}
```

`key.name` holds names like `"escape"`, `"tab"`, `"up"`, `"down"`, `"return"`, or the character itself.

For app-global shortcuts in a core app, put the handler on whatever is focused, or keep one always-focused root component that dispatches. (In the React/Solid bindings this is cleaner — `useKeyboard` is global.)

## Custom renderables

Subclass a renderable when a component needs its own drawing or per-frame behavior:

```typescript
import { Renderable, OptimizedBuffer } from "@opentui/core"

class CustomRenderable extends Renderable {
  onUpdate(deltaTime: number) {}                          // each frame, before render
  onResize(width: number, height: number) {}              // dimensions changed
  onRemove() {}                                           // removed from parent — cleanup
  renderSelf(buffer: OptimizedBuffer, deltaTime: number) {
    // draw directly: buffer.drawText(text, x, y, rgba)
  }
}
```

`this.x`, `this.y`, `this.width`, `this.height` are the layout-computed position/size — draw relative to them.
