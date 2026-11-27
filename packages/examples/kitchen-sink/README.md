# GEF Kitchen Sink

Application GTK4 écrite en TypeScript. Elle présente les composants et les templates GTPL de GEF dans une vraie interface native.

## Démonstrations

- **Overview** — cartes de statistiques.
- **Actions** — boutons GEF, actions et contrôles natifs.
- **Forms** — champs texte, recherche, texte multiligne, mot de passe et boutons GEF.
- **Preferences** — libellés GEF, interrupteurs et cases à cocher natifs, valeurs numériques.
- **Layouts** — mises en page Flex, Sidebar et Grid.

La navigation entre les écrans utilise le routeur GEF (`/overview`, `/actions`, `/forms`, `/preferences`, `/layouts`) et propose des commandes **Back**/**Forward** qui reflètent les possibilités de l'historique. Chaque écran possède un bouton **View source** pour consulter son template GTPL.

## Composants GEF

Le registre du Kitchen Sink part de `createGtkUiRegistry()` : les douze composants UI publics sont donc disponibles dans les templates. Les démonstrations Actions et Forms utilisent `GefButton` ; Actions et Preferences utilisent `GefLabel`. Les interrupteurs, cases à cocher et champs numériques de Preferences restent natifs GTK, car leurs valeurs initiales booléennes et numériques ne sont pas encore reliées à une API de formulaire GEF.

L'application déclare aussi deux composants de démonstration dans `components.ts` :

- `GefSectionHeader` — titre et description.
- `GefMetricCard` — titre, valeur et détail.

Ces composants utilisent les décorateurs et métadonnées GEF, puis sont ajoutés au registre UI GTK.

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
- `components.ts` — composants GEF de démonstration et registre UI GTK.
- `demos/` — écrans GTPL.
- `kitchen-sink.js` — point d'entrée GJS.
