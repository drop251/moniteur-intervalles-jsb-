/// Protocole du test de course navette (Luc Léger), 20 m.
///
/// Règles du protocole standard :
/// - vitesse de départ 8,5 km/h, +0,5 km/h à chaque palier ;
/// - un palier dure environ 60 secondes ;
/// - une navette à v km/h dure 72 / v secondes (20 m à v km/h).
///
/// Le nombre de navettes par palier est dérivé de ces règles. Il doit être
/// vérifié palier par palier contre la table imprimée avant mise en production.
library;

/// Un palier du test : vitesse et nombre de navettes.
class LegerLevel {
  const LegerLevel({
    required this.level,
    required this.speedKmh,
    required this.shuttles,
  });

  /// Numéro du palier, à partir de 1.
  final int level;
  final double speedKmh;
  final int shuttles;

  /// Durée d'une navette à cette vitesse, en millisecondes.
  double get shuttleMs => shuttleDurationMs(speedKmh);
}

/// Une navette planifiée sur la chronologie du test.
class Shuttle {
  const Shuttle({
    required this.startMs,
    required this.endMs,
    required this.levelIndex,
    required this.index,
    required this.isLastOfLevel,
  });

  final double startMs;
  final double endMs;

  /// Index du palier dans la liste des paliers (0-based).
  final int levelIndex;

  /// Numéro de la navette dans son palier, à partir de 1.
  final int index;

  /// Vrai pour la dernière navette d'un palier : bip de changement de palier.
  final bool isLastOfLevel;

  double get durationMs => endMs - startMs;
}

/// Durée d'une navette de 20 m à [speedKmh], en millisecondes.
double shuttleDurationMs(double speedKmh) {
  assert(speedKmh > 0, 'La vitesse doit être strictement positive');
  return 72 / speedKmh * 1000;
}

/// Construit les paliers du protocole standard.
///
/// [levelCount] : nombre de paliers à générer.
List<LegerLevel> standardLegerLevels({int levelCount = 21}) {
  assert(levelCount >= 1);
  return List<LegerLevel>.generate(levelCount, (i) {
    final speed = 8.5 + 0.5 * i;
    // Palier d'environ 60 s : nombre de navettes le plus proche de 60 s.
    // Les demi-entiers sont arrondis vers le haut, comme dans les tables usuelles.
    final shuttles = (60000 / shuttleDurationMs(speed)).round();
    return LegerLevel(
      level: i + 1,
      speedKmh: speed,
      shuttles: shuttles < 1 ? 1 : shuttles,
    );
  });
}

/// Déroule les paliers en une chronologie de navettes, en millisecondes
/// depuis le départ.
List<Shuttle> buildLegerSchedule(List<LegerLevel> levels) {
  final shuttles = <Shuttle>[];
  var t = 0.0;
  for (var li = 0; li < levels.length; li++) {
    final level = levels[li];
    final duration = level.shuttleMs;
    for (var k = 1; k <= level.shuttles; k++) {
      shuttles.add(Shuttle(
        startMs: t,
        endMs: t + duration,
        levelIndex: li,
        index: k,
        isLastOfLevel: k == level.shuttles,
      ));
      t += duration;
    }
  }
  return shuttles;
}

/// Résultat d'un test arrêté à [elapsedMs].
class LegerResult {
  const LegerResult({
    required this.lastCompletedLevel,
    required this.validatedShuttles,
  });

  /// Dernier palier entièrement terminé, ou null si aucun.
  final LegerLevel? lastCompletedLevel;

  /// Nombre de navettes terminées.
  final int validatedShuttles;
}

/// Calcule le résultat à l'instant [elapsedMs].
LegerResult legerResultAt({
  required List<LegerLevel> levels,
  required List<Shuttle> schedule,
  required double elapsedMs,
}) {
  LegerLevel? last;
  var validated = 0;
  for (final s in schedule) {
    if (s.endMs <= elapsedMs) {
      validated++;
      if (s.isLastOfLevel) last = levels[s.levelIndex];
    }
  }
  return LegerResult(lastCompletedLevel: last, validatedShuttles: validated);
}
