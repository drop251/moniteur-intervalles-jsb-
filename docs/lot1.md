# Lot 1 — Prototype HIIT / Tabata

Cette branche ajoute une interface Flutter initiale à la base existante, sans supprimer les modules `lib/domain` ou `lib/engine`.

## Fonctionnalités

- Accueil avec préréglages Tabata classique et HIIT 30/15
- Éditeur de séance : préparation, effort, repos, cycles
- Durée estimée sans repos après le dernier cycle
- Minuteur plein écran avec phase, cycle et compte à rebours
- Pause / reprise et confirmation d'arrêt
- Clic et vibration système provisoires
- Historique et séances enregistrés localement via SharedPreferences

## Lancer le projet

```bash
flutter create . --platforms=ios,android
flutter pub get
flutter analyze
flutter test
flutter run
```

Les plateformes peuvent déjà exister dans le dépôt : ne pas écraser leurs configurations sans examen.

## Limites bloquantes avant publication

Ce prototype n'a pas été compilé ni vérifié sur iOS/Android dans l'environnement de génération.

- Le chronomètre utilise une horloge Stopwatch, mais les bips sont déclenchés depuis le rafraîchissement UI : **latence audio non garantie**.
- Les séances ne sont pas garanties avec écran verrouillé, en arrière-plan ou après interruption système.
- SharedPreferences est non chiffré et doit être remplacé avant tout stockage de résultats individuels sensibles.
- Les modules préexistants `lib/domain` et `lib/engine` ne sont pas encore intégrés à cet écran.
- Le protocole Luc Léger n'est pas inclus dans ce lot.
- Les tests sur appareils et l'audit VoiceOver/TalkBack restent à réaliser.

Ne pas fusionner en production avant ces validations.


## Lot 1.1 — Chronométrage unifié

- L'interface utilise maintenant `IntervalSessionController`, `PhaseClock`, `buildPhases` et `buildCues` du projet.
- Les phases sont recherchées par échéance absolue ; un rafraîchissement retardé ne cumule pas de retard sur les phases suivantes.
- Les signaux manqués de plus de 180 ms sont ignorés plutôt que joués en rafale.
- Les pauses ne modifient pas l'horloge de séance.
- Les tests couvrent le changement de phase, le gel du temps en pause, la reprise, la fin et l'arrêt.
- La CI GitHub exécute `flutter pub get`, `flutter analyze` et `flutter test`.

### Important

Le son et la vibration sont encore déclenchés par l'UI et non planifiés par la couche native : ceci n'assure pas de précision acoustique en arrière-plan ni pendant le verrouillage de l'écran. Le contrôle de session est une fondation testable et non une certification de précision.

Le modèle de phase partagé inclut une phase FIN de 1,5 s. L'historique enregistre la fin après cette phase de clôture.
