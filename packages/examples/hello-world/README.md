# GEF Hello World

This example targets GNOME Shell 51 and uses the native St renderer host.

Build and stage the extension from the repository root:

```sh
npm run build
npm run package:example
```

The packaging step compiles `template.gtpl` with the `gef compile` CLI, then stages the generated template beside the extension entry point. The staged extension is written to `dist/extension/`. Copy that directory into
the GNOME Shell extensions directory for a local integration test.

The package script preserves ESM modules and rewrites only the example's
runtime import to the staged `lib/runtime/` directory. It is a minimal staging
step, not a general-purpose GJS bundler.
