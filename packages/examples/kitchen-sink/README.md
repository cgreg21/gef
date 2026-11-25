# GEF Kitchen Sink

Application GTK4 écrite en TypeScript. Elle présente les composants et les templates GTPL de GEF dans une vraie interface native.

## Démonstrations

- **Overview** — cartes de statistiques.
- **Actions** — boutons, actions et contrôles natifs.
- **Forms** — champs texte, recherche et mot de passe.
- **Preferences** — interrupteurs, cases à cocher et valeurs numériques.
- **Layouts** — mises en page Flex, Sidebar et Grid.

La navigation entre les écrans utilise le routeur GEF (`/overview`, `/actions`, `/forms`, `/preferences`, `/layouts`) et conserve l'historique précédent/suivant. Chaque écran possède un bouton **View source** pour consulter son template GTPL.

## Composants GEF

L'application déclare deux composants réutilisables dans `components.ts` :

- `GefSectionHeader` — titre et description.
- `GefMetricCard` — titre, valeur et détail.

Ils utilisent les décorateurs et métadonnées GEF, puis sont enregistrés dans un `ComponentRegistry`. Les templates les utilisent directement.

## Lancer l'application

Depuis la racine du dépôt :

```sh
npm install
npm run kitchen-sink
```

Pour compiler sans lancer l'application :

```sh
npm run build:kitchen-sink
```

Prérequis : Node.js 22+, GTK4 et la dépendance Node-GTK du projet.

## Fichiers

- `kitchen-sink.ts` — application, routeur GEF et navigation.
- `components.ts` — composants GEF de démonstration.
- `demos/` — écrans GTPL.
- `kitchen-sink.js` — point d'entrée GJS.
