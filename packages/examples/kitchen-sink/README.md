# GEF Kitchen Sink

A runnable GTK4 gallery of the native widgets and GTPL layout containers
currently supported by GEF. The template is the source of truth: it uses GTPL
tags directly and does not require a parallel TypeScript layout configuration.

## Run with Node.js (Windows, Linux and macOS)

Node-GTK provides the GTK4 runtime through Node.js. On Windows, its published
package includes the GTK4/Adwaita binaries for supported Node.js versions.

From the repository root:

```powershell
npm install
npm run build:kitchen-sink
npm run kitchen-sink
```

Requirements: Node.js 22+ (Node-GTK provides prebuilt binaries for Node.js
22, 24 and 26). The `node-gtk` dependency is installed with the project's
development dependencies; no GJS or WSL is required for this entry point.

## Run with GJS (GNOME/Linux)

The GJS entry point remains available for GNOME-oriented environments:

```sh
npm install
npm run build:kitchen-sink
gjs -m packages/examples/kitchen-sink/kitchen-sink.js
```

Requirements: GJS and GTK4.

## Included

- GTK buttons, labels, separators, text entry, search entry and password entry.
- Checkbox, switch, spin button and progress bar.
- GTPL `Flex`, `Grid`, `HeaderBar` and `Sidebar` containers.
- A two-column grid and nested row/column layouts.

## Platform notes

Both entry points use the same GTPL template and GEF GTK renderer. The Node.js
entry point selects the renderer's `node-gtk` API mode; the GJS entry point
uses its GJS mode. GEF also maps the shared GTPL layout containers to GNOME
Shell St widgets, but individual GTK controls do not all have a one-to-one St
equivalent. Consult [the UI component guide](../../../docs/ui-components.md)
and [the layout guide](../../../docs/ui-layout.md) for the current compatibility
matrix and known limitations.
