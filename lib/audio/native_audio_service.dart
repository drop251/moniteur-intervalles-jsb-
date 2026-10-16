import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Signaux adaptés aux arts martiaux et aux séances de Taïso.
///
/// Une valeur unique est transmise aux implémentations iOS et Android.
enum TrainingCue { preparation, effort, recovery, countdown, finish }

/// Volume de la SEULE alerte Moniteur JSB, et demande facultative de ducking.
///
/// Aucun réglage de l'application ne contrôle directement le gain Spotify /
/// Apple Music. L'OS choisit l'atténuation des autres sources.
class NativeAudioSettings {
  const NativeAudioSettings({
    this.alertVolume = 90,
    this.duckExternalMusic = true,
  }) : assert(alertVolume >= 0 && alertVolume <= 100);

  final int alertVolume;
  final bool duckExternalMusic;

  static const volumeKey = 'native_audio_alert_volume';
  static const duckKey = 'native_audio_duck_external';

  NativeAudioSettings copyWith({
    int? alertVolume,
    bool? duckExternalMusic,
  }) =>
      NativeAudioSettings(
        alertVolume: alertVolume ?? this.alertVolume,
        duckExternalMusic: duckExternalMusic ?? this.duckExternalMusic,
      );

  static Future<NativeAudioSettings> load() async {
    final preferences = await SharedPreferences.getInstance();
    return NativeAudioSettings(
      alertVolume: (preferences.getInt(volumeKey) ?? 90).clamp(0, 100),
      duckExternalMusic: preferences.getBool(duckKey) ?? true,
    );
  }

  Future<void> save() async {
    final preferences = await SharedPreferences.getInstance();
    await preferences.setInt(volumeKey, alertVolume);
    await preferences.setBool(duckKey, duckExternalMusic);
  }
}

class NativeAudioPlayback {
  const NativeAudioPlayback({
    required this.played,
    required this.duckRequested,
    required this.focusGranted,
    this.message,
    this.duckConfigured,
    this.otherAudioPlaying,
    this.outputRoute,
  });

  final bool played;

  /// L'utilisateur a choisi l'atténuation, mais elle n'est pas quantifiée.
  final bool duckRequested;

  /// Autorisation audio locale du système, pas preuve d'un ratio 90/10.
  final bool focusGranted;

  final String? message;
  final bool? duckConfigured;
  final bool? otherAudioPlaying;
  final String? outputRoute;

  factory NativeAudioPlayback.fromResponse(
    Map<dynamic, dynamic>? response, {
    required bool requestedDuck,
  }) {
    return NativeAudioPlayback(
      played: response?['played'] == true,
      duckRequested: requestedDuck,
      focusGranted: response?['focusGranted'] == true,
      message: response?['message'] as String?,
      duckConfigured: response?['duckConfigured'] as bool?,
      otherAudioPlaying: response?['otherAudioPlaying'] as bool?,
      outputRoute: response?['outputRoute'] as String?,
    );
  }
}

/// Pont vers le mixage natif. L'API n'est pas disponible dans la PWA.
class NativeAudioService {
  NativeAudioService({MethodChannel? channel})
      : _channel = channel ?? const MethodChannel('jsb/native_audio');

  final MethodChannel _channel;

  Future<NativeAudioPlayback> playCue(
    TrainingCue cue, {
    required NativeAudioSettings settings,
    bool preview = false,
  }) async {
    if (settings.alertVolume == 0) {
      return const NativeAudioPlayback(
        played: false,
        duckRequested: false,
        focusGranted: false,
        message: 'Signaux désactivés : volume à zéro.',
      );
    }

    try {
      final response = await _channel.invokeMapMethod<dynamic, dynamic>(
        'playCue',
        <String, Object>{
          'cue': cue.name,
          'volume': settings.alertVolume,
          'duckOthers': settings.duckExternalMusic,
          'preview': preview,
        },
      );
      return NativeAudioPlayback.fromResponse(
        response,
        requestedDuck: settings.duckExternalMusic,
      );
    } on MissingPluginException {
      return const NativeAudioPlayback(
        played: false,
        duckRequested: false,
        focusGranted: false,
        message: 'Pont audio natif non installé sur cet appareil.',
      );
    } on PlatformException catch (error) {
      return NativeAudioPlayback(
        played: false,
        duckRequested: settings.duckExternalMusic,
        focusGranted: false,
        message: error.message ?? 'Lecture audio indisponible.',
      );
    }
  }
}
