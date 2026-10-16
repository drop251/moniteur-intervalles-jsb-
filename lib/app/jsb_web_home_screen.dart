import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../audio/native_audio_service.dart';
import 'native_session_features.dart';

/// Original JSB web experience bundled on-device. The HTML never navigates
/// to an external URL, and all sounds are delegated to the native audio engine.
class JsbWebHomeScreen extends StatefulWidget {
  const JsbWebHomeScreen({super.key});

  @override
  State<JsbWebHomeScreen> createState() => _JsbWebHomeScreenState();
}

class _JsbWebHomeScreenState extends State<JsbWebHomeScreen>
    with WidgetsBindingObserver {
  final NativeAudioService _audio = NativeAudioService();
  final NativeSessionFeatures _sessionFeatures = NativeSessionFeatures();
  late final WebViewController _web;
  bool _loaded = false;
  String? _fatalError;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _web = WebViewController();
    unawaited(_initializeWeb());
  }

  Future<void> _initializeWeb() async {
    try {
      await _web.setJavaScriptMode(JavaScriptMode.unrestricted);
      await _web.setBackgroundColor(const Color(0xFF1F293B));
      await _web.setNavigationDelegate(
        NavigationDelegate(
          onPageFinished: (_) {
            if (mounted) setState(() => _loaded = true);
          },
          onWebResourceError: (error) {
            if (error.isForMainFrame == true && mounted) {
              setState(() => _fatalError = error.description);
            }
          },
          onNavigationRequest: (request) {
            final uri = Uri.tryParse(request.url);
            if (uri == null) return NavigationDecision.prevent;
            // The WebView is strictly offline; no external navigation.
            return uri.scheme == 'file' || uri.scheme == 'about'
                ? NavigationDecision.navigate
                : NavigationDecision.prevent;
          },
        ),
      );
      // Install the native channel BEFORE loading inline HTML scripts.
      await _web.addJavaScriptChannel(
        'JSBHost',
        onMessageReceived: (message) {
          unawaited(_handleJsMessage(message.message));
        },
      );
      await _web.loadFlutterAsset('assets/web/index.html');
    } catch (error) {
      if (mounted) setState(() => _fatalError = error.toString());
    }
  }

  Future<void> _handleJsMessage(String encoded) async {
    try {
      final message = jsonDecode(encoded);
      if (message is! Map<String, dynamic>) return;
      switch (message['type']) {
        case 'screenAwake':
          await _sessionFeatures.setKeepAwake(message['enabled'] == true);
          break;
        case 'haptic':
          await _sessionFeatures.hapticForCue(
            message['event'] as String? ?? 'effort',
          );
          break;
        case 'prepare':
          await _audio.prepareDuck(
            settings: const NativeAudioSettings(),
          );
          break;
        case 'release':
          await _audio.releaseDuck();
          break;
        case 'cue':
          final volume = ((message['volume'] as num?)?.round() ?? 90)
              .clamp(0, 100)
              .toInt();
          final event = message['event'] as String? ?? 'effort';
          final settings = NativeAudioSettings(
            alertVolume: volume,
            duckExternalMusic: true,
          );
          final cue = switch (event) {
            'finish' => TrainingCue.finish,
            'rest' => TrainingCue.recovery,
            'countdown' => TrainingCue.countdown,
            'prep' => TrainingCue.preparation,
            _ => TrainingCue.effort,
          };
          final wav = message['wavBase64'];
          await _audio.playCue(
            cue,
            settings: settings,
            wavBase64: wav is String ? wav : null,
          );
          break;
      }
    } catch (error) {
      debugPrint('JSB offline bridge: $error');
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.inactive ||
        state == AppLifecycleState.paused ||
        state == AppLifecycleState.detached) {
      unawaited(_sessionFeatures.setKeepAwake(false));
      unawaited(_audio.releaseDuck());
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    unawaited(_sessionFeatures.setKeepAwake(false));
    unawaited(_audio.releaseDuck());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF1F293B),
      body: Stack(
        children: [
          WebViewWidget(controller: _web),
          if (!_loaded && _fatalError == null)
            const Center(
              child: CircularProgressIndicator(color: Color(0xFFDBAE6B)),
            ),
          if (_fatalError != null)
            Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(
                  'Impossible de charger Moniteur JSB hors-ligne.\n$_fatalError',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.white),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
