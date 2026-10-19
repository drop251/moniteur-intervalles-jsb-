import 'package:flutter/services.dart' show rootBundle;
import 'package:flutter_test/flutter_test.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('Le minuteur inclut un layout paysage dédié et le chrono visible', () async {
    final html = await rootBundle.loadString('assets/web/index.html');

    expect(html, contains('class="timer-controls"'));
    expect(html, contains('@media (orientation:landscape)'));
    expect(html, contains('grid-template-columns:minmax(0,1fr)'));
    expect(html, contains('safe-area-inset-left'));
    expect(html, contains('safe-area-inset-right'));
    expect(html, contains('.timer .clock[data-digits="7"]'));
    expect(html, contains("dataset.digits=String(display.length)"));

    // La correction responsive ne doit pas supprimer les actions importantes.
    expect(html, contains('id="clockText"'));
    expect(html, contains('id="pauseBtn"'));
    expect(html, contains('id="stopBtn"'));
    expect(html, contains('id="phaseLabel"'));
  });
}
