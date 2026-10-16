# Moniteur d'intervalles et tests physiques

Application mobile de minuteur pour séances Tabata, HIIT, EMOM, AMRAP, boxe et test Luc Léger.

## Principes
- Données uniquement sur l'appareil, chiffrées. Aucun compte, aucun backend, aucune permission réseau.
- Pas de partage, d'export, d'analytics ni de publicité.
- Accessibilité visée : WCAG 2.1 AA, contrastes 4,5:1 minimum, lecteurs d'écran.

## État
- `prototype/moniteur.html` : maquette interactive (HTML autonome, sans réseau).
- Test Luc Léger : protocole standard (20 m, départ 8,5 km/h, +0,5 km/h par palier, paliers d'environ 60 s). Le nombre de navettes par palier reste à vérifier contre la table imprimée.
- Application Flutter, début :
  - `lib/domain/` : séances, protocole Luc Léger (logique pure, sans Flutter).
  - `lib/engine/` : planification des bips et horloge sans dérive (logique pure).
  - `test/` : tests unitaires de ces deux couches.
  - Interface et couche audio native : à venir.

## Tests
`flutter test` depuis la racine du projet. Non exécutés dans la session de création : la compilation et les tests restent à lancer sur un poste avec Flutter installé.
