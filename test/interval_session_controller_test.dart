import 'package:flutter_test/flutter_test.dart';
import 'package:moniteur_intervalles/domain/interval_plan.dart';
import 'package:moniteur_intervalles/engine/interval_session_controller.dart';
import 'package:moniteur_intervalles/engine/phase_clock.dart';

class FakeStopwatch implements Stopwatch {
  int elapsedValueMs = 0;
  bool running = false;
  void advance(int milliseconds) { if (running) elapsedValueMs += milliseconds; }
  @override int get elapsedMilliseconds => elapsedValueMs;
  @override int get elapsedMicroseconds => elapsedValueMs * 1000;
  @override int get elapsedTicks => elapsedValueMs * 1000;
  @override Duration get elapsed => Duration(milliseconds: elapsedMilliseconds);
  @override bool get isRunning => running;
  @override int get frequency => 1000000;
  @override void start() { running = true; }
  @override void stop() { running = false; }
  @override void reset() { elapsedValueMs = 0; }
}

void main() {
  const preset = Preset(
    name: 'test', prepSec: 3, workSec: 5, restSec: 2, cycles: 2,
  );
  late FakeStopwatch stopwatch;
  late IntervalSessionController controller;

  setUp(() {
    stopwatch = FakeStopwatch();
    controller = IntervalSessionController(
      phases: buildPhases(preset),
      clock: PhaseClock(stopwatch: stopwatch),
    );
  });

  test('durée totale et progression de phase', () {
    expect(controller.totalMs, 16500);
    controller.start();
    stopwatch.advance(1000);
    final snapshot = controller.sample().snapshot;
    expect(snapshot.phase.type, PhaseType.prep);
    expect(snapshot.remainingMs, 2000);
    expect(snapshot.phaseProgress, closeTo(1 / 3, 0.0001));
  });

  test('les changements de phase reposent sur le temps absolu', () {
    controller.start();
    controller.sample();
    stopwatch.advance(8500);
    final update = controller.sample();
    expect(update.snapshot.phase.type, PhaseType.rest);
    expect(update.snapshot.phase.cycle, 1);
    expect(update.snapshot.remainingMs, 1500);
    expect(update.enteredPhases.map((p) => p.type),
      [PhaseType.effort, PhaseType.rest]);
    // Les signaux anciens ne doivent jamais être joués en rafale.
    expect(update.dueCues, isEmpty);
  });

  test('pause et reprise conservent les échéances', () {
    controller.start();
    stopwatch.advance(3500);
    controller.sample();
    controller.pause();
    stopwatch.advance(30000);
    expect(controller.sample().snapshot.elapsedMs, 3500);
    controller.resume();
    stopwatch.advance(1500);
    expect(controller.sample().snapshot.elapsedMs, 5000);
  });

  test('un signal sonore est émis au plus une fois', () {
    controller.start();
    final first = controller.sample();
    expect(first.dueCues.length, 1);
    expect(controller.sample().dueCues, isEmpty);
  });

  test('pré-atténuation avant le décompte d\'effort', () {
    controller.start();
    controller.sample();
    stopwatch.advance(4900);
    controller.sample();
    // Le deuxième effort débute à 10 s; premier décompte à 7 s.
    // La préparation de ce premier bip arrive à 5 s.
    stopwatch.advance(80);
    expect(controller.sample().dueDuckLeads, isEmpty);
    stopwatch.advance(40);
    expect(controller.sample().dueDuckLeads, [5000]);
    expect(controller.sample().dueDuckLeads, isEmpty);
  });

  test('fin de séance sans dérive', () {
    controller.start();
    stopwatch.advance(16500);
    final result = controller.sample();
    expect(result.snapshot.status, SessionStatus.completed);
    expect(result.snapshot.elapsedMs, 16500);
    expect(controller.sample().snapshot.status, SessionStatus.completed);
  });

  test('arrêt manuel définit un état distinct', () {
    controller.start();
    stopwatch.advance(700);
    controller.stop();
    expect(controller.sample().snapshot.status, SessionStatus.stopped);
    expect(controller.sample().dueCues, isEmpty);
  });
}
