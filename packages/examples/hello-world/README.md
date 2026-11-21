# GEF Hello World

This example targets GNOME Shell 51 and uses the native St renderer host.

Build and stage the extension from the repository root:

```sh
npm run build
npm run package:example
```

The packaging step compiles both GTPL templates, compiles the SCSS stylesheet with Sass, and stages the Shell entry point, GTK4/libadwaita preferences entry point and runtime modules. The staged extension is written to `dist/extension/`. Copy that directory into
the GNOME Shell extensions directory for a local integration test.

The package script preserves ESM modules and rewrites only the example's
runtime import to the staged `lib/runtime/` directory. It is a minimal staging
step, not a general-purpose GJS bundler.
