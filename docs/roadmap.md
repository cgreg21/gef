# Roadmap GEF

Cette roadmap présente les priorités du framework. Les cases cochées correspondent aux fonctionnalités implémentées ; leur validation dépend des tests et de la CI concernés.

**Statut : alpha.** Les API et le périmètre peuvent encore évoluer.

## P0 — Stabilisation

- [x] Corriger les erreurs de parsing TypeScript/ESLint dans le générateur CLI (commit `954c7a9`).
- [x] Ajouter une régression qui vérifie la syntaxe des sources du squelette généré (tests CLI, CI `45382171668`).
- [x] Obtenir une CI entièrement verte sur Linux, GTK4/libadwaita, Windows et macOS (commit `b1f2513`, run `45381718868`, quatre jobs réussis).
- [ ] Ajouter des tests de génération exécutant réellement les projets créés.
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
- [x] Gérer le cycle de vie et le nettoyage des ressources natives.
- [ ] Uniformiser les comportements des renderers GTK et GJS sans mélanger leurs API.
- [ ] Mesurer et réduire les mises à jour et allocations inutiles.
- [x] Éviter les écritures natives répétées lorsqu'un binding réactif conserve la même valeur primitive (GTK et GJS).
- [x] Vérifier que les bindings ignorent les valeurs identiques sans bloquer l'application des valeurs modifiées (GTK et GJS, CI `45403392586`).
- [x] Éviter de réappliquer les styles natifs lorsque le CSS calculé reste identique sur les composants décorés (GTK et GJS, CI `45404667970`).
- [ ] Éviter les chargements CSS natifs répétés pour un style GTPL inchangé sur les widgets (GTK et GJS), et supprimer la double synchronisation initiale GTK.
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
- [ ] Connecter automatiquement les changements de taille des widgets natifs aux layouts responsive.
- [ ] Étendre les options de layout GTPL : retour à la ligne, poids `grow` par enfant et justification cohérente entre GTK et St.
- [ ] Enrichir la bibliothèque de composants uniquement selon les besoins démontrés par les exemples.

## P5 — Démonstration et documentation

- [x] Organiser le Kitchen Sink en écrans de démonstration distincts.
- [x] Écrire le shell du Kitchen Sink en TypeScript et l'intégrer au runtime GTK de GEF.
- [x] Ajouter des composants GEF réutilisables dans le Kitchen Sink (`GefSectionHeader`, `GefMetricCard`).
- [x] Fournir un accès au code GTPL de chaque démonstration.
- [x] Documenter le catalogue UI, les conteneurs, les événements et les différences entre GTK et GNOME Shell.
- [x] Simplifier le README principal et celui du Kitchen Sink.
- [ ] Simplifier les autres guides et harmoniser la documentation.
- [ ] Documenter les limites et les prérequis de chaque runtime.
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
- [ ] Compléter `gef generate component` avec imports et tests cohérents.
- [ ] Ajouter les générateurs directive, service et pipe.
- [ ] Améliorer la validation de configuration et les messages d'erreur.
- [ ] Vérifier les packages npm et les distributions autonomes sur leurs plateformes natives.
- [ ] Définir les critères de sortie de l'alpha et préparer une version stable.

## Règles de maintenance

Après chaque modification fonctionnelle ou corrective :

1. Mettre à jour cette roadmap : cocher uniquement ce qui est réellement terminé et ajouter les tâches découvertes.
2. Faire une passe de refactoring KISS sur le code modifié.
3. Exécuter les tests et contrôles pertinents.
4. Pousser sur `main`, puis vérifier la CI du commit exact avant de déclarer le travail terminé.

Ne pas présenter une tâche comme terminée si sa validation échoue ou reste en cours.
