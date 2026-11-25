# Roadmap GEF

Cette roadmap présente les priorités du framework. Les cases cochées correspondent aux fonctionnalités implémentées ; leur validation dépend des tests et de la CI concernés.

**Statut : alpha.** Les API et le périmètre peuvent encore évoluer.

## P0 — Stabilisation

- [x] Corriger les erreurs de parsing TypeScript/ESLint dans le générateur CLI (commit `954c7a9`).
- [x] Ajouter une régression qui vérifie la syntaxe des sources du squelette généré (tests CLI, CI `45382171668`).
- [x] Obtenir une CI entièrement verte sur Linux, GTK4/libadwaita, Windows et macOS (commit `b1f2513`, run `45381718868`, quatre jobs réussis).
- [ ] Ajouter des tests de génération exécutant réellement les projets créés. Le smoke test CLI couvre les deux squelettes ; un test GTK4/Node-GTK construit maintenant une application générée, charge son composant décoré et son template compilé, puis vérifie son libellé natif GTK. Le lancement complet du point d'entrée et l'exécution native du squelette d'extension GNOME restent à couvrir.
- [x] Conserver une séparation stricte entre le runtime GNOME Shell (GJS) et le runtime desktop (Node-GTK).

## P1 — Génération de projets Angular-like

- [x] Introduire un squelette d'application desktop avec `src/app/` et un composant racine décoré.
- [x] Générer `app.config.ts`, le template GTPL et les répertoires de base.
- [x] Aligner le squelette d'extension GNOME sur l'organisation `src/` avec un adaptateur `src/extension.ts` décoré et limité aux API GJS (commit `421d354`).
- [x] Finaliser le bootstrap et la destruction du composant racine sur GTK et GJS via `mountDecoratedComponent()` (commits `421d354` à `b1f2513`).
- [x] Documenter et tester les commandes de création pour application et extension, y compris la syntaxe TypeScript des squelettes générés (CI `45381718868`).
- [ ] Ajouter la configuration de routes uniquement lorsqu'un routeur fonctionnel existe (différé : aucun routeur fonctionnel n'est encore fourni).

## P2 — Architecture des composants décorés

- [x] Déclarer les composants avec `@Component` et les métadonnées associées.
- [x] Prendre en charge les entrées `@Input` et sorties `@Output` avec `EventEmitter`.
- [x] Gérer les bindings réactifs et la destruction des abonnements du composant.
- [x] Fournir les décorateurs `@Directive`, `@Pipe`, `@HostBinding` et `@HostListener`.
- [x] Enregistrer composants, directives et pipes avec leurs registres dédiés.
- [x] Réduire les inscriptions/fabriques manuelles redondantes : `ComponentRegistry.registerType()` instancie les classes décorées ; bootstrap et registres UI/Kitchen Sink migrés (commit `bf98182`).
- [x] Ajouter des tests d'intégration couvrant le montage, les entrées et la destruction de composants décorés imbriqués (commit `5587904`, CI `45398852767`).

## P3 — Compilateur GTPL et runtime

