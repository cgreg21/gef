# GEF documentation

Use this index to find the guide for each part of the framework.

## Start here

- [Getting started](getting-started.md) — create, build and validate a first extension.
- [CLI reference](cli-reference.md) — command syntax, behavior and exit statuses.
- [Development roadmap](roadmap.md) — implemented work and remaining alpha tasks.

## UI

- [UI components — guide complet](ui-components.md) — catalogue illustré, propriétés, événements, exemples GTPL, conteneurs et compatibilité GTK4/GNOME Shell.
- [UI layout](ui-layout.md) — Flex, Grid, breakpoints et calculs responsive.
- [GEF Kitchen Sink](../packages/examples/kitchen-sink/README.md) — galerie GTK4 des widgets et conteneurs GTPL disponibles.
- [GTK UI showcase](../packages/examples/ui-showcase/README.md) — démonstration native GTK4 minimale.

## Language and compiler

- [GTPL language](gtpl-language.md) — template syntax, expressions, control flow and source locations.
- [Semantic analysis](semantic-analysis.md) — component contracts, identifiers and template scopes.
- [Components, directives and pipes](components.md) — declarations, inputs, outputs and runtime registration.

## Runtime and distribution

- [Architecture](architecture.md) — compiler, runtime, renderer and process boundaries.
- [Runtimes and compatibility](runtimes.md) — prerequisites, platform matrix, validation commands and known limitations.
- [EGO compliance](ego-compliance.md) — metadata, lifecycle, process isolation and archive requirements.
- [npm releases](npm-release.md) — alpha/stable channels and trusted publishing setup.

GEF is alpha software. GNOME Shell 51 is the initial extension target; Node-GTK applications use a separate desktop runtime. APIs and generated output may change. Passing local checks does not guarantee extensions.gnome.org approval.
