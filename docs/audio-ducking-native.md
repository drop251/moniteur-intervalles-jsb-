# Moniteur JSB — Lot audio natif : signaux prioritaires et musique externe

**Statut : implémentation native en cours de validation sur appareils physiques.**  
**Supports visés : iPhone, iPad, Android et tablettes Android.**  
**Pas de lecteur intégré, pas de connexion Apple Music/Spotify ni de contrôle direct de leurs volumes.**

## Objectif utilisateur

Lors d'une séance judo / Taïso / PPG (randori, Golden Score, Tabata, HIIT) :

1. Le pratiquant lance une playlist dans Apple Music ou Spotify.
2. Il revient à Moniteur JSB et démarre son minuteur.
3. **Trois secondes avant** chaque signal prévisible, le système **demande d'atténuer temporairement la musique externe** ; Moniteur JSB joue ensuite un son net au volume interne choisi (90 % par défaut).
4. **Trois secondes après la fin du dernier son** d'une séquence, le système libère la priorité audio et la musique revient à son niveau habituel.
5. En pause ou à l'arrêt, aucune priorité audio ne demeure détenue.

**Attention : 90 % de volume JSB / 10 % de musique externe est une préférence de rendu, pas une garantie technique.** Aucun des systèmes ne permet de fixer précisément le gain de Spotify ou Apple Music à 10 % sans coopération de l'application tierce. Le taux réel dépend d'iOS/Android, de la sortie audio (haut-parleurs, Bluetooth), de la version des autres applications et du type de média.

## Spécifications UX/a11y

- Réglages natifs : **Intensité du signal** (0 à 100, valeur par défaut 90), **Atténuer les autres musiques pendant les signaux** (activé par défaut), **Tester le signal de combat**, **Tester le gong final**.
- Descriptions accessibles VoiceOver / TalkBack, cibles >= 48 dp, indications non exclusivement sonores.
- Signaux distincts : préparation, effort/randori, repos, décompte, fin de séance (gong long) ; aucune atténuation en dehors d'un signal.
- Si la priorité audio est refusée ou indisponible, un retour d'état l'indique : pas de promesse de réduction musicale effective.
- Sur interruption téléphonique, changement de périphérique, app en arrière-plan : l'audio doit libérer ses ressources et ne jamais laisser la musique artificiellement abaissée.
- L'application ne doit ni arrêter/relancer Spotify, ni modifier le volume système, ni solliciter de permissions d'accès aux playlists.

## Comportement natif

### iOS / iPadOS — AVAudioSession

- Au moment précis d'un signal, définir la catégorie `playback` avec les options `mixWithOthers` et `duckOthers` **uniquement si l'atténuation est activée**.
- Si l'atténuation est désactivée, utiliser `playback` + `mixWithOthers` : le son JSB coexiste avec la musique sans demander de réduction.
- Activer l'audio session avant lecture ; utiliser `AVAudioPlayer` avec un échantillon de son synthétisé par l'application.
- Trois secondes après la fin du dernier signal d'une séquence, **désactiver** l'audio session (`notifyOthersOnDeactivation`) pour que la musique retrouve son volume. Ne jamais garder `duckOthers` actif pendant tout le chronomètre.
- En cas d'erreur, désactiver la session et transmettre l'état à Flutter.
- Référence : https://developer.apple.com/documentation/avfaudio/avaudiosession/categoryoptions-swift.struct/duckothers

### Android — AudioManager / AudioTrack

- Demander l'audio focus **temporaire** `AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK` pour la durée d'un signal, avec `AudioAttributes` de type sonification.
- Jouer le signal court via `AudioTrack` ; abandonner la requête de focus dès la fin.
- Avec atténuation désactivée, ne pas demander de focus : jouer le son JSB sans modifier le volume d'une application externe.
- Si le focus est refusé (appel en cours, autre priorité), signaler le refus et ne pas forcer la lecture.
- Compatibilité Android < 26 via l'ancienne API `requestAudioFocus` / `abandonAudioFocus`.
- Référence : https://developer.android.com/media/optimize/audio-focus

## Architecture

- `lib/audio/native_audio_service.dart` : API Flutter `MethodChannel('jsb/native_audio')`, réglages persistants et résultats contrôlés.
- `ios/Runner/AppDelegate.swift` : implémentation AVAudioSession/AVAudioPlayer et handler du MethodChannel.
- `android/app/src/main/kotlin/com/example/moniteur_intervalles/MainActivity.kt` : AudioFocusRequest/AudioTrack et handler du MethodChannel.
- `lib/main.dart` : écran Réglages audio, boutons de préécoute, émission des signaux au fil des phases et gong final.
- Tests Dart de la sérialisation et des erreurs de canal.

## Critères d'acceptation

- [ ] Démarrer un HIIT en écoutant Apple Music ne la met pas en pause.
- [ ] Pendant les bips, la musique diminue sensiblement sur iOS et Android compatibles.
- [ ] La musique reprend au niveau habituel immédiatement après chaque bip/gong.
- [ ] 90 % sur le curseur JSB rend le son clairement audible ; ne modifie pas le volume physique de l'appareil.
- [ ] Pause, reprise, arrêt anticipé, appel entrant, Bluetooth et changement d'application ne laissent aucun focus audio détenu.
- [ ] Aucune perte d'historique, aucun lecteur intégré ni compte nécessaire.
- [ ] Tests VoiceOver / TalkBack et appareils physiques réussis avant livraison de production.

## Limitations et livraison

La version web GitHub Pages n'a pas accès au mixage audio système inter-applications et ne peut pas appliquer cette fonction.

Le dépôt Flutter actuel peut ne pas posséder les projets Xcode/Gradle générés : créer le squelette natif avec `flutter create --platforms=ios,android .` avant compilation. Le code Swift/Kotlin natif est livré comme source ; il doit être compilé et validé sur iPhone / iPad et appareils Android avant de prétendre que l'application installable est opérationnelle.

## Réglage iOS testé à partir d’octobre 2026

- Début d’atténuation : 3 secondes avant chaque bip planifié, si l’horloge dispose de cette avance.
- Fin d’atténuation : 3 secondes après la durée réelle du bip ; toute alerte intermédiaire prolonge la fenêtre.
- Décompte 3–2–1 : maintien continu pour éviter une remontée entre les bips.
- Pause et arrêt : libération immédiate de la session de ducking. Fin de séance : attendre la fin du gong et sa fenêtre de 3 secondes.
- Limite matérielle : le système règle l’ampleur de l’atténuation de Spotify / Apple Music, pas l’application.
