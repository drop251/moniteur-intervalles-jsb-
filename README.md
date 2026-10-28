# Moniteur JSB — Judo Sans Barrière

Minuteur sportif pour les entraînements de judo et de préparation physique. Disponible dans un navigateur et en application mobile.

**Version HTML / PWA :** [Ouvrir Moniteur JSB](https://drop251.github.io/moniteur-intervalles-jsb-/)

## Navigation simplifiée

La version HTML propose **quatre espaces accessibles dans la barre inférieure** :

1. **Randori** — Randori classique et Golden Score.
2. **Tabata** — Entraînement par intervalles et récupération.
3. **Chronomètre** — Temps libre et bips aléatoires.
4. **Luc Léger** — Espace distinct réservé au test navette de 20 m.

Le test **Luc Léger** possède sa page, mais son lancement reste désactivé jusqu'à validation du protocole, des paliers et des signaux de cadence. Il n'est plus mélangé aux minuteurs récurrents.

Les **Réglages** sont accessibles uniquement par la roue dentée **⚙ en haut à droite**. Toucher la roue lorsque les réglages sont ouverts ramène à l'espace précédent.

### Dernier minuteur utilisé

Moniteur JSB mémorise localement **le dernier minuteur effectivement démarré**. À la prochaine ouverture, l'application affiche son espace (Randori, Tabata ou Chronomètre) et place ce minuteur dans un encart « Dernier minuteur utilisé », avec ses paramètres et les actions **Régler** et **Démarrer**.

**Aucune séance ne démarre automatiquement** après une fermeture ou une actualisation. Lors d'une première utilisation, Randori est l'espace initial.

### Modifier les temps pendant la pause

Pendant un **Randori, un Tabata ou un Golden Score**, le bouton **Modifier les temps** apparaît uniquement après avoir appuyé sur **Pause**.

- Ajuster la durée affichée (minutes/secondes, ou boutons −30 s, −10 s, +10 s, +30 s).
- En Randori et Tabata, modifier aussi les durées d'effort et de récupération **des phases suivantes**.
- En Golden Score, modifier le temps écoulé affiché pendant le comptage croissant.

La séance reste suspendue pendant la modification, **sans bip supplémentaire**. Les modifications s'appliquent au chronomètre en cours sans remplacer automatiquement les préréglages enregistrés.

L'onglet **Historique a été retiré**. Les anciennes données présentes dans le stockage local ne sont pas effacées automatiquement ; les séances personnalisées et les favoris restent accessibles dans les Réglages.

## Sons et musique

La galerie sonore contient **quatre enregistrements sportifs réels CC0** : buzzer de combat, cloche de ring, sifflet d'arbitre et corne sportive. Les sons de récupération, bips aléatoires et fin peuvent être choisis par catégorie. Le décompte emploie le sifflet d'arbitre.

La **version web** utilise l'audio du navigateur et **ne peut pas réduire automatiquement le volume de Spotify ou Apple Music**. La lecture simultanée dépend de l'appareil et du navigateur. L'application mobile iOS dispose d'un moteur audio natif distinct sur la branche `feat/lot1-ui`.

## Hors ligne et confidentialité

Depuis GitHub Pages, ajouter le site à l'écran d'accueil si le navigateur le propose. Le service worker peut conserver les ressources essentielles après la première visite en ligne. Les réglages et séances enregistrées sont stockés localement dans `localStorage`, sans compte. Ce stockage n'est pas chiffré par l'application web, et effacer les données du navigateur peut les supprimer.

## Principaux fichiers

- `index.html` : écrans et navigation.
- `premium_v2.css` : identité JSB et mise en page accessible.
- `training_modes.js` : phases et minuteurs.
- `pause_adjustments.js` : modification des temps durant une pause.
- `jsb_audio_samples.js`, `sound_engine.js`, `audio_cues.js` : lecture des sons sportifs.
- `sw.js`, `manifest.webmanifest`, `icon.svg` : installation PWA et fonctionnement hors ligne.

## Tests

```bash
node --test tests/web_html.test.cjs
node test/web_training_modes.test.cjs
node test/web_sound_engine.test.cjs
```

Les workflows GitHub Actions de la branche `main` vérifient la version HTML. Les builds iOS/Android sont vérifiés séparément.
