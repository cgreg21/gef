# Roadmap GEF

Cette roadmap présente les priorités du framework. Les cases cochées correspondent aux fonctionnalités implémentées ; leur validation dépend des tests et de la CI concernés.

**Statut : alpha.** Les API et le périmètre peuvent encore évoluer.

## P0 — Stabilisation

- [x] Corriger les erreurs de parsing TypeScript/ESLint dans le générateur CLI (commit `954c7a9`).
- [x] Ajouter une régression qui vérifie la syntaxe des sources du squelette généré (tests CLI, CI `45382171668`).
- [x] Obtenir une CI entièrement verte sur Linux, GTK4/libadwaita, Windows et macOS (commit `b1f2513`, run `45381718868`, quatre jobs réussis).
- [x] Tester les projets générés en conditions réelles : le squelette GTK4 est construit et exécuté dans le smoke test Node-GTK ; le squelette GNOME Shell est compilé avec le vrai `tsc`, empaqueté, installé dans Fedora 45 / GNOME Shell 51, puis activé et désactivé deux fois. Smoke tests GJS, tests unitaires, packaging et intégration GTK validés sur le commit `51304d8`, CI [45898877575](https://github.com/cgreg21/gef/actions/runs/45898877575).
- [x] Conserver une séparation stricte entre le runtime GNOME Shell (GJS) et le runtime desktop (Node-GTK).

## P1 — Génération de projets Angular-like

- [x] Introduire un squelette d'application desktop avec `src/app/` et un composant racine décoré.
- [x] Générer `app.config.ts`, le template GTPL et les répertoires de base.
- [x] Aligner le squelette d'extension GNOME sur l'organisation `src/` avec un adaptateur `src/extension.ts` décoré et limité aux API GJS (commit `421d354`).
- [x] Finaliser le bootstrap et la destruction du composant racine sur GTK et GJS via `mountDecoratedComponent()` (commits `421d354` à `b1f2513`).
- [x] Documenter et tester les commandes de création pour application et extension, y compris la syntaxe TypeScript des squelettes générés (CI `45381718868`).
- [x] Ajouter un premier routeur commun GTK/GJS : routes déclaratives, priorité aux chemins statiques, paramètres dynamiques, query params, fragment, wildcard, navigation, historique mémoire avant/arrière, liens et `RouterOutlet` GTPL. Tests unitaires sur le matching, l'historique, les erreurs et le rendu. Le lazy-loading, les gardes asynchrones, les redirections et les stratégies d'URL externes restent différés.
- [x] Intégrer le routeur dans le Kitchen Sink GTK : chaque démonstration possède une URL interne, la sélection synchronise l'écran et le titre, les commandes **Back**/**Forward** suivent l'état de l'historique, et les navigations sont testées dans le smoke test Node-GTK.
- [x] Connecter le routeur au bootstrap des applications générées GTK et GJS : `app.config.ts` déclare les routes et l'URL initiale, `createApplicationRouter()` fournit la vue racine par défaut, `renderRouterOutlet()` monte la route active, et le bootstrap détruit l'outlet avec ses ressources. Les routes peuvent fournir leur propre renderer.
- [x] Ajouter des gardes synchrones `canActivate` par route : navigation directe, URL initiale et historique arrière/avant respectent la garde ; une navigation refusée ne modifie ni l'URL active ni l'historique. Les gardes synchrones `canDeactivate` protègent aussi la sortie d'une route et sont appliquées à la navigation directe et à l'historique. Les gardes asynchrones et redirections restent différées.
- [x] Connecter `[routerLink]` aux événements natifs `clicked` des widgets GTK et St : l'URL peut être réactive, les liens sont retirés des propriétés envoyées au constructeur natif et l'écouteur est libéré à la destruction du nœud. Le lien fonctionne dans un template rendu sous `RouterOutlet` ; il accepte `null` pour désactiver la navigation. La documentation GTPL décrit les valeurs réactives, les contraintes d'événement natif et le besoin d'un outlet.
- [x] Durcir le parsing et la validation du routeur : refuser les URL absolues/protocol-relative, normaliser les erreurs de fragments encodés et interdire query/fragment dans les motifs de route ; couvrir ces cas et les cibles `routerLink` réactives par des tests.
- [x] Compléter la validation des chemins du routeur : normaliser les segments statiques encodés, refuser les séparateurs et segments `.`/`..` encodés ou non, valider les séquences `%` des query params et vérifier la génération compilée de `[routerLink]`. Une régression `%5C` couvre également le rejet des séparateurs antislash encodés.

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
- [x] Rendre les déclarations `@let` réactives : getters lexicaux recalculés à chaque lecture dans les bindings, interpolations et gestionnaires d'événements ; déclarations chaînées et portées imbriquées couvertes (commit `4d4c2107`, CI `45579719593`, quatre jobs réussis).
- [x] Gérer le cycle de vie et le nettoyage des ressources natives.
- [ ] Uniformiser les comportements des renderers GTK et GJS sans mélanger leurs API.
- [x] Refuser explicitement un `@for` St lorsque son conteneur ne fournit pas les API natives d'ajout/suppression d'enfants, au lieu de réussir silencieusement sans afficher les lignes ; test de régression aligné sur le contrat strict du renderer GTK.
- [x] Aligner le rollback des branches conditionnelles et `switch` : si l'attachement natif St échoue, détruire le nœud rendu avant de propager l'erreur ; tests de parité ciblés ajoutés côté GNOME Shell.
- [x] Refuser les conteneurs St sans `set_child` pour les blocs conditionnels et `switch`, détruire le nœud préparé et lever une erreur explicite plutôt que de signaler un rendu réussi sans attachement.
- [x] Refuser une réconciliation `@for` incrémentale St qui doit supprimer des acteurs lorsque le conteneur ne fournit pas `remove_child`, au lieu de mettre à jour silencieusement l'ordre logique sans retirer l'acteur natif ; test de régression vérifiant que la liste montée reste intacte.
- [x] Couvrir la parité GTK pour une suppression `@for` incrémentale sans API native de retrait : l'erreur est explicite et le test vérifie que l'enfant déjà monté reste attaché.
- [x] Couvrir aussi le chemin de repli `@for` St sans API d'insertion/réordonnancement : l'absence de `remove_child` est refusée avant le détachement des lignes déjà montées, avec un test qui vérifie la conservation de la liste.
- [x] Vérifier la réconciliation réussie des lignes `@for` via les API de repli GTK et St : l'ordre final est correct, les lignes conservées restent montées et les lignes retirées sont nettoyées.
- [x] Effectuer les insertions et déplacements `@for` GTK/St avant de retirer les anciennes lignes ; un échec d'insertion ne doit pas détacher les lignes qui auraient été supprimées, avec tests de régression sur les deux renderers.
- [x] Restaurer l'état natif des lignes `@for` GTK/St si une insertion incrémentale ultérieure échoue : retirer les nouvelles lignes déjà insérées et rétablir l'ordre précédent, avec une régression où la deuxième insertion échoue sur chaque renderer. La prévalidation du retrait n'est requise que lorsqu'un rollback partiel peut être nécessaire ; un montage initial simple reste compatible avec les conteneurs sans API de retrait.
- [x] Rendre transactionnel le chemin de repli GTK/St de `@for` : si l'ajout d'une ligne échoue, retirer les nouvelles lignes déjà ajoutées et remonter les anciennes, avec tests de régression des deux renderers.
- [x] Vérifier le précontrôle des API d'ajout dans le chemin de repli `@for` St : une API absente provoque une erreur avant le détachement des acteurs montés et le nouvel acteur préparé est détruit, en parité avec GTK.
- [x] Couvrir la destruction d'une liste `@for` St : la destruction du conteneur détruit ses acteurs enfants une seule fois et libère leurs connexions de signaux, en parité avec le test GTK (commit `0892ace`, CI `45972096117`).
- [x] Couvrir le rollback des lignes `@for` St conservées lorsqu'un nouvel acteur ne peut pas être attaché : les valeurs/index sont restaurés, la ligne montée reste intacte et le nouvel acteur est détruit, en parité avec GTK.
- [x] Couvrir le même rollback pour GTK : si l'insertion d'une nouvelle ligne échoue, les bindings de la ligne conservée retrouvent leur valeur précédente et le nouveau widget est nettoyé.
- [x] Prévalider les capacités d'ajout et de suppression dans le chemin de repli `@for` GTK avant de détacher les enfants existants ; le comportement rejoint le contrôle préalable du renderer St et un test vérifie que la liste montée reste intacte si l'ajout est impossible.
- [x] Simplifier la détection des API natives dans le chemin de repli `@for` GTK avec des vérifications directes, sans tableau de noms ni cast dynamique ; la prévalidation et ses erreurs restent inchangées.
- [x] Couvrir aussi l'échec du détachement de l'ancienne branche `@if`/`switch` : le nouveau nœud est détruit et l'ancienne branche reste cohérente ; le test vérifie le rollback avec des acteurs distincts pour les deux branches.
- [x] Préserver la branche précédente lors d'un échec d'attachement de remplacement `@if`/`switch` : GTK monte la nouvelle branche avant de retirer l'ancienne ; St restaure l'ancienne si le nouvel acteur ne peut pas être attaché. Tests de régression GTK et St pour les deux structures.
- [x] Ignorer les remplacements `@if`/`switch` lorsque le renderer sélectionne exactement le même widget/acteur : évite de réattacher puis détruire une branche déjà montée ; tests GTK et St pour les deux structures, y compris lorsque le signal change de valeur sans changer l'identité du rendu.
- [ ] Mesurer et réduire les mises à jour et allocations inutiles.
- [x] Réutiliser deux ensembles de classes dans les bindings réactifs GTK et St au lieu d'allouer un nouvel ensemble à chaque synchronisation ; les tests existants couvrent les classes statiques, les maps réactives et les classes individuelles.
- [x] Refactoriser `@for` pour réconcilier les clés avant de créer les nouveaux nœuds. Descriptors paresseux, rejet des clés dupliquées avant rendu, mise à jour des valeurs/index/alias/`@let` des vues conservées et invalidation des bindings, y compris dans les blocs imbriqués. GTK/GJS évitent les détachements/rattachements lorsque l'ordre est inchangé ; en cas de changement, la réconciliation native incrémentale cible les lignes supprimées, insère après le frère précédent avec GTK4 et déplace par index avec Clutter/St. Tests GTK/GJS couvrant le déplacement d'une ligne sans détachement des autres. Validation complète : commit `4dcbede`, CI `45592216393`, quatre jobs réussis (lint, typecheck, tests, build, packaging, GTK/GJS, Windows et macOS).
- [x] Mettre en cache les résultats des pipes purs par site d'expression GTPL, avec un jeton propre à chaque template, des identifiants source distincts et une `WeakMap` pour ne pas retenir les templates détruits. Les tests couvrent plusieurs sites d'un même pipe, des arguments différents et les pipes impurs (commit `7b31186`, CI [45900746768](https://github.com/cgreg21/gef/actions/runs/45900746768)).
- [x] Ajouter un benchmark reproductible sans dépendance pour les abonnements de signaux, les effets réactifs (dépendances fixes et dynamiques), les valeurs calculées, l'analyse GTPL, l'émission de code et l'émission d'expressions avec/sans identifiants de contexte et comparaison des tableaux/ensembles réutilisables et réutilisation de l'ensemble des identifiants collectés par expression, sans second `Set`. Le script affiche médianes et débit sur la machine courante ; la CI publie les mesures comme diagnostic sans seuil fragile ni échec lié au matériel. Utiliser ces bases avant toute optimisation des expressions.
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
- [x] Compléter `GefInput` avec `placeholder` et `disabled`, synchronisés vers `Gtk.Entry` et `St.Entry` avec tests des bindings réactifs sur les deux plateformes.
- [x] Documenter les composants UI déjà exportés et rendus par les deux registres : PasswordInput, SearchInput, TextArea, Select et Slider. Décrire leurs entrées/sorties, limites et widgets natifs ; corriger le tableau de compatibilité de ProgressBar.
- [x] Utiliser les composants UI GEF dans les démonstrations Actions, Forms et Preferences : boutons GEF dans Actions, champs et boutons GEF dans Forms, puis libellés, interrupteurs et cases à cocher GEF dans Preferences. Les propriétés booléennes utilisent les bindings GTPL typés (`[active]`, `[checked]`) ; les cases à cocher restent volontairement sans API de libellé et leurs textes sont composés avec `GefLabel`. Seul le champ numérique reste natif faute de composant dédié. Le smoke test Node-GTK monte les cinq écrans avec le registre complet.

## P5 — Démonstration et documentation

- [x] Organiser le Kitchen Sink en écrans de démonstration distincts.
- [x] Écrire le shell du Kitchen Sink en TypeScript et l'intégrer au runtime GTK de GEF.
- [x] Ajouter des composants GEF réutilisables dans le Kitchen Sink (`GefSectionHeader`, `GefMetricCard`) et intégrer les composants UI publics dans le formulaire Forms.
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

- [x] Fiabiliser `gef new` et ses tests de bout en bout : parsing strict des arguments avec tests de rejet avant toute écriture, génération et vérification syntaxique TypeScript des deux squelettes ; le squelette GTK est également construit et exécuté dans le smoke test Node-GTK, et l'extension passe la compilation TypeScript et `gef ego-check`.
  Parsing strict des arguments et tests de rejet ajoutés ; la génération et compilation des deux squelettes restent couvertes par les tests E2E existants.
- [x] Vérifier les contrats du cycle de vie dans le squelette d'extension GNOME généré : enregistrement des ressources, ordre de nettoyage et rollback en cas d'erreur sont couverts par les tests E2E ; `ResourceScope` possède ses tests unitaires. L'installation réelle et deux cycles `enable()`/`disable()` sont également validés dans GNOME Shell 51 (CI `45898877575`).
- [x] Introduire un plan de génération commun à `gef new` et `gef generate` : les deux commandes préparent leurs fichiers en mémoire, puis le module `src/generation/plan.ts` vérifie les chemins et collisions avant toute création de dossier ou écriture. `--dry-run` affiche le plan sans effet de bord ; `--force` autorise explicitement le remplacement. Les tests CLI couvrent les deux commandes et les cas collision/dry-run/force. Une panne d'E/S pendant l'écriture nécessitera un rollback explicite si une atomicité réelle devient nécessaire.
- [x] Ajouter `--dry-run` et `--force` à `gef new` et `gef generate` : aperçu sans écriture, refus des collisions par défaut et écrasement explicite avec `--force` (tests unitaires dédiés).
- [x] Extraire les commandes et générateurs de `packages/cli/src/index.ts` vers des sous-répertoires dédiés, sans framework de commandes. `index.ts` conserve l'adaptateur d'E/S, l'aide et le dispatch ; les commandes, diagnostics et plans de génération résident dans `src/commands/`, `src/validation.ts` et `src/generation/plan.ts`. Tests CLI et CI Linux/GTK validés.
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

Le scan approfondi de `@for` a révélé un problème de correction en plus de la performance : le runtime GEF rendait chaque nouvel élément avant que le renderer retrouve les clés déjà présentes. Cette première passe déplace le rendu des nouvelles lignes dans des callbacks paresseux et donne aux vues conservées un mécanisme local d'actualisation du contexte. Les scénarios natifs et d'échec sont couverts par les tests GTK/GJS ; la CI complète a validé cette étape (commit `4dcbede`, run `45592216393`).

Le scan du code Angular `@let` confirme que ces déclarations ne sont pas des constantes de compilation : le compilateur réserve un emplacement de vue (`declareLet`), écrit leur valeur dans la passe de mise à jour (`storeLet`) et lit les déclarations parentales via `readContextLet`. GEF émet aujourd'hui `const name = expression` dans le rendu initial ; une expression dépendant d'un signal n'est donc pas recalculée. Ce défaut existe indépendamment de `@for` et mérite une tâche dédiée. Une adaptation GEF doit préserver les portées lexicales sans reproduire le stockage `LView` d'Angular. Le compilateur GEF émet maintenant des getters locaux pour les déclarations `@let` : leurs expressions sont relues à chaque accès depuis un binding ou un gestionnaire d'événement, et les déclarations suivantes peuvent référencer les précédentes. Les premiers passages CI ont relevé une règle ESLint, des incompatibilités TypeScript et deux régressions de test : une assertion qui supposait à tort une interpolation absente, et des espaces de mise en forme conservés autour d'un template contenant `@let`. Le générateur traite désormais les déclarations `@let` comme transparentes lors de la détection des conteneurs d'éléments ; la CI complète doit valider ce correctif.

Le scan du code Angular `LiveCollection` confirme deux opérations distinctes : `updateValue(index, value)` actualise la valeur de l'élément conservé, tandis que `updateIndexes()` ne recalcule les index qu'après les insertions/suppressions/déplacements qui le nécessitent. Angular combine des comparaisons aux deux extrémités et un chemin de repli pour limiter les mouvements ; GEF ne doit pas copier cet algorithme complet avant d'avoir des mesures. Pour GEF, le point délicat est la réactivité : modifier des variables capturées ne relance pas les effets déjà créés. Le futur contexte de ligne doit donc invalider les bindings concernés, y compris dans les `@if`, `@switch` et `@for` imbriqués. Les déclarations `@let` sont maintenant émises comme des getters lexicaux réactifs ; dans une ligne `@for`, elles doivent être recalculées à la lecture après invalidation du contexte de ligne. Conserver également le comportement GEF actuel de rejet explicite des clés dupliquées.

## Règles de maintenance

Après chaque modification fonctionnelle ou corrective :

1. Mettre à jour cette roadmap : cocher uniquement ce qui est réellement terminé et ajouter les tâches découvertes.
2. Faire une passe de refactoring KISS sur le code modifié.
3. Exécuter les tests et contrôles pertinents.
4. Pousser sur `main`, puis vérifier la CI du commit exact avant de déclarer le travail terminé.

Ne pas présenter une tâche comme terminée si sa validation échoue ou reste en cours.


## Validation end-to-end GNOME Shell 51

Le job GNOME utilise Fedora 45 avec systemd, Mutter devkit et GNOME Shell 51. Il compile le squelette généré avec TypeScript, construit l'archive EGO, l'installe avant le démarrage du shell, puis vérifie deux cycles d'activation/désactivation et les smoke tests GJS. La CI complète a validé cette chaîne sur le commit `51304d8` (run `45898877575`). Les détails des investigations historiques sont conservés dans l'historique Git plutôt que dans cette roadmap.


## P7 — TypeScript vers natif

- [x] Ajouter une API de compilation de projet TypeScript fondée sur le compilateur officiel : lecture de `tsconfig.json`, vérification sémantique, émission JavaScript et source maps, refus d'émission en présence d'erreurs. Tests de compilation réussie, diagnostic de type et configuration absente.
- [x] Ajouter la commande CLI `gef compile-ts` avec sélection de tsconfig, surcharge du dossier de sortie et diagnostics TypeScript ; tests CLI dédiés.
- [x] Intégrer `gef compile-ts` aux commandes de build des deux squelettes `gef new` (application GTK et extension GNOME Shell) ; les tests E2E compilent réellement les projets générés via le frontend GEF.
- [x] Introduire une première IR UI indépendante des runtimes GTK/GJS : éléments, propriétés, événements, références, texte, déclarations locales et contrôle de flux GTPL. Les expressions restent des AST, les templates invalides ne produisent pas d'IR partielle ; tests de structure et diagnostics.
- [x] Définir le premier contrat de liaison entre composants TypeScript décorés et UI IR : `compileGtplComponentToUiIr()` résout les sélecteurs, entrées et sorties depuis `@Component` / `@Input` / `@Output`, valide les templates et refuse les registres ambigus ; tests de liaison et de diagnostics ajoutés. La découverte des champs d'instance reste explicite via `componentMembers` pour ne jamais instancier les classes pendant la compilation.
- [x] Ajouter la compilation d'un ensemble de composants avec un registre partagé : `compileGtplComponentsToUiIr()` vérifie les sélecteurs une fois, compile chaque template avec les contrats des autres composants et conserve les IR valides même si un autre template contient des diagnostics ; tests de projet, registre et échecs partiels.
- [x] Distinguer les composants GEF des éléments natifs en mode strict avec une liste `nativeElements` fournie par la cible ; les noms natifs restent hors de l'IR et aucun préfixe de nommage n'est supposé. Tests d'acceptation des éléments déclarés et de rejet des éléments inconnus.
- [x] Ajouter la découverte statique des classes `@Component` depuis les fichiers inclus par `tsconfig.json` (`discoverTypeScriptComponents`) : extraction des templates, `@Input`, `@Output` et membres d'instance via l'AST, sans importer ni instancier le code applicatif ; les métadonnées dynamiques sont signalées ; les tests couvrent les métadonnées statiques, les expressions dynamiques, l'absence de tsconfig et vérifient qu'aucun module applicatif n'est exécuté. CI Linux, GTK4/libadwaita et GNOME Shell 51 validée sur le commit `6c93fc3` (run `46060907805`).
- [x] Relier la découverte statique TypeScript à la compilation UI IR (`compileTypeScriptComponentsToUiIr`) : registre partagé, lecture des templates `templateUrl` depuis le disque (avec surcharge en mémoire), diagnostics de découverte et par composant, sans import ni instanciation des modules applicatifs. CI complète validée sur `8f66f41` (run `46061717057`).
- [ ] Évaluer le backend natif GTK et son runtime minimal ; mesurer les coûts avant de choisir LLVM ou une autre chaîne de génération.
- [ ] Conserver une cible GJS séparée : les extensions GNOME Shell doivent rester compatibles avec le runtime JavaScript de GNOME.
- [ ] Ajouter le packaging exécutable et les tests de lancement natifs par plateforme.
