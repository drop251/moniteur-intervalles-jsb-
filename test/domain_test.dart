import 'package:flutter_test/flutter_test.dart';
import 'package:moniteur_intervalles/domain/interval_plan.dart';
import 'package:moniteur_intervalles/domain/leger_protocol.dart';
import 'package:moniteur_intervalles/engine/schedule.dart';

void main() {
  group('buildPhases', () {
    test('Tabata classique : prépa, 8 efforts, 7 repos, fin', () {
      final phases = buildPhases(builtInPresets.first);
      final types = phases.map((p) => p.type).toList();

      expect(types.first, PhaseType.prep);
      expect(types.where((t) => t == PhaseType.effort).length, 8);
      // Pas de repos après le dernier cycle.
      expect(types.where((t) => t == PhaseType.rest).length, 7);
      expect(types.last, PhaseType.end);
    });

    test('Sans préparation, la séance commence directement par un effort', () {
      const preset = Preset(name: 'x', prepSec: 0, workSec: 30, restSec: 0, cycles: 2);
      final phases = buildPhases(preset);
      expect(phases.first.type, PhaseType.effort);
    });
  });

  group('Protocole Luc Léger (standard)', () {
    test('Durée d\'une navette au palier 1 : 72 / 8,5 s', () {
      expect(shuttleDurationMs(8.5), closeTo(8470.588, 0.001));
    });

    test('Vitesse du palier n : 8,5 + 0,5 × (n − 1)', () {
      final levels = standardLegerLevels();
      expect(levels.first.speedKmh, 8.5);
      expect(levels[1].speedKmh, 9.0);
      expect(levels.last.speedKmh, 18.5);
    });

    test('Chaque palier dure environ 60 secondes', () {
      for (final level in standardLegerLevels()) {
        final total = level.shuttles * level.shuttleMs;
        expect(total, closeTo(60000, level.shuttleMs), reason: 'palier ${level.level}');
      }
    });

    test('La chronologie est continue et marque la fin de chaque palier', () {
      final levels = standardLegerLevels(levelCount: 3);
      final schedule = buildLegerSchedule(levels);

      for (var i = 1; i < schedule.length; i++) {
        expect(schedule[i].startMs, closeTo(schedule[i - 1].endMs, 1e-9));
      }
      expect(schedule.where((s) => s.isLastOfLevel).length, 3);
    });

    test('Résultat : aucun palier complet avant la fin du premier', () {
      final levels = standardLegerLevels(levelCount: 3);
      final schedule = buildLegerSchedule(levels);
      final result = legerResultAt(
        levels: levels,
        schedule: schedule,
        elapsedMs: 1000,
      );
      expect(result.lastCompletedLevel, isNull);
      expect(result.validatedShuttles, 0);
    });
  });

  group('Planification des bips', () {
    test('Décompte 3-2-1 avant l\'effort, puis bip d\'effort', () {
      const preset = Preset(name: 'x', prepSec: 0, workSec: 10, restSec: 0, cycles: 1);
      // Pas de préparation : le décompte précède le premier effort à 0 ms,
      // donc il est ignoré (instants négatifs).
      final cues = buildCues(buildPhases(preset));
      final effortCue = cues.firstWhere((c) => c.frequencyHz == 1500);
      expect(effortCue.atMs, 0);
      expect(cues.where((c) => c.frequencyHz == 800), isEmpty);
    });

    test('Le décompte est planifié avant chaque effort précédé d\'une phase', () {
      const preset = Preset(name: 'x', prepSec: 10, workSec: 20, restSec: 10, cycles: 2);
      final cues = buildCues(buildPhases(preset));
      final countdowns = cues.where((c) => c.frequencyHz == 800).map((c) => c.atMs).toList();
      // Prépa 0-10 s, effort 1 à 10 s, repos 30-40 s, effort 2 à 40 s.
      // Décomptes à 7, 8, 9 s (avant l'effort 1) et à 37, 38, 39 s (avant l'effort 2).
      expect(countdowns, containsAll([7000, 8000, 9000, 37000, 38000, 39000]));
    });
  });

  group('phaseIndexAt', () {
    test('Renvoie la phase active aux frontières', () {
      final starts = [0, 1000, 3000];
      expect(phaseIndexAt(starts, 0), 0);
      expect(phaseIndexAt(starts, 999), 0);
      expect(phaseIndexAt(starts, 1000), 1);
      expect(phaseIndexAt(starts, 2999), 1);
      expect(phaseIndexAt(starts, 3000), 2);
      expect(phaseIndexAt(starts, 99999), 2);
    });
  });
}
