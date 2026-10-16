import 'package:flutter/material.dart';

import 'native_audio_service.dart';

/// Réglages de priorité audio. Aucun lecteur Spotify/Apple Music intégré.
class AudioSettingsScreen extends StatefulWidget {
  const AudioSettingsScreen({super.key});

  @override
  State<AudioSettingsScreen> createState() => _AudioSettingsScreenState();
}

class _AudioSettingsScreenState extends State<AudioSettingsScreen> {
  final NativeAudioService service = NativeAudioService();
  NativeAudioSettings settings = const NativeAudioSettings();
  bool loading = true;
  String feedback = 'Réglages natifs à vérifier sur un appareil physique.';
  String audioDiagnostics = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final saved = await NativeAudioSettings.load();
    if (!mounted) return;
    setState(() {
      settings = saved;
      loading = false;
    });
  }

  Future<void> _updateSettings(NativeAudioSettings next) async {
    setState(() => settings = next);
    await next.save();
  }

  Future<void> _preview(TrainingCue cue) async {
    final response = await service.playCue(cue, settings: settings, preview: true);
    if (!mounted) return;
    setState(() {
      feedback = response.message ??
          (response.played ? 'Signal joué.' : 'Son indisponible.');
      audioDiagnostics = [
        if (response.duckConfigured != null)
          'Atténuation configurée par iOS : ${response.duckConfigured! ? "oui" : "non"}',
        if (response.otherAudioPlaying != null)
          'Autre audio détecté : ${response.otherAudioPlaying! ? "oui" : "non"}',
        if (response.outputRoute != null)
          'Sortie audio : ${response.outputRoute}',
      ].join('\n');
    });
  }

  @override
  Widget build(BuildContext context) {
    if (loading) return const Center(child: CircularProgressIndicator());

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text('Audio du dojo', style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 8),
        const Text(
          'Pour le randori, le Taïso et la préparation physique. '
          'Lancez Spotify ou Apple Music avant la séance. '
          'Moniteur JSB ne contient aucun lecteur musical.',
        ),
        const SizedBox(height: 28),
        Text('Volume des signaux : ${settings.alertVolume} %'),
        Slider(
          value: settings.alertVolume.toDouble(),
          min: 0,
          max: 100,
          divisions: 20,
          label: '${settings.alertVolume} %',
          onChanged: (value) => _updateSettings(
            settings.copyWith(alertVolume: value.round()),
          ),
        ),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text('Atténuer la musique pendant les signaux'),
          subtitle: const Text(
            'Demande à iOS ou Android une réduction temporaire de '
            'Spotify et Apple Music. La réduction exacte dépend du système.',
          ),
          value: settings.duckExternalMusic,
          onChanged: (value) =>
              _updateSettings(settings.copyWith(duckExternalMusic: value)),
        ),
        const SizedBox(height: 16),
        FilledButton.icon(
          onPressed: () => _preview(TrainingCue.effort),
          icon: const Icon(Icons.volume_up),
          label: const Text('Tester le signal et l’atténuation (3 s)'),
        ),
        const SizedBox(height: 12),
        OutlinedButton.icon(
          onPressed: () => _preview(TrainingCue.finish),
          icon: const Icon(Icons.notifications_active),
          label: const Text('Tester le gong final'),
        ),
        const SizedBox(height: 18),
        Semantics(liveRegion: true, child: Text(feedback)),
        if (audioDiagnostics.isNotEmpty) ...[
          const SizedBox(height: 8),
          SelectableText(audioDiagnostics),
        ],
        const SizedBox(height: 18),
        const Text(
          'Objectif : signal à 90 % et musique en fond très atténuée. '
          'Il n’est pas possible de garantir que Spotify ou Apple Music '
          'sera précisément à 10 % du volume initial. '
          'Le fonctionnement doit être testé avec le haut-parleur ou '
          'l’enceinte Bluetooth utilisés sur le tatami.',
        ),
      ],
    );
  }
}
