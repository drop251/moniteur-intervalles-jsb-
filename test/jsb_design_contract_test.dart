import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  test('JSB mobile bundles the three primary timer interfaces', () {
    final html = File('assets/web/index.html').readAsStringSync();
    expect(html, contains('data-nav="randori"'));
    expect(html, contains('data-nav="tabata"'));
    expect(html, contains('data-nav="chrono"'));
    expect(html, contains('tabataExercisesField'));
    expect(html, contains('tabataCycleRestField'));
    expect(html, contains('randoriRandomBips'));
    expect(html, contains('adjustTimeBtn'));
    expect(html, contains("make('section','jsb-home-hero')"));
    expect(html, contains("jsb_interface_v4.css"));
  });

  test('native audio bridge remains active without a service worker', () {
    final html = File('assets/web/index.html').readAsStringSync();
    expect(html, contains('jsb_native_bridge.js'));
    expect(html, contains('pause_adjustments.js'));
    expect(html, isNot(contains('serviceWorker.register')));
    expect(File('assets/web/jsb_native_bridge.js').existsSync(), isTrue);
  });

  test('activity/rest states follow JSB navy and gold identity', () {
    final css = File('assets/web/jsb_refinement.css').readAsStringSync();
    final html = File('assets/web/index.html').readAsStringSync();
    expect(css, contains('--jsb-navy:#1F2839'));
    expect(css, contains('--jsb-gold:#D9B175'));
    expect(css, contains('#timer.timer[data-phase="rest"]'));
    expect(css, contains('grid-template-columns:repeat(3,minmax(0,1fr))'));
    final home = File('assets/web/jsb_interface_v4.css').readAsStringSync();
    expect(home, contains('.jsb-home-time'));
    expect(home, contains('.jsb-home-start'));
    expect(home, contains('.jsb-home-config'));
    expect(home, contains('grid-template-columns:repeat(3,minmax(0,1fr))'));
    expect(html, contains("'ACTIVITÉ · '+p.label"));
    expect(html, contains("'REPOS · '+p.label"));
  });
}