- [x] Compiler les templates GTPL et leurs expressions.
- [x] Prendre en charge les bindings, événements et valeurs réactives documentés.
- [x] Fournir des diagnostics avec fichier, ligne et colonne.
- [ ] Rendre les déclarations `@let` réactives : recalculer leur expression lorsque ses dépendances changent, conserver leur portée lexicale et permettre aux déclarations suivantes de lire les précédentes. Tester les mises à jour de signaux, les déclarations imbriquées dans les blocs, les utilisations dans les bindings et les gestionnaires d'événements.
- [x] Gérer le cycle de vie et le nettoyage des ressources natives.
- [ ] Uniformiser les comportements des renderers GTK et GJS sans mélanger leurs API.
- [ ] Mesurer et réduire les mises à jour et allocations inutiles.
- [ ] Refactoriser `@for` pour réconcilier les clés avant de créer les nouveaux nœuds. Une vue conservée doit actualiser `item`, `$index`, `$count`, `$first`/`$last`/`$even`/`$odd`, les alias et les `@let` qui en dépendent ; les bindings réactifs, branches imbriquées et boucles imbriquées doivent relire ce contexte. Limiter les opérations natives aux vrais changements. Tester GTK et GJS : objet remplacé sous clé stable, réordonnancement, insertion/suppression, clés dupliquées, `@empty` et échec d'attachement.
- [ ] Mettre en cache les résultats des pipes purs par site d'expression GTPL, et non uniquement par nom de pipe ; couvrir deux usages simultanés du même pipe avec des arguments différents.
- [ ] Étudier la mémorisation des expressions GTPL pures par site d'appel ; ne l'ajouter qu'avec une mesure démontrant des recalculs coûteux.
- [ ] Étudier une compilation incrémentale fondée sur les dépendances fichier/template, uniquement après ajout de mesures de performance et d'invalidation fiable.
- [x] Éviter les écritures natives répétées lorsqu'un binding réactif conserve la même valeur primitive (GTK et GJS).
- [x] Vérifier que les bindings ignorent les valeurs identiques sans bloquer l'application des valeurs modifiées (GTK et GJS, CI `45403392586`).
- [x] Éviter de réappliquer les styles natifs lorsque le CSS calculé reste identique sur les composants décorés (GTK et GJS, CI `45404667970`).
- [x] Éviter les chargements CSS natifs répétés pour un style GTPL inchangé sur les widgets (GTK et GJS), et supprimer la double synchronisation initiale GTK (CI `45406958046`).
- [x] Ajouter des régressions vérifiant qu'un binding de classe ou de style ne déclenche qu'une synchronisation initiale (GTK et GJS, CI `45401361924`).
- [x] Éviter les doubles lectures initiales des bindings de classe et de style sur les widgets GJS (test de régression, CI `45405662173`).

## P4 — Bibliothèque UI

- [x] Ajouter une API UI publique via `gnome-extension-framework/ui`.
- [x] Fournir les registres natifs GTK et GNOME Shell : `createGtkUiRegistry()` et `createStUiRegistry()`.
- [x] Ajouter les composants `GefButton`, `GefLabel`, `GefIcon`, `GefInput`, `GefCheckbox`, `GefSwitch` et `GefProgressBar`.
- [x] Relier les propriétés et événements des composants aux widgets natifs.
- [x] Ajouter les conteneurs GTPL `Flex` et `Grid`.
- [x] Ajouter les conteneurs `HeaderBar` et `Sidebar` avec rendu adapté à chaque plateforme.
- [x] Ajouter les utilitaires responsive : breakpoints, résolution de valeurs, `BreakpointObserver`, `FlexLayout` et `GridLayout`.
- [x] Préserver les dimensions transverses explicitement nulles dans les lignes Flex avec retour à la ligne (régression `FlexLayout`, commit `96e46a1`, CI `45429239230`, tentative 2 : quatre jobs réussis).
- [x] Connecter les changements de largeur natifs aux breakpoints via `BreakpointObserver.observe(widget)` ; écoute `notify::width` et libère le signal à la désinscription.
- [ ] Étendre les options de layout GTPL : retour à la ligne, poids `grow` par enfant et justification cohérente entre GTK et St. Les renderers refusent explicitement `wrap` et `grow` non pris en charge par les widgets natifs (tests GTK/St et guide runtimes) ; `Grid` et `expand` restent les solutions natives actuelles.
- [ ] Enrichir la bibliothèque de composants uniquement selon les besoins démontrés par les exemples.

## P5 — Démonstration et documentation

- [x] Organiser le Kitchen Sink en écrans de démonstration distincts.
- [x] Écrire le shell du Kitchen Sink en TypeScript et l'intégrer au runtime GTK de GEF.
- [x] Ajouter des composants GEF réutilisables dans le Kitchen Sink (`GefSectionHeader`, `GefMetricCard`).
- [x] Fournir un accès au code GTPL de chaque démonstration.
- [x] Documenter le catalogue UI, les conteneurs, les événements et les différences entre GTK et GNOME Shell.
- [x] Simplifier le README principal et celui du Kitchen Sink.
- [ ] Simplifier les autres guides et harmoniser la documentation.
- [x] Documenter les limites et les prérequis de chaque runtime (guide docs/runtimes.md).
- [ ] Ajouter au Kitchen Sink des exemples d'applications complètes, construits avec les composants et les API publiques de GEF :
  - [ ] Liste de tâches : création, modification, suppression, filtres et état terminé.
  - [ ] Gestionnaire de notes : liste, recherche, édition et sauvegarde locale.
  - [ ] Calculatrice : opérations de base, affichage et gestion des erreurs de saisie.
  - [ ] Éditeur de texte : édition, ouverture/enregistrement de fichiers et état modifié.
  - [ ] Gestionnaire de recettes : catalogue, recherche, détails, ingrédients et étapes.
  - [ ] Ajouter d'autres exemples ciblés selon les composants et besoins démontrés (par exemple gestionnaire de favoris, suivi de dépenses ou carnet d'adresses).
  - [ ] Pour chaque exemple, fournir une interface utilisable, des données de démonstration et l'accès au code TypeScript/GTPL correspondant.
  - [ ] Garder les exemples indépendants et simples à parcourir depuis la navigation du Kitchen Sink.

