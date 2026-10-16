/// Modèle de séance par intervalles (Tabata, HIIT, EMOM, AMRAP, boxe).
///
/// Logique pure Dart : aucune dépendance Flutter, donc testable sans appareil.
library;

/// Type de phase, utilisé pour la couleur, le bip et la vibration.
enum PhaseType { prep, effort, rest, end }

/// Une phase précise de la séance, avec sa durée en millisecondes.
class Phase {
  const Phase({
    required this.type,
    required this.label,
    required this.durationMs,
    required this.cycle,
    required this.totalCycles,
  });

  final PhaseType type;

  /// Libellé affiché en capitales (EFFORT, PRÉPA, REPOS, FIN).
  /// Une couleur n'indique jamais seule une phase.
  final String label;
  final int durationMs;

  /// Numéro du cycle en cours (0 pour la préparation).
  final int cycle;
  final int totalCycles;
}

/// Paramètres d'une séance, saisis en secondes.
class Preset {
  const Preset({
    required this.name,
    required this.prepSec,
    required this.workSec,
    required this.restSec,
    required this.cycles,
  })  : assert(prepSec >= 0),
        assert(workSec > 0),
        assert(restSec >= 0),
        assert(cycles >= 1);

  final String name;
  final int prepSec;
  final int workSec;
  final int restSec;
  final int cycles;
}

/// Construit la liste ordonnée des phases d'une séance.
///
/// Ordre : préparation (si > 0), puis pour chaque cycle l'effort, suivi du
/// repos sauf après le dernier cycle, et enfin une courte phase de fin.
List<Phase> buildPhases(Preset preset) {
  final phases = <Phase>[];

  if (preset.prepSec > 0) {
    phases.add(Phase(
      type: PhaseType.prep,
      label: 'PRÉPA',
      durationMs: preset.prepSec * 1000,
      cycle: 0,
      totalCycles: preset.cycles,
    ));
  }

  for (var i = 1; i <= preset.cycles; i++) {
    phases.add(Phase(
      type: PhaseType.effort,
      label: 'EFFORT',
      durationMs: preset.workSec * 1000,
      cycle: i,
      totalCycles: preset.cycles,
    ));
    if (i < preset.cycles && preset.restSec > 0) {
      phases.add(Phase(
        type: PhaseType.rest,
        label: 'REPOS',
        durationMs: preset.restSec * 1000,
        cycle: i,
        totalCycles: preset.cycles,
      ));
    }
  }

  phases.add(Phase(
    type: PhaseType.end,
    label: 'FIN',
    durationMs: 1500,
    cycle: preset.cycles,
    totalCycles: preset.cycles,
  ));

  return phases;
}

/// Présets intégrés. Valeurs de référence, modifiables par l'utilisateur.
const List<Preset> builtInPresets = [
  Preset(name: 'Tabata classique', prepSec: 10, workSec: 20, restSec: 10, cycles: 8),
  Preset(name: 'HIIT 40/20', prepSec: 10, workSec: 40, restSec: 20, cycles: 10),
  Preset(name: 'EMOM 10 min', prepSec: 5, workSec: 60, restSec: 0, cycles: 10),
  Preset(name: 'AMRAP 5 min', prepSec: 5, workSec: 300, restSec: 0, cycles: 1),
  Preset(name: 'Boxe 3 × 3 min', prepSec: 10, workSec: 180, restSec: 60, cycles: 3),
];
