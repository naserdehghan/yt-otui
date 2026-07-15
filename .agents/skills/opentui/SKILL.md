---
name: opentui
description: Build terminal user interfaces (TUIs) with OpenTUI — a TypeScript TUI framework with a native Zig core, flexbox layout, and React/Solid bindings. Use this skill whenever the user wants to build a TUI, terminal UI, interactive CLI, terminal dashboard, terminal form/menu/wizard, or a text-based app that runs in the terminal — even if they never say "OpenTUI" (e.g. they say "like opencode", "ncurses-style", "an Ink-like app in Bun", or "a CLI with panels and keyboard navigation"). Also use when the user mentions @opentui/core, @opentui/react, or @opentui/solid, or asks how to render boxes, inputs, selects, or syntax-highlighted code in a terminal.
---

# OpenTUI

OpenTUI (https://opentui.com) is a TypeScript framework for building terminal user interfaces. The rendering core is written in Zig and exposed through TypeScript bindings, so it is fast enough for animations and per-frame updates. Layout is real flexbox (powered by Yoga), so terminal UIs are laid out the same way as CSS — `flexDirection`, `flexGrow`, `padding`, percentage widths all work. It is the foundation TUI framework for opencode and terminal.shop.

**Runtime: Bun.** OpenTUI is Bun-first. Run apps with `bun run`, install with `bun add`. Don't reach for Node/npm unless the user's project already forces it.

## Choosing an API

OpenTUI has one core package and two framework bindings. Pick based on the project, then read the matching reference file before writing code:

| Package | When to use | Reference |
|---|---|---|
| `@opentui/core` | No framework dependency wanted; imperative control; simple apps, scripts, or custom renderables | `references/core.md` |
| `@opentui/react` | User knows React, app has meaningful state/interaction, or project already uses React | `references/react.md` |
| `@opentui/solid` | User prefers Solid or wants fine-grained reactivity without React's re-render model | `references/solid.md` |

If the user has no preference: use **core** for small single-screen tools (a picker, a progress display), and **react** for anything with real state — forms, dashboards, multi-panel apps — since JSX + hooks keep that code much shorter.

Read only the reference file for the binding you're using. Each file is self-contained.

## Project setup

The scaffold sets everything up (including the JSX transform for React/Solid):

```bash
bun create tui
```

It prompts for a template (core / react / solid / vue / go). For adding to an existing project:

```bash
bun add @opentui/core                      # core only
bun add @opentui/core @opentui/react react # react
bun add @opentui/core @opentui/solid solid-js # solid
```

React needs `"jsx": "react-jsx"` in tsconfig. Solid needs Solid's JSX transform, which is non-trivial to wire manually — prefer `bun create tui` with the solid template. Details in each reference file.

## The mental model

Every OpenTUI app is the same shape regardless of binding:

1. A **renderer** owns the terminal (`createCliRenderer()` — async). It takes over the screen, runs a frame loop, and restores the terminal on destroy.
2. A **tree of renderables** hangs off `renderer.root` — Box, Text, Input, Select, ScrollBox, Code, etc. The bindings (React/Solid) just manage this tree for you.
3. **Flexbox** positions everything. There are no absolute cursor coordinates in normal use — size and position come from layout props.
4. **Focus** routes keyboard input. An `Input` or `Select` only receives keys while focused (`.focus()` in core, `focused` prop in React/Solid). App-level shortcuts (quit on `q`, tab switching) are handled by a global keyboard hook/handler, not by components.

## Things that bite people

- **`console.log` doesn't print.** The renderer owns the screen. OpenTUI captures console output into a built-in overlay — call `renderer.console.show()` to see it (toggleable). For debugging, use that overlay or write to a log file.
- **The process keeps running.** The renderer runs a frame loop; the app exits when you call `renderer.destroy()` (or `process.exit`). `exitOnCtrlC: true` is the default escape hatch — keep it on unless the app needs Ctrl+C itself, and always wire an explicit quit key.
- **Unfocused inputs eat nothing.** If typing does nothing, you forgot to focus the input. Exactly one focusable should be focused at a time; manage which one via state (bindings) or `.focus()`/`.blur()` (core).
- **Dimensions are cells, not pixels.** `width: 40` is 40 characters. Percentages (`"100%"`) and flex sizing work and are usually better than fixed numbers — terminals get resized.
- **A box with `border: true` needs height ≥ 3** to show one line of content (border top + content + border bottom).

## Verifying your work

A TUI takes over the terminal, so you can't assert on stdout like a normal CLI. Practical checks, cheapest first:

1. `bun build --no-bundle src/index.tsx` or `bunx tsc --noEmit` — catches type/JSX config errors.
2. Run the app with a kill timer in a real terminal when possible. If you're in a non-interactive shell, at minimum confirm the process starts and survives a second without throwing: `timeout 2 bun run src/index.tsx; [ $? -eq 124 ] && echo "ran until timeout (good)"`.
3. For behavior (focus flow, key handling), ask the user to run it — describe the exact keys to press and what they should see.
