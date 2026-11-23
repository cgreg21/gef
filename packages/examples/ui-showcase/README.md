# GEF UI Showcase

A small GTK4 application that renders a real native widget gallery from GTPL.
It is intended for manual inspection and for generating documentation screenshots.

## Run

From the repository root:

```sh
npm install
npm run build
node dist/cli/src/index.js compile packages/examples/ui-showcase/template.gtpl dist/examples/ui-showcase/template.js
gjs -m packages/examples/ui-showcase/showcase.js
```

The host requires GJS and GTK4. The example uses native GTK4 widgets through the
GEF GTK renderer; the GNOME Shell extension example remains the St renderer
counterpart.

## Screenshot

On a graphical GNOME/GTK session, launch the app and capture its window with
your preferred desktop screenshot utility. CI also generates an Xvfb screenshot
as a build artifact when the screenshot tooling is available.
