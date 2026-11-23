# GEF Kitchen Sink

A runnable GTK4 gallery of the native widgets and GTPL layout containers
currently supported by GEF. The template is the source of truth: it uses GTPL
tags directly and does not require a parallel TypeScript layout configuration.

## Run

From the repository root:

```sh
npm install
npm run build:kitchen-sink
gjs -m packages/examples/kitchen-sink/kitchen-sink.js
```

Requirements: Node.js 22+, GJS and GTK4.

## Included

- GTK buttons, labels, separators, text entry, search entry and password entry.
- Checkbox, switch, spin button and progress bar.
- GTPL `Flex`, `Grid`, `HeaderBar` and `Sidebar` containers.
- A two-column grid and nested row/column layouts.

## Platform notes

This executable gallery runs on GTK4. GEF also maps the shared GTPL layout
containers to GNOME Shell St widgets, but individual GTK controls do not all
have a one-to-one St equivalent. Consult [the UI component guide](../../../docs/ui-components.md)
and [the layout guide](../../../docs/ui-layout.md) for the current compatibility
matrix and known limitations.
