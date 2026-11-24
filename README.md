# GEF — GNOME Extension Framework

[![CI](https://github.com/cgreg21/gef/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/cgreg21/gef/actions/workflows/ci.yml)
[![Last commit](https://img.shields.io/github/last-commit/cgreg21/gef)](https://github.com/cgreg21/gef/commits/main)
[![Open issues](https://img.shields.io/github/issues/cgreg21/gef)](https://github.com/cgreg21/gef/issues)
[![Stars](https://img.shields.io/github/stars/cgreg21/gef)](https://github.com/cgreg21/gef/stargazers)

GEF est un framework TypeScript et GTPL pour créer des extensions GNOME Shell 51 et des applications natives GTK4/libadwaita.

Il fournit un compilateur de templates, des composants décorés, un runtime réactif et une CLI. Les extensions GJS et les applications Node-GTK utilisent des cibles d'exécution distinctes. GEF n'utilise pas le DOM du navigateur.

> **Statut : alpha.** Le framework évolue encore. Certaines API et certains comportements peuvent changer. Les outils de validation ne garantissent pas l'acceptation d'une extension sur extensions.gnome.org.

## Prérequis

- Node.js 22 ou supérieur
- GNOME Shell 51 et GJS pour développer une extension
- GTK4 et libadwaita pour exécuter une application native
- Sass pour compiler les feuilles de style
- `zip` et `unzip` pour créer et vérifier les archives d'extensions

## Installation

Depuis ce dépôt :

```sh
npm install
npm run build
npm run check
```

Pour créer un projet avec la CLI locale :

```sh
npm run gef -- new my-extension
```

Pour une application GTK :

```sh
npm run gef -- new my-app --type application
```

Après publication du package :

```sh
npm install --save-dev gnome-extension-framework@next
npx gef new my-extension
```

Le premier package npm n'est pas encore publié. Jusqu'à sa publication, utilisez la CLI depuis le dépôt.

## Développement

Commandes principales, à lancer depuis la racine :

| Commande | Description |
| --- | --- |
| `npm run check` | Vérifie le code et les types |
| `npm run build` | Compile le framework |
| `npm run gef -- --help` | Affiche l'aide de la CLI |
| `npm run test:gtk` | Lance les tests natifs GTK |
| `npm run build:kitchen-sink` | Compile l'application de démonstration |
| `npm run kitchen-sink` | Lance le Kitchen Sink GTK |
| `npm run test:gnome` | Teste l'extension sur GNOME Shell 51 |
| `npm run package:example` | Prépare et empaquette l'exemple d'extension |

Le test GNOME nécessite un environnement Linux avec GNOME Shell 51, GJS, D-Bus et Xvfb. Les applications GTK nécessitent les bibliothèques GTK4 et libadwaita de la plateforme.

## Exemple

GEF utilise des décorateurs pour déclarer les composants et leurs entrées :

```ts
import { Component, Input } from "gnome-extension-framework";

@Component({
  selector: "app-greeting",
  template: `<GtkLabel label="{name}" />`,
})
export class GreetingComponent {
  @Input() name = "GNOME";
}
```

La syntaxe exacte des templates et les API disponibles sont décrites dans le guide des composants.

## Documentation

- [Démarrage](docs/getting-started.md)
- [Référence de la CLI](docs/cli-reference.md)
- [Langage GTPL](docs/gtpl-language.md)
- [Composants, directives et pipes](docs/components.md)
- [Guide des composants UI](docs/ui-components.md)
- [Layouts](docs/ui-layout.md)
- [Architecture](docs/architecture.md)
- [Conformité extensions.gnome.org](docs/ego-compliance.md)
- [Configuration des releases npm](docs/npm-release.md)
- [Roadmap](docs/roadmap.md)

Exemples :
- [Kitchen Sink GTK](packages/examples/kitchen-sink/README.md)
- [UI Showcase](packages/examples/ui-showcase/README.md)

## Packages

- **`gnome-extension-framework`** — compilateur, déclarations et outils GTPL.
- **`gnome-extension-framework/runtime`** — runtime, composants, injection de dépendances, réactivité et renderers GJS/GTK.
- **`gef`** — CLI de création, compilation et packaging.

## Périmètre

GEF fournit les bases nécessaires à la création de projets GNOME : templates GTPL, composants et métadonnées, directives, pipes, injection de dépendances, signaux réactifs, gestion du cycle de vie et renderers natifs.

Le framework est encore en développement. Consultez la [roadmap](docs/roadmap.md) pour connaître les fonctionnalités en cours et les limites actuelles.
