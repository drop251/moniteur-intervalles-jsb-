import 'package:flutter_test/flutter_test.dart';
import 'package:moniteur_intervalles/engine/phase_clock.dart';

/// Horloge contrôlable pour tester sans attendre.
class _FakeStopwatch implements Stopwatch {
  int _elapsedUs = 0;
  bool _running = false;

  void advance(int ms) {
    if (_running) _elapsedUs += ms * 1000;
  }

  @override
  int get elapsedMilliseconds => _elapsedUs ~/ 1000;
  @override
  int get elapsedMicroseconds => _elapsedUs;
  @override
  int get elapsedTicks => _elapsedUs;
  @override
  Duration get elapsed => Duration(microseconds: _elapsedUs);
  @override
  bool get isRunning => _running;
  @override
  void start() => _running = true;
  @override
  void stop() => _running = false;
  @override
  void reset() => _elapsedUs = 0;
  @override
  int get frequency => 1000000;
}

void main() {
  test('Le temps ne progresse pas pendant la pause', () {
    final watch = _FakeStopwatch();
    final clock = PhaseClock(stopwatch: watch);

    clock.start();
    watch.advance(5000);
    clock.pause();
    watch.advance(3000); // pause : ne doit pas compter
    expect(clock.elapsedMs, 5000);

    clock.start();
    watch.advance(2000);
    expect(clock.elapsedMs, 7000);
  });

  test('stop() renvoie le temps écoulé et remet l\'horloge à zéro', () {
    final watch = _FakeStopwatch();
    final clock = PhaseClock(stopwatch: watch);

    clock.start();
    watch.advance(1500);
    expect(clock.stop(), 1500);
    expect(clock.isRunning, isFalse);
  });
}
