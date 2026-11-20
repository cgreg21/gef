# GNOME Extension Framework (GEF)

A TypeScript framework for building GNOME Shell extensions, initially targeting **GNOME Shell 51**.

GEF aims to provide an Angular-inspired developer experience for GNOME Shell: typed components, declarative `.gtpl` templates, SCSS styles, dependency injection, reactive state, lifecycle/resource management, a compiler, and a CLI.

> Project status: early foundation. The public API and compiler are under active design; examples in the documentation describe the intended API and are not yet implemented runtime features.

## Goals

- Target GNOME Shell 51 first; avoid claiming compatibility with other Shell releases until tested.
- Author extension logic in TypeScript and compile it to JavaScript for GJS.
- Use `.gtpl` as the canonical template format.
- Compile templates ahead of time into native St/Clutter actor construction; no browser DOM or runtime HTML parser.
- Compile SCSS into GNOME Shell-compatible St CSS and validate it against the target platform.
- Keep Shell UI and GTK4/libadwaita preferences as separate renderers.
- Make lifecycle cleanup, diagnostics, and automated validation first-class.

## Documentation

- [Architecture](docs/architecture.md)
- [GTPL language specification](docs/gtpl-language.md)
- [Development status](docs/roadmap.md)

## Development

The repository is being bootstrapped. The first implementation milestone is the GTPL parser and its diagnostics, followed by expression/type validation and JavaScript code generation.

```sh
npm install
npm run typecheck
npm test
```

## License

TBD.
