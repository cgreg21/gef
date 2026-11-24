# GEF Kitchen Sink

A native GTK4 application written in TypeScript. Its screens are GTPL templates rendered by GEF, with reusable TypeScript components registered through `ComponentRegistry`.

## Screens

- **Overview** — dashboard with reusable metric cards.
- **Actions** — action groups and native controls.
- **Forms** — text, search and password fields.
- **Preferences** — switches, checkboxes and numeric settings.
- **Layouts** — nested Flex, Sidebar and Grid layouts.

## GEF components

The app defines two GTK-oriented GEF components in `components.ts`:

- `GefSectionHeader` — reusable title and description.
- `GefMetricCard` — reusable metric card with title, value and detail inputs.

They declare their inputs with GEF metadata, register typed render functions in a `ComponentRegistry`, and are used directly in the GTPL screens. The same registry is passed to `mountGtplTemplate`, so the examples exercise the real component mounting and cleanup path rather than wrapping widgets only in the application shell.

The GTK application shell, navigation and source viewer are TypeScript. **View source** opens the GTPL template for the active screen.

## Run

From the repository root:

```powershell
npm install
npm run kitchen-sink
```

Compile without launching the window:

```powershell
npm run build:kitchen-sink
```

Requires Node.js 22+, the project's `node-gtk` dependency and GTK4 runtime libraries.

## Structure

- `kitchen-sink.ts` — typed GTK application shell and GEF integration.
- `components.ts` — reusable GEF component classes and registry.
- `demos/*.gtpl` — screens composed from GEF components and GTK widgets.
- `kitchen-sink.js` — separate GJS entry point.
