import 'package:flutter_test/flutter_test.dart';
import 'package:moniteur_intervalles/app/jsb_web_home_screen.dart';

void main() {
  test('L’interface JSB hors ligne autorise ses assets iOS et Android', () {
    expect(isAllowedLocalJsbNavigation(
      'file:///var/mobile/Containers/assets/web/index.html'), isTrue);
    expect(isAllowedLocalJsbNavigation('about:blank'), isTrue);
    expect(isAllowedLocalJsbNavigation(
      'https://appassets.androidplatform.net/assets/flutter_assets/assets/web/index.html'),
      isTrue);
  });

  test('Les destinations externes et imitations du domaine local sont bloquées', () {
    for (final url in [
      'https://spotify.com',
      'https://appassets.androidplatform.net.evil.com/assets/web/index.html',
      'http://appassets.androidplatform.net/assets/web/index.html',
      'https://appassets.androidplatform.net/outside/index.html',
      'javascript:alert(1)',
      'data:text/html,test',
      'https://example.com',
    ]) {
      expect(isAllowedLocalJsbNavigation(url), isFalse, reason: url);
    }
  });
}
