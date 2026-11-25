# Runtimes et compatibilité

GEF partage ses métadonnées de composants, son compilateur GTPL et une partie de son runtime. Il ne fournit pas un environnement graphique universel : chaque application utilise les widgets natifs de sa plateforme.

## Matrice des environnements

| Cible | Exécution | Interface native | Entrée générée | Validation |
| --- | --- | --- | --- | --- |
| Extension GNOME Shell | GJS dans le processus Shell | St et Clutter | src/extension.ts | Harness GNOME Shell 51 |
| Préférences d'extension | GJS dans un processus séparé | GTK4 et libadwaita | Module de préférences | Smoke tests GTK |
| Application desktop | Node.js avec node-gtk 4 | GTK4 et libadwaita | src/main.ts | Smoke tests Node-GTK et packaging natif |

Le compilateur GTPL et les métadonnées de composants peuvent être partagés. Les widgets, chargeurs de modules, cycles de vie et API de plateforme ne le sont pas. Les imports gi:// et resource:/// appartiennent à GJS. Les imports gi:Gtk-4.0 et gi:Adw-1 sont propres au chargeur ESM de Node-GTK.

## Prérequis

### Compiler et CLI

- Node.js 22 ou plus récent
- npm
- Dépendances installées avec npm install

Ces outils suffisent pour compiler GTPL, vérifier les templates, générer les projets et exécuter les tests TypeScript.

### Extension GNOME Shell

- GNOME Shell 51 et GJS compatibles
- Bibliothèques GNOME fournies par l'environnement Shell
- gnome-extensions pour empaqueter l'extension
- zip et unzip pour vérifier l'archive
- Une session GNOME réelle pour valider le comportement utilisateur

Le harness CI GNOME nécessite également D-Bus et un serveur X virtuel. Les tests GTK ne remplacent pas un essai dans une session GNOME Shell 51.

### Préférences GTK4/libadwaita

- GJS
- GTK4 et libadwaita
- Introspections GObject correspondantes
- Xvfb pour les smoke tests sans écran physique

Les préférences s'exécutent dans un processus distinct de l'extension. Gardez leurs imports et leur cycle de vie séparés.

### Application Node-GTK

- Node.js 22 ou plus récent
- node-gtk 4
- GTK4, libadwaita et leurs bibliothèques natives
- Outils de compilation et d'introspection requis par node-gtk sur la plateforme

L'application générée démarre avec node --import node-gtk/register. Elle n'est pas une extension GNOME Shell et ne peut pas importer les API privées du Shell.

## Commandes de validation

Depuis un projet généré :

```sh
npm install
gef build
gef test
gef doctor
```

Pour une extension, empaquetez puis testez dans une session GNOME Shell 51 :

```sh
gef package
gef ego-check dist/extension
```

Pour une application Node-GTK :

```sh
npm start
gef package
```

Dans le dépôt GEF :

```sh
npm run check
npm run build
npm run test:gtk
npm run test:node-gtk:availability
npm run test:kitchen-sink
```

La CI exécute aussi des contrôles de packaging natifs sur Linux, Windows et macOS. Un test de packaging sur une plateforme ne valide pas les dépendances ou le comportement natif d'une autre plateforme.

## Limites actuelles

- GEF cible GNOME Shell 51 pour ses extensions. La compatibilité avec d'autres versions n'est pas garantie.
- Les runtimes GJS et Node-GTK ne sont pas interchangeables.
- Les composants disponibles dépendent des widgets exposés par le renderer natif. Une API commune ne garantit pas que chaque propriété ou widget existe sur chaque plateforme.
- GTPL génère des fonctions de rendu ; il ne fournit ni DOM, ni navigateur, ni moteur HTML.
- Le layout Flex avancé (wrap, grow, shrink et justification) est disponible dans le calculateur TypeScript indépendant. Les renderers natifs GTK `Gtk.Box` et GNOME Shell `St.BoxLayout` ne fournissent pas le retour à la ligne ni les poids `grow` ; GTPL rejette désormais explicitement ces options au lieu de les transmettre silencieusement aux widgets. Utiliser `Grid` pour organiser les lignes ou `expand="true"` pour une expansion native booléenne.
- Le packaging doit être exécuté sur le système cible. Le bundle macOS n'est pas signé ni notarié.
- Les smoke tests automatisés vérifient des chemins représentatifs, pas toutes les configurations de bureau, tous les thèmes ou toutes les extensions tierces.

## Avant distribution

1. Vérifiez les versions de GNOME Shell et les bibliothèques natives ciblées.
2. Lisez et comprenez le JavaScript généré et les scripts de packaging.
3. Testez activation, désactivation et réactivation dans une session Shell réelle.
4. Vérifiez que chaque signal, timer, acteur, abonnement et effet réactif possède un nettoyage.
5. Testez l'application Node-GTK et son bundle sur chaque système visé.
6. Ne présentez pas les résultats CI comme une certification générale ou une approbation EGO.
