# Roadmap GEF

Cette roadmap décrit les chantiers du framework dans leur ordre de priorité. Elle est tenue à jour avec chaque modification fonctionnelle : une tâche n'est cochée qu'après implémentation et validation par les tests/CI concernés.

**Statut du dépôt :** alpha. Les tâches ci-dessous représentent le plan de travail, pas une déclaration que les fonctionnalités sont déjà disponibles.

## P0 — Stabilisation

- [ ] Corriger les erreurs de parsing TypeScript/ESLint dans le générateur CLI.
- [ ] Obtenir une CI entièrement verte sur Linux, GTK4/libadwaita, Windows et macOS.
- [ ] Ajouter des tests de génération exécutant réellement les projets créés.
- [ ] Conserver une séparation stricte entre le runtime GNOME Shell (GJS) et le runtime desktop (Node-GTK).

## P1 — Génération de projets Angular-like

- [x] Introduire un squelette d'application desktop avec `src/app/` et un composant racine décoré.
- [x] Générer `app.config.ts`, le template GTPL et les répertoires de base.
- [ ] Aligner le squelette d'extension GNOME sur l'organisation `src/` avec un adaptateur `src/extension.ts`.
- [ ] Finaliser le bootstrap et la destruction du composant racine sur les deux cibles.
- [ ] Documenter et tester les commandes de création pour application et extension.
- [ ] Ajouter la configuration de routes uniquement lorsqu'un routeur fonctionnel existe.

## P2 — Architecture des composants décorés

- [ ] Faire de `@Component` le point d'entrée canonique de déclaration.
- [ ] Fiabiliser la découverte des métadonnées et l'instanciation des composants.
- [ ] Finaliser `@Input`, `@Output`, `@HostBinding` et `@HostListener`.
- [ ] Garantir les hooks et la destruction du cycle de vie.
- [ ] Réduire les inscriptions/fabriques manuelles redondantes.
- [ ] Ajouter des tests d'intégration couvrant des composants décorés imbriqués.

## P3 — Compilateur GTPL et runtime

- [ ] Consolider le rendu initial et les mises à jour réactives.
- [ ] Fiabiliser les bindings, événements et valeurs statiques/réactives.
- [ ] Améliorer les diagnostics avec fichier, ligne et colonne.
- [ ] Uniformiser les comportements des renderers GTK et GJS sans mélanger leurs API.
- [ ] Mesurer et réduire les mises à jour et allocations inutiles.

## P4 — CLI et générateurs

- [ ] Fiabiliser `gef new` et ses tests de bout en bout.
- [ ] Compléter `gef generate component` avec imports et tests cohérents.
- [ ] Ajouter les générateurs directive, service et pipe.
- [ ] Améliorer la validation de configuration et les messages d'erreur.
- [ ] Garder les commandes et abstractions au strict nécessaire (KISS).

## P5 — Démonstration, documentation et distribution

- [ ] Faire du Kitchen Sink une application de démonstration complète, organisée par écrans.
- [ ] Fournir un accès au code source de chaque démonstration.
- [ ] Simplifier les guides de démarrage et la référence CLI.
- [ ] Documenter les limites et les prérequis de chaque runtime.
- [ ] Vérifier les packages npm et les distributions autonomes sur leurs plateformes natives.
- [ ] Définir les critères de sortie de l'alpha et préparer une version stable.

## Règles de maintenance

Après chaque modification fonctionnelle ou corrective :

1. Mettre à jour cette roadmap : cocher uniquement ce qui est réellement terminé, ajouter les tâches découvertes et réordonner si nécessaire.
2. Faire une passe de refactoring KISS sur le code modifié.
3. Exécuter les tests et contrôles pertinents.
4. Pousser sur `main`, puis vérifier la CI du commit exact avant de déclarer le travail terminé.

Ne pas présenter une tâche comme terminée si sa validation échoue ou reste en cours.