## P6 — CLI et distribution

- [ ] Fiabiliser `gef new` et ses tests de bout en bout.
  Parsing strict des arguments et tests de rejet ajoutés ; la génération et compilation des deux squelettes restent couvertes par les tests E2E existants.
- [ ] Introduire un plan de génération commun à `gef new` et `gef generate` : préparer les fichiers en mémoire, vérifier les chemins (dont les sorties hors du répertoire cible), les collisions et les fichiers existants, puis seulement écrire. Cette prévalidation évite les générations partielles dues aux erreurs de validation/conflits ; une panne d'E/S pendant l'écriture nécessitera un rollback explicite si une atomicité réelle devient nécessaire.
- [ ] Ajouter `--dry-run` et `--force` au plan de génération ; par défaut, refuser les fichiers existants sans les écraser.
- [ ] Extraire progressivement commandes et générateurs de `packages/cli/src/index.ts` vers des sous-répertoires dédiés, sans changer les commandes publiques ni introduire de framework de commandes.
- [ ] Centraliser la validation des options des générateurs ; adopter des schémas déclaratifs simples uniquement lorsque plusieurs options le justifient.
- [ ] Préserver les commentaires et le format de `gef.json` lors de futures modifications automatiques du workspace ; JSONC différé tant que la CLI ne modifie pas cette configuration.
- [ ] Concevoir les migrations de workspace seulement lorsqu'un changement réel de format ou d'API nécessitera une migration ; prévoir ordre déterministe, vérification préalable et échec explicite.
- [ ] Garder les commandes de build/test/package/watch comme des tâches simples ; ne pas introduire Architect, RxJS ou un système de builders générique sans besoin concret.
- [x] Vérifier `gef generate component` : import des décorateurs, sélecteur kebab-case, template lié, syntaxe TypeScript et compilation du render module (test E2E, commit `b00c478`, CI `45436563175`, quatre jobs réussis).
- [x] Générer des sélecteurs de composants en kebab-case à partir des noms PascalCase (CI `45409017580`).
- [x] Générer les fichiers TypeScript et GTPL des composants en kebab-case, conformément aux conventions Angular (CI `45410666986`, tentative 2 : quatre jobs réussis).
- [x] Ajouter les générateurs directive, service et pipe avec tests E2E TypeScript (commit `953d9de`, CI `45418969015`, quatre jobs réussis).
- [x] Améliorer la validation de configuration et les messages d'erreur.
  Validation stricte de `gef.json` et tests des cas invalides ajoutés ; fixture de packaging réaligné sur le schéma requis (CI `45434415606`, quatre jobs réussis).
- [ ] Vérifier les packages npm et les distributions autonomes sur leurs plateformes natives.
- [ ] Définir les critères de sortie de l'alpha et préparer une version stable.

## Résultats du scan Angular et Angular CLI

Les scans du runtime Angular, du compilateur et d'Angular CLI servent de références de conception, pas de dépendances à intégrer. Les points déjà couverts par GEF (comparaison des bindings inchangés, nettoyage des ressources, diagnostics GTPL et validation de configuration) ne sont pas à réimplémenter. Les pistes retenues sont la réconciliation des listes par clé, le cache des pipes par site d'expression et la génération CLI préparée avant écriture. Les mécanismes plus lourds d'Angular (LView, Architect, Schematics/DevKit, RxJS, graphe incrémental complet) ne doivent pas être portés tels quels : toute adaptation doit rester locale, mesurée et KISS.

Le scan complémentaire d'Angular CLI confirme plusieurs idées ciblées : `ng generate` construit ses commandes et options à partir des schémas des générateurs, puis compose des filtres et des transformations de templates ; GEF peut reprendre la validation stricte, les valeurs par défaut et les alias sans adopter le moteur Schematics. Le `RecordHost` d'Angular prépare les opérations dans un arbre mémoire, mais son commit applique ensuite les écritures séquentiellement : ce n'est pas une transaction résistante aux pannes d'E/S. Le plan de génération GEF doit donc distinguer prévalidation et atomicité réelle. `ng update` vérifie par défaut la propreté du dépôt et encadre les migrations ; ces garde-fous sont pertinents si GEF introduit un jour des migrations de workspace. Enfin, `JSONFile` préserve commentaires et format via des modifications minimales de l'AST ; cela reste différé tant que GEF ne modifie pas automatiquement `gef.json`.

