# GEF styles

GEF uses Sass as a build-time compiler. Compile stylesheets with:

```sh
npm run build
node dist/cli/src/index.js styles src/styles.scss dist/styles.css
```

The resulting CSS must use properties and selectors supported by the target
GNOME Shell St theme engine or GTK CSS provider. Browser-only layout features
are not automatically translated by GEF.
