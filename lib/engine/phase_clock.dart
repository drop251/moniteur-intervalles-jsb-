/// Horloge de séance sans dérive.
///
/// Le temps est mesuré par un [Stopwatch] (horloge monotone, insensible au
/// changement d'heure). Les instants sont des échéances absolues calculées
/// depuis le départ : aucune erreur ne s'accumule d'une phase à l'autre.
///
/// Cette classe ne joue aucun son. Elle indique seulement le temps écoulé.
/// La lecture des bips est confiée à la couche audio native, qui les planifie
/// sur son propre horloge, quelques centaines de millisecondes à l'avance.
library;

class PhaseClock {
  PhaseClock({Stopwatch? stopwatch}) : _watch = stopwatch ?? Stopwatch();

  final Stopwatch _watch;

  /// Temps écoulé à la dernière pause, ou null si l'horloge n'a pas été mise
  /// en pause depuis le démarrage.
  int? _frozenMs;

  bool get isRunning => _watch.isRunning;

  /// Temps écoulé en millisecondes depuis le démarrage, sans compter les pauses.
  int get elapsedMs => _frozenMs ?? _watch.elapsedMilliseconds;

  /// Démarre ou reprend l'horloge.
  void start() {
    if (_watch.isRunning) return;
    _frozenMs = null;
    _watch.start();
  }

  /// Met l'horloge en pause. Le temps est figé jusqu'à la reprise.
  void pause() {
    if (!_watch.isRunning) return;
    _frozenMs = _watch.elapsedMilliseconds;
    _watch.stop();
  }

  /// Arrête l'horloge et renvoie le temps écoulé.
  int stop() {
    final ms = elapsedMs;
    _watch
      ..stop()
      ..reset();
    _frozenMs = ms;
    return ms;
  }

  /// Remet l'horloge à zéro, prête pour une nouvelle séance.
  void reset() {
    _watch
      ..stop()
      ..reset();
    _frozenMs = null;
  }
}
