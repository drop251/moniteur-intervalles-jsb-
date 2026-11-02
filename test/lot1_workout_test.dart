import 'package:flutter_test/flutter_test.dart';
import 'package:moniteur_intervalles/main.dart';

void main() {
  test('Tabata sans repos final', () {
    const workout = Workout('Tabata', 10, 20, 10, 8);
    final phases = phasesFor(workout);
    expect(workout.seconds, 240);
    expect(phases.length, 16);
    expect(phases.last.label, 'EFFORT');
    expect(phases.last.cycle, 8);
  });

  test('HIIT sans repos ni préparation', () {
    const workout = Workout('HIIT', 0, 30, 0, 2);
    expect(workout.seconds, 60);
    expect(phasesFor(workout).length, 2);
  });
}
