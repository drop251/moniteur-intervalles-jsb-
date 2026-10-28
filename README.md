# Moniteur JSB — Judo Sans Barrière

Minuteur sportif pour les séances de judo et de préparation physique, accessible dans un navigateur ou sous forme d'application mobile.

**Version HTML / PWA :** [Ouvrir Moniteur JSB](https://drop251.github.io/moniteur-intervalles-jsb-/)

## Interface web

L'accueil comporte **trois menus déroulants** :

- **Randori** : Randori classique et Golden Score.
- **Tabata** : entraînement fractionné et récupération.
- **Chronomètre** : chronomètre libre (comptage croissant) et bips aléatoires.

Le **test Luc Léger** est masqué par défaut. Il est possible d'afficher son emplacement via *Réglages → Fonctions expérimentales*, mais son lancement est désactivé tant que le protocole et les signaux ne sont pas validés.

Les boutons **Régler** et **Démarrer** sont distincts. L'interface conserve les séances personnalisées et l'historique dans le stockage local du navigateur. Elle inclut les confirmations d'arrêt et le résumé d'une séance, ainsi qu'un affichage paysage optimisé.

L'identité visuelle JSB utilise le bleu nuit, le blanc ivoire et des accents dorés.

## Sons et musique

Les signaux sportifs JSB sont générés localement : Cloche sportive, Pulse net, Double digital, Clac sec, Bip doux, ainsi que trois signaux de fin.

La **version web** utilise l'audio du navigateur. Elle **ne peut pas commander la baisse de volume de Spotify ou Apple Music**. La superposition de la musique et des alertes dépend du navigateur et du système. Le maintien de l'écran allumé et les vibrations dépendent également des API proposées par l'appareil.

La **version mobile iOS** dispose d'un moteur audio natif distinct, développé sur la branche `feat/lot1-ui`, qui demande à iOS une atténuation de la musique externe avant et après les signaux. Ne pas confondre ce comportement avec les capacités de la version web.

## Installation et fonctionnement hors ligne

Depuis l'URL GitHub Pages, ouvrir Moniteur JSB dans un navigateur. Il est possible de l'ajouter à l'écran d'accueil lorsqu'il est proposé. Le service worker conserve les ressources essentielles après une première visite en ligne ; les séances peuvent ensuite être utilisées hors connexion si le navigateur conserve son cache.

Les réglages et historiques utilisent le stockage local du navigateur (`localStorage`) : aucun compte n'est demandé. Ce stockage **n'est pas chiffré par l'application web**. Effacer les données du navigateur peut supprimer l'historique.

## Fichiers

- `index.html` : interface web et logique de navigation.
- `premium_v2.css` : design responsive, portrait et paysage.
- `training_modes.js` : définition des modes et de leurs phases.
- `sound_engine.js` et `audio_cues.js` : audio synthétisé et décomptes.
- `interaction_gate.js`, `workout_manager.js`, `workout_library.js`, `duration_presets.js`, `random_signals.js` : outils de préparation et d'entraînement.
- `sw.js`, `manifest.webmanifest` et `icon.svg` : PWA et cache hors ligne.

## Validation

```bash
node --test tests/web_html.test.cjs
node test/web_training_modes.test.cjs
node test/web_sound_engine.test.cjs
```

La branche `main` est validée automatiquement dans GitHub Actions avec les workflows *Validation HTML / PWA JSB* et *Web preview validation*. La compilation de l'application iOS/Android est suivie séparément.