Le scan des commandes `ng new`, `ng add`, `ng build`, `ng serve` et `ng test` montre une séparation nette entre modules de commande minces et exécution partagée. `ng add` utilise un plan de tâches et son mode `dry-run` évite les installations et actions effectives ; GEF peut reprendre cette séparation plan/exécution et afficher les fichiers qui seraient créés, sans adopter Listr, Architect ou RxJS. Les modules build/serve/test sont essentiellement des déclarations de cibles au-dessus d'Architect : cela ne justifie pas un système de builders générique dans GEF.

Côté runtime Angular, les hooks de cycle de vie sont enregistrés par phase afin de préserver leur ordre, et les listeners natifs d'un même événement sur un même hôte de directive peuvent être regroupés pour éviter plusieurs inscriptions. GEF possède déjà un cycle simple `onInit`/`onDestroy` et un nettoyage centralisé via `ResourceScope`. Les connexions de signaux GTK et GJS ont des coûts et sémantiques différents des listeners DOM/NgZone d'Angular ; ne pas reproduire le regroupement Angular sans mesure ou besoin concret.

Le scan approfondi de `@for` a révélé un problème de correction en plus de la performance : le runtime GEF rend actuellement chaque nouvel élément avant que le renderer retrouve les clés déjà présentes. Pour une clé stable, le renderer détruit ensuite le nouveau nœud et conserve l'ancien. Si l'objet associé à cette clé a changé, les bindings peuvent continuer à capturer l'ancien objet ; l'index et le nombre d'éléments peuvent aussi être périmés après réordonnancement. La réconciliation doit actualiser le contexte des vues conservées, pas seulement préserver leur identité native.

Le scan du code Angular `@let` confirme que ces déclarations ne sont pas des constantes de compilation : le compilateur réserve un emplacement de vue (`declareLet`), écrit leur valeur dans la passe de mise à jour (`storeLet`) et lit les déclarations parentales via `readContextLet`. GEF émet aujourd'hui `const name = expression` dans le rendu initial ; une expression dépendant d'un signal n'est donc pas recalculée. Ce défaut existe indépendamment de `@for` et mérite une tâche dédiée. Une adaptation GEF doit préserver les portées lexicales sans reproduire le stockage `LView` d'Angular. Le compilateur GEF émet maintenant des getters locaux pour les déclarations `@let` : leurs expressions sont relues à chaque accès depuis un binding ou un gestionnaire d'événement, et les déclarations suivantes peuvent référencer les précédentes. La validation par CI de ce premier correctif reste en attente.

Le scan du code Angular `LiveCollection` confirme deux opérations distinctes : `updateValue(index, value)` actualise la valeur de l'élément conservé, tandis que `updateIndexes()` ne recalcule les index qu'après les insertions/suppressions/déplacements qui le nécessitent. Angular combine des comparaisons aux deux extrémités et un chemin de repli pour limiter les mouvements ; GEF ne doit pas copier cet algorithme complet avant d'avoir des mesures. Pour GEF, le point délicat est la réactivité : modifier des variables capturées ne relance pas les effets déjà créés. Le futur contexte de ligne doit donc invalider les bindings concernés, y compris dans les `@if`, `@switch` et `@for` imbriqués. Les déclarations `@let` sont actuellement émises comme des `const` locales calculées une seule fois ; leur actualisation doit être conçue explicitement, sinon elles resteront périmées malgré la mise à jour de `item`. Conserver également le comportement GEF actuel de rejet explicite des clés dupliquées.

## Règles de maintenance

Après chaque modification fonctionnelle ou corrective :

1. Mettre à jour cette roadmap : cocher uniquement ce qui est réellement terminé et ajouter les tâches découvertes.
2. Faire une passe de refactoring KISS sur le code modifié.
3. Exécuter les tests et contrôles pertinents.
4. Pousser sur `main`, puis vérifier la CI du commit exact avant de déclarer le travail terminé.

Ne pas présenter une tâche comme terminée si sa validation échoue ou reste en cours.
