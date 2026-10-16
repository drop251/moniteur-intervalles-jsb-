/// Planification des signaux sonores et recherche de la phase courante.
///
/// Fonctions pures : elles ne lisent aucune horloge. Le temps est toujours
/// passé en paramètre, ce qui rend le comportement testable à la milliseconde.
library;

import '../domain/interval_plan.dart';

/// Un signal sonore à émettre à un instant donné de la séance.
class Cue {
  const Cue({
    required this.atMs,
    required this.frequencyHz,
    required this.durationMs,
  });

  /// Instant d'émission, en millisecondes depuis le départ.
  final int atMs;
  final int frequencyHz;
  final int durationMs;
}

/// Fréquence du bip de début de phase.
int phaseFrequencyHz(PhaseType type) => switch (type) {
      PhaseType.prep => 900,
      PhaseType.effort => 1500,
      PhaseType.rest => 600,
      PhaseType.end => 1200,
    };

/// Décompte 3-2-1 avant une préparation ou un effort.
const int countdownFrequencyHz = 800;

/// Calcule la liste ordonnée des bips d'une séance.
///
/// Un décompte 3-2-1 précède chaque effort et chaque préparation, puis le bip
/// de début de phase. Les instants négatifs (début de séance) sont ignorés.
List<Cue> buildCues(List<Phase> phases) {
  final cues = <Cue>[];
  // Un changement de phase prime sur un bip de décompte au même instant.
  final startBoundaries = phaseStarts(phases).toSet();
  var start = 0;
  for (final phase in phases) {
    if (phase.type == PhaseType.effort || phase.type == PhaseType.prep) {
      for (final sec in const [3, 2, 1]) {
        final at = start - sec * 1000;
        if (at >= 0 && !startBoundaries.contains(at)) {
          cues.add(Cue(atMs: at, frequencyHz: countdownFrequencyHz, durationMs: 120));
        }
      }
    }
    cues.add(Cue(
      atMs: start,
      frequencyHz: phaseFrequencyHz(phase.type),
      durationMs: phase.type == PhaseType.effort ? 450 : 250,
    ));
    start += phase.durationMs;
  }
  // Court work/rest cycles may cause a countdown to fall earlier than the
  // preceding phase cue. Consumers require chronological events.
  cues.sort((a, b) => a.atMs.compareTo(b.atMs));
  return cues;
}

/// Moments at which the native system should start ducking music BEFORE a cue.
/// Multiple cues may share a preparation instant; always dispatch it once.
/// At t=0 no earlier preparation is possible without delaying the workout.
List<int> duckLeadTimes(List<Cue> cues, {int leadMs = 2000}) {
  assert(leadMs >= 0);
  final times = <int>{
    for (final cue in cues)
      if (cue.atMs >= leadMs) cue.atMs - leadMs,
  };
  return times.toList()..sort();
}

/// Instant de début de chaque phase, en millisecondes depuis le départ.
List<int> phaseStarts(List<Phase> phases) {
  final starts = <int>[];
  var t = 0;
  for (final phase in phases) {
    starts.add(t);
    t += phase.durationMs;
  }
  return starts;
}

/// Durée totale d'une séance, en millisecondes.
int totalDurationMs(List<Phase> phases) =>
    phases.fold<int>(0, (sum, p) => sum + p.durationMs);

/// Index de la phase active à l'instant [elapsedMs].
///
/// Recherche dichotomique sur les débuts de phase, avec [starts] trié
/// croissant. Au-delà de la fin, renvoie la dernière phase.
int phaseIndexAt(List<int> starts, int elapsedMs) {
  assert(starts.isNotEmpty);
  var lo = 0;
  var hi = starts.length - 1;
  while (lo < hi) {
    final mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= elapsedMs) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return lo;
}
