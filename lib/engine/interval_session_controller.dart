/// Contrôleur déterministe d'une séance à intervalles.
///
/// Ce contrôleur ne dépend ni de Flutter, ni d'un Timer périodique.
/// La source de vérité est une horloge monotone et les échéances absolues.
library;

import '../domain/interval_plan.dart';
import 'phase_clock.dart';
import 'schedule.dart';

enum SessionStatus { ready, running, paused, completed, stopped }

class SessionSnapshot {
  const SessionSnapshot({
    required this.status,
    required this.phase,
    required this.phaseIndex,
    required this.elapsedMs,
    required this.remainingMs,
    required this.phaseElapsedMs,
    required this.totalMs,
  });

  final SessionStatus status;
  final Phase phase;
  final int phaseIndex;
  final int elapsedMs;
  final int remainingMs;
  final int phaseElapsedMs;
  final int totalMs;

  double get phaseProgress =>
      phase.durationMs == 0 ? 1 : (phaseElapsedMs / phase.durationMs).clamp(0.0, 1.0);
  double get totalProgress => totalMs == 0 ? 1 : (elapsedMs / totalMs).clamp(0.0, 1.0);
}

/// Retour d'un échantillonnage : les sons échus sont des indications uniquement.
/// Le backend audio natif devra remplacer leur émission par rafraîchissement UI.
class SessionUpdate {
  const SessionUpdate({
    required this.snapshot,
    required this.enteredPhases,
    required this.dueCues,
    required this.dueDuckLeads,
  });
  final SessionSnapshot snapshot;
  final List<Phase> enteredPhases;
  final List<Cue> dueCues;
  final List<int> dueDuckLeads;
}

class IntervalSessionController {
  IntervalSessionController({
    required List<Phase> phases,
    PhaseClock? clock,
    this.maxCueDelayMs = 180,
  })  : assert(phases.isNotEmpty),
        assert(maxCueDelayMs >= 0),
        _phases = List.unmodifiable(phases),
        _clock = clock ?? PhaseClock(),
        _starts = List.unmodifiable(phaseStarts(phases)),
        _cues = List.unmodifiable(buildCues(phases)),
        _duckLeads = List.unmodifiable(duckLeadTimes(buildCues(phases))),
        _totalMs = totalDurationMs(phases);

  final List<Phase> _phases;
  final PhaseClock _clock;
  final List<int> _starts;
  final List<Cue> _cues;
  final List<int> _duckLeads;
  final int _totalMs;

  /// Un signal ancien est abandonné plutôt que joué très en retard.
  final int maxCueDelayMs;

  SessionStatus _status = SessionStatus.ready;
  int _nextCueIndex = 0;
  int _nextDuckLeadIndex = 0;
  int _lastPhaseIndex = -1;

  SessionStatus get status => _status;
  int get totalMs => _totalMs;

  /// Called when resuming, so the UI can re-arm a duck window already
  /// entered before the user paused the workout (3-second lead-in).
  bool get hasCueWithinDuckLead {
    if (_status != SessionStatus.running) return false;
    final now = _clock.elapsedMs;
    return _cues.any((cue) => cue.atMs >= now && cue.atMs - now <= 3000);
  }

  void start() {
    if (_status != SessionStatus.ready) return;
    _clock.start();
    _status = SessionStatus.running;
  }

  void pause() {
    if (_status != SessionStatus.running) return;
    _clock.pause();
    _status = SessionStatus.paused;
  }

  void resume() {
    if (_status != SessionStatus.paused) return;
    _clock.start();
    _status = SessionStatus.running;
  }

  void stop() {
    if (_status == SessionStatus.completed || _status == SessionStatus.stopped) return;
    _clock.stop();
    _status = SessionStatus.stopped;
  }

  SessionSnapshot get snapshot => _snapshot();

  SessionSnapshot _snapshot() {
    final elapsed = _clock.elapsedMs.clamp(0, _totalMs).toInt();
    final phaseIndex = phaseIndexAt(_starts, elapsed);
    final phase = _phases[phaseIndex];
    final phaseElapsed = (elapsed - _starts[phaseIndex]).clamp(0, phase.durationMs).toInt();
    return SessionSnapshot(
      status: _status,
      phase: phase,
      phaseIndex: phaseIndex,
      elapsedMs: elapsed,
      remainingMs: phase.durationMs - phaseElapsed,
      phaseElapsedMs: phaseElapsed,
      totalMs: _totalMs,
    );
  }

  /// À appeler depuis un rafraîchissement de l'UI; ne détermine pas le temps.
  SessionUpdate sample() {
    if (_status == SessionStatus.ready || _status == SessionStatus.stopped) {
      return SessionUpdate(snapshot: _snapshot(), enteredPhases: const [], dueCues: const [], dueDuckLeads: const []);
    }
    if (_status == SessionStatus.paused || _status == SessionStatus.completed) {
      return SessionUpdate(snapshot: _snapshot(), enteredPhases: const [], dueCues: const [], dueDuckLeads: const []);
    }

    final now = _clock.elapsedMs;
    final newlyEntered = <Phase>[];
    final nextPhase = phaseIndexAt(_starts, now.clamp(0, _totalMs).toInt());
    if (nextPhase > _lastPhaseIndex) {
      for (var i = _lastPhaseIndex + 1; i <= nextPhase; i++) {
        newlyEntered.add(_phases[i]);
      }
      _lastPhaseIndex = nextPhase;
    }

    final dueCues = <Cue>[];
    while (_nextCueIndex < _cues.length && _cues[_nextCueIndex].atMs <= now) {
      final cue = _cues[_nextCueIndex++];
      if (now - cue.atMs <= maxCueDelayMs) dueCues.add(cue);
    }

    final dueDuckLeads = <int>[];
    while (_nextDuckLeadIndex < _duckLeads.length &&
        _duckLeads[_nextDuckLeadIndex] <= now) {
      final instant = _duckLeads[_nextDuckLeadIndex++];
      if (now - instant <= maxCueDelayMs) dueDuckLeads.add(instant);
    }

    if (now >= _totalMs) {
      _status = SessionStatus.completed;
      _clock.pause();
    }

    return SessionUpdate(
      snapshot: _snapshot(),
      enteredPhases: List.unmodifiable(newlyEntered),
      dueCues: List.unmodifiable(dueCues),
      dueDuckLeads: List.unmodifiable(dueDuckLeads),
    );
  }
}
