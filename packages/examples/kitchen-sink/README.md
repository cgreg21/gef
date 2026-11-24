# GEF Kitchen Sink

A native GTK4 demo gallery for the GEF renderer. The app is organized as
focused screens instead of one long widget list:

- **Overview** — dashboard cards and recent activity.
- **Actions** — primary, secondary and destructive action patterns.
- **Forms** — text, search and password inputs.
- **Preferences** — switches, checkboxes and numeric settings.
- **Layouts** — Sidebar, Flex, Grid and progress controls.

Each screen has a **View source** action in the header. It opens the exact
GTPL file used to render that screen.

## Run with Node.js (Windows, Linux and macOS)

From the repository root:

```powershell
npm install
npm run kitchen-sink
```

To compile the screens without opening the application:

```powershell
npm run build:kitchen-sink
```

Requirements: Node.js 22+ and the project's `node-gtk` development dependency.
On Windows, use a Node.js version supported by the installed Node-GTK package.

## Run with GJS (GNOME/Linux)

The GJS entry point is retained for GTK/GNOME development:

```sh
npm install
npm run build:kitchen-sink
gjs -m packages/examples/kitchen-sink/kitchen-sink.js
```

## Structure

- `demos/*.gtpl` — source of truth for each screen.
- `kitchen-sink-node.mjs` — native GTK application shell, navigation and source viewer.
- `kitchen-sink.js` — GJS entry point.
