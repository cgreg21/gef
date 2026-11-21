# GEF Hello World

This example targets GNOME Shell 51 and uses the native St renderer host.

Build and stage the extension from the repository root:

```sh
npm run build
npm run package:example
```

The packaging step compiles both GTPL templates and the Shell stylesheet,
stages runtime ESM modules, the GSettings schema and metadata, and verifies
relative imports. The staged extension is written to `dist/extension/`.

The packaging step compiles the GSettings schema into `gschemas.compiled`.

The preferences example binds its switch bidirectionally to the `enabled`
GSettings key through the runtime adapter.
