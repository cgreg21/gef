# GEF Kitchen Sink

A TypeScript GTK4 application that demonstrates GEF by mounting real GTPL screens through the framework's GTK render host.

## Screens

- **Overview** — dashboard cards and recent activity.
- **Actions** — primary, secondary and destructive action patterns.
- **Forms** — text, search and password inputs.
- **Preferences** — switches, checkboxes and numeric settings.
- **Layouts** — Sidebar, Flex, Grid and progress controls.

The application shell, navigation and source viewer are written in TypeScript. Each screen is a GTPL template rendered by GEF; **View source** opens the template used by the active screen.

## Run with Node.js

```powershell
npm install
npm run kitchen-sink
```

To compile the application and templates without opening the window:

```powershell
npm run build:kitchen-sink
```

Requirements: Node.js 22+ and the project's `node-gtk` development dependency. The native GTK runtime and its platform dependencies must be installed.

## Run with GJS (GNOME/Linux)

```sh
npm install
npm run build:kitchen-sink
gjs -m packages/examples/kitchen-sink/kitchen-sink.js
```

## Structure

- `kitchen-sink.ts` — typed GTK application shell and GEF integration.
- `demos/*.gtpl` — source templates rendered by GEF.
- `kitchen-sink.js` — optional GJS entry point.
