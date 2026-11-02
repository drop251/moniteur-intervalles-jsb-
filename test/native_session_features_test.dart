import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:moniteur_intervalles/app/native_session_features.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('écran allumé : bascule native true/false via canal JSB', () async {
    const channel = MethodChannel('jsb/session_features_test');
    final messenger =
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
    final received = <bool>[];
    messenger.setMockMethodCallHandler(channel, (call) async {
      expect(call.method, 'setKeepAwake');
      final args = call.arguments as Map<dynamic, dynamic>;
      received.add(args['enabled'] == true);
      return null;
    });
    final session = NativeSessionFeatures(channel: channel);
    await session.setKeepAwake(true);
    await session.setKeepAwake(false);
    expect(received, [true, false]);
    messenger.setMockMethodCallHandler(channel, null);
  });

  test('écran allumé non disponible : aucun plantage', () async {
    const channel = MethodChannel('jsb/missing_session_feature');
    final session = NativeSessionFeatures(channel: channel);
    await expectLater(session.setKeepAwake(true), completes);
    await expectLater(session.setKeepAwake(false), completes);
  });

  test('retour haptique : intensités adaptées aux phases', () async {
    final messenger =
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
    final calls = <String>[];
    messenger.setMockMethodCallHandler(SystemChannels.platform, (call) async {
      if (call.method == 'HapticFeedback.vibrate') {
        calls.add(call.arguments as String);
      }
      return null;
    });

    final session = NativeSessionFeatures();
    await session.hapticForCue('countdown');
    await session.hapticForCue('rest');
    await session.hapticForCue('effort');
    await session.hapticForCue('finish');
    expect(calls, [
      'HapticFeedbackType.selectionClick',
      'HapticFeedbackType.lightImpact',
      'HapticFeedbackType.mediumImpact',
      'HapticFeedbackType.heavyImpact',
    ]);
    messenger.setMockMethodCallHandler(SystemChannels.platform, null);
  });
}
