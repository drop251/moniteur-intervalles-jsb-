# Moniteur JSB — Installer la version native sur un iPhone avec un Mac

**Statut : branche de développement `feat/lot1-ui`.** Le code est en revue (PR n° 1). Ce n'est pas la PWA Safari / GitHub Pages. La compilation du simulateur ne prouve pas encore le bon fonctionnement avec Apple Music/Spotify sur iPhone réel.

## Prérequis

- Mac avec Xcode à jour, compte Apple personnel (gratuit) et iPhone relié au Mac.
- Flutter SDK installé sur le Mac (Xcode seul ne fournit pas Flutter).
- Git et outils Xcode en ligne de commande.
- Activer **Mode développeur** dans les réglages iOS, si nécessaire.

## 1. Vérifier le poste dans Terminal

```sh
xcodebuild -version
flutter --version
flutter doctor -v
```

Si `flutter` est introuvable : installer d'abord le SDK Flutter via https://docs.flutter.dev/get-started/install/macos/mobile-ios, puis relancer Terminal. Configurer les outils Xcode si Flutter l'indique :

```sh
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -runFirstLaunch
```

## 2. Télécharger la branche native

```sh
git clone --branch feat/lot1-ui https://github.com/drop251/moniteur-intervalles-jsb-.git
cd moniteur-intervalles-jsb-
flutter pub get
flutter create --platforms=ios --org com.example .
open ios/Runner.xcworkspace
```

> Le projet conserve ses fichiers natifs spécifiques `ios/Runner/AppDelegate.swift` et son code Flutter. Si Xcode indique que le workspace n'existe pas, vérifier la sortie de `flutter create`.

## 3. Signer gratuitement dans Xcode

1. Xcode > Settings > Accounts (ou Apple Accounts selon la version) : ajouter son compte Apple.
2. Brancher l'iPhone via câble, le déverrouiller et confirmer « Faire confiance ».
3. Choisir l'iPhone comme destination de compilation Xcode.
4. Sélectionner le projet **Runner**, puis la cible **Runner** > **Signing & Capabilities**.
5. Activer **Automatically manage signing**, sélectionner **Your Name (Personal Team)**, et renseigner un identifiant unique pour l'application (par exemple `fr.judosansbarriere.moniteurjsb.dev` s'il est disponible).
6. Sur l'iPhone : **Réglages > Confidentialité et sécurité > Mode développeur** ; l'activer et redémarrer si demandé.
7. Dans Xcode, cliquer ▶ pour installer / lancer l'application.

La signature gratuite Apple impose notamment un renouvellement en principe après sept jours. Elle ne donne pas accès à TestFlight.

## 4. Exécuter depuis Flutter (alternative)

```sh
flutter devices
flutter run
```

Sélectionner l'iPhone si plusieurs appareils sont listés. Si Flutter demande une signature, terminer la configuration **Personal Team** dans Xcode.

## 5. Test réel de l'audio

1. Lancez Apple Music ou Spotify sur l'iPhone.
2. Revenez à l'application native **Moniteur JSB** (pas l'icône Safari).
3. Dans **Audio**, laissez « atténuer la musique » actif et le signal à 90 %.
4. Lancez un HIIT et vérifiez : musique continue ; atténuation lors des bips ; retour au volume normal après chaque bip et le gong final.
5. Recommencez avec une enceinte Bluetooth si c'est l'usage prévu en dojo.

**Limite système :** iOS contrôle la profondeur de l'atténuation. Un volume musical à exactement 10 % n'est pas garanti ; le réglage 90 % correspond uniquement au signal Moniteur JSB.

En cas d'échec, transmettre la sortie `flutter doctor -v` ou l'erreur Xcode, ainsi que le modèle iPhone, la version iOS et l'application musicale utilisée (Spotify / Apple Music).

## Références officielles

- Flutter : https://docs.flutter.dev/platform-integration/ios/setup
- Apple : https://developer.apple.com/fr/help/account/basics/about-your-developer-account
