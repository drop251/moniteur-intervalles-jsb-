import 'package:flutter/services.dart';

/// Fonctions natives associées aux séances JSB, sans requête réseau.
/// La mise en veille de l'écran n'est empêchée que pendant une séance active
/// et seulement si l'utilisateur a activé l'option correspondante.
class NativeSessionFeatures {
  NativeSessionFeatures({MethodChannel? channel})
      : _channel = channel ?? const MethodChannel('jsb/native_audio');

  final MethodChannel _channel;

  Future<void> setKeepAwake(bool enabled) async {
    try {
      await _channel.invokeMethod<void>(
        'setKeepAwake',
        <String, bool>{'enabled': enabled},
      );
    } on MissingPluginException {
      // Appareil ou version native dépourvue de cette fonctionnalité.
    } on PlatformException {
      // L'horloge reste utilisable si la prévention de veille est indisponible.
    }
  }

  /// Retour haptique léger selon la phase. Aucun son ni focus audio modifié.
  Future<void> hapticForCue(String event) async {
    try {
      switch (event) {
        case 'countdown':
          await HapticFeedback.selectionClick();
          break;
        case 'rest':
          await HapticFeedback.lightImpact();
          break;
        case 'finish':
          await HapticFeedback.heavyImpact();
          break;
        default:
          await HapticFeedback.mediumImpact();
      }
    } on MissingPluginException {
      // Les vibrations sont facultatives.
    } on PlatformException {
      // Ne jamais bloquer le timer si le retour haptique échoue.
    }
  }
}
