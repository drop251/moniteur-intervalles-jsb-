import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:moniteur_intervalles/audio/native_audio_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  test('volume par défaut et atténuation active', () async {
    final settings = await NativeAudioSettings.load();
    expect(settings.alertVolume, 90);
    expect(settings.duckExternalMusic, isTrue);
  });

  test('sauvegarde du volume et de la préférence duck', () async {
    const chosen = NativeAudioSettings(
      alertVolume: 75,
      duckExternalMusic: false,
    );
    await chosen.save();
    final loaded = await NativeAudioSettings.load();
    expect(loaded.alertVolume, 75);
    expect(loaded.duckExternalMusic, isFalse);
  });

  test('retour du canal et bons paramètres natifs', () async {
    const channel = MethodChannel('jsb/native_audio_test');
    final messenger =
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
    MethodCall? captured;
    messenger.setMockMethodCallHandler(channel, (call) async {
      captured = call;
      return <String, Object>{
        'played': true,
        'focusGranted': true,
        'message': 'Focus temporaire demandé',
      };
    });
    final service = NativeAudioService(channel: channel);
    final response = await service.playCue(
      TrainingCue.effort,
      settings: const NativeAudioSettings(
        alertVolume: 90,
        duckExternalMusic: true,
      ),
    );
    expect(captured!.method, 'playCue');
    final arguments = captured!.arguments as Map<dynamic, dynamic>;
    expect(arguments['cue'], 'effort');
    expect(arguments['volume'], 90);
    expect(arguments['duckOthers'], isTrue);
    expect(response.played, isTrue);
    expect(response.focusGranted, isTrue);
    expect(response.duckRequested, isTrue);
    messenger.setMockMethodCallHandler(channel, null);
  });

  test('zéro volume ne demande aucune priorité audio', () async {
    const channel = MethodChannel('jsb/native_audio_mute_test');
    final service = NativeAudioService(channel: channel);
    final response = await service.playCue(
      TrainingCue.finish,
      settings: const NativeAudioSettings(alertVolume: 0),
    );
    expect(response.played, isFalse);
    expect(response.duckRequested, isFalse);
  });

  test('pont indisponible renvoie un message sans crash', () async {
    const channel = MethodChannel('jsb/no_handler');
    final service = NativeAudioService(channel: channel);
    final response = await service.playCue(
      TrainingCue.countdown,
      settings: const NativeAudioSettings(),
    );
    expect(response.played, isFalse);
    expect(response.message, contains('non installé'));
  });
}
