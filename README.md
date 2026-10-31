# Moniteur JSB — Judo Sans Barrière

Minuteur sportif pour les entraînements de judo et de préparation physique. Disponible dans un navigateur et en application mobile.

**Version HTML / PWA :** [Ouvrir Moniteur JSB](https://drop251.github.io/moniteur-intervalles-jsb-/)

## Navigation simplifiée

L'interface affiche **trois minuteurs principaux** dans la barre inférieure : Randori, Tabata et Chronomètre. Golden Score et les bips aléatoires restent accessibles dans leurs minuteurs respectifs.

L'espace expérimental **Luc Léger** est conservé dans le code, mais **masqué dans la navigation** tant que son protocole et ses signaux ne sont pas validés. Aucun test de cadence non validé n'est lancé.

## Option C — immersion complète activité/repos (v4.1)

Quand un Randori ou un Tabata est en cours, **tout l'écran du minuteur** suit la phase :
- **Effort/activité :** écran bleu marine JSB, chiffres dorés, libellés blancs et boutons adaptés.
- **Repos :** écran intégralement doré, chiffres et textes bleu marine, commandes inversées.
- **En-tête et zone des commandes :** nuances discrètes de la couleur dominante, sans carte centrale séparée.
- **Transitions :** 300 ms sans clignotement, sauf si l'utilisateur a activé « Réduire les animations ».
- **A11y :** libellés ACTIVITÉ/REPOS, annonce des phases par lecteur d'écran, contraste des couleurs de marque d'environ 7,39:1.
- **Portrait et paysage :** les commandes restent au même emplacement et le chronomètre conserve son grand format.
- **Barre système du navigateur :** synchronisation de la couleur lorsque prise en charge par la plateforme.

Les modes Chronomètre et Golden Score gardent le thème bleu marine pendant le comptage, et la préparation reste sombre. Le moteur audio, les bips et les préréglages ne sont pas modifiés.

**Publication :** version web dans le dépôt sur \`main\` avec cache PWA \`moniteur-jsb-web-v41\`. Paquet Flutter hors ligne sur \`feat/lot1-ui\`, version \`0.3.1+10\`. La version native déjà installée sur l'iPhone doit être recompilée et réinstallée ; modifier les fichiers GitHub ne suffit pas à la remplacer.

## Nouvelle interface JSB v4.0

Les anciens blocs de réglages et de lancement ont été remplacés par un **grand chronomètre central** sur chaque écran :

- **Randori** : temps principal, numéro du combat, un bouton Régler et un bouton Démarrer.
- **Tabata** : temps d'effort, exercice/cycle en cours et accès au réglage complet des intervalles.
- **Chronomètre** : affichage 00:00 et démarrage immédiat selon la préparation choisie.
- **Golden Score** et **Bips aléatoires** : accessibles sous « Autre mode », sans surcharger l'écran.
- **Mes séances enregistrées** : panneau repliable, avec accès aux presets personnels.

La barre inférieure ne montre que Randori, Tabata et Chronomètre. Le test **Luc Léger** reste masqué et non exécutable tant que son protocole n'est pas validé.

L'identité du logo JSB est appliquée : fond bleu marine `#1F2839`, doré `#D9B175`, blanc ; pendant un **effort**, les chiffres sont dorés sur bleu marine ; pendant le **repos**, la zone centrale devient dorée avec des chiffres bleu marine. Les mots ACTIVITÉ/REPOS et les annonces aux lecteurs d'écran restent présents. Les contrastes de cette combinaison atteignent environ 7,39:1.

Les commandes Pause/Arrêter restent sous le temps en paysage, avec maintien des signaux réels, bips aléatoires Randori, Golden Score et cycles Tabata.

La version web est enregistrée sur `main` et met à jour le cache PWA vers `moniteur-jsb-web-v40`. Le code de l'interface mobile hors ligne est actualisé sur `feat/lot1-ui` (Flutter `0.3.0+9`). **L'app native déjà installée sur iPhone ne reçoit pas automatiquement ces modifications : un nouveau build iOS doit être compilé et distribué.**

Les **Réglages** sont accessibles uniquement par la roue dentée **⚙ en haut à droite**. Toucher la roue lorsque les réglages sont ouverts ramène à l'espace précédent.

### Dernier minuteur utilisé

Moniteur JSB mémorise localement **le dernier minuteur effectivement démarré**. À la prochaine ouverture, l'application affiche son espace (Randori, Tabata ou Chronomètre) et conserve ses paramètres ; l'interface privilégie les commandes immédiates **Régler** et **Démarrer**.

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
- `premium_v2.css`, `jsb_refinement.css`, `jsb_interface_v4.css` et `jsb_phase_immersive_v41.css` : identité JSB, vraie nouvelle disposition, mise en page responsive et contraste activité/repos.
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
