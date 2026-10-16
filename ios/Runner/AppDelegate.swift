import Flutter
import UIKit
import AVFoundation

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  private var player: AVAudioPlayer?
  private var cueToken = 0
  // nil means no JSB audio session is currently active.
  // Avoid resetting the ducking session on each 3-2-1 countdown beep.
  private var activeDuckingMode: Bool?
  private let audio = AVAudioSession.sharedInstance()
  private var audioChannel: FlutterMethodChannel?

  // Flutter 3.41+ uses UIScene: AppDelegate.window can be nil during launch.
  // Register both plugins and the JSB channel only after the implicit engine
  // has been initialized, using the engine's own binary messenger.
  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
    let channel = FlutterMethodChannel(
      name: "jsb/native_audio",
      binaryMessenger: engineBridge.applicationRegistrar.messenger()
    )
    audioChannel = channel
    channel.setMethodCallHandler { [weak self] call, result in
      if call.method == "releaseDuck" {
        self?.releaseAudio()
        result(nil)
        return
      }
      if call.method == "prepareDuck" {
        let enabled = (call.arguments as? [String: Any])?["duckOthers"] as? Bool ?? true
        result(self?.prepareDuck(enabled: enabled) ??
          ["prepared": false, "message": "Audio indisponible."])
        return
      }
      guard call.method == "playCue" else {
        result(FlutterMethodNotImplemented)
        return
      }
      let args = call.arguments as? [String: Any] ?? [:]
      let cue = args["cue"] as? String ?? "effort"
      let volume = min(100, max(0, args["volume"] as? Int ?? 90))
      let duck = args["duckOthers"] as? Bool ?? true
      let preview = args["preview"] as? Bool ?? false
      let wavBase64 = args["wavBase64"] as? String
      result(self?.playCue(cue: cue, volume: volume, duck: duck, preview: preview, wavBase64: wavBase64) ??
        ["played": false, "focusGranted": false, "message": "Audio indisponible."])
    }
  }

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    // The engine and its messenger are not yet necessarily available here.
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  private func releaseAudio() {
    cueToken += 1
    player?.stop()
    player = nil
    // Only deactivate sessions that JSB activated. Avoid changing the state
    // of another plugin if JSB has no active sound.
    guard activeDuckingMode != nil else { return }
    activeDuckingMode = nil
    do {
      try audio.setActive(false, options: .notifyOthersOnDeactivation)
    } catch {
      NSLog("[JSB audio] Unable to deactivate temporary audio session: \\(error)")
    }
  }

  private func prepareDuck(enabled: Bool) -> [String: Any] {
    guard enabled else { return ["prepared": false, "message": "Atténuation désactivée."] }
    if activeDuckingMode == false { releaseAudio() }
    do {
      if activeDuckingMode == nil {
        try audio.setCategory(.playback, mode: .default, options: [.duckOthers])
        try audio.setActive(true)
        activeDuckingMode = true
      }
      // Failsafe longer than the 3 s lead-in plus a cue and its 3 s tail.
      // Flutter explicitly releases audio on pause/stop; this watchdog covers
      // unexpected missed callbacks without cutting the scheduled beep.
      cueToken += 1
      let token = cueToken
      DispatchQueue.main.asyncAfter(deadline: .now() + 7.0) { [weak self] in
        guard let self = self, self.cueToken == token else { return }
        self.releaseAudio()
      }
      return ["prepared": true,
              "duckConfigured": audio.categoryOptions.contains(.duckOthers),
              "message": "Atténuation demandée avant le signal."]
    } catch {
      releaseAudio()
      return ["prepared": false, "message": error.localizedDescription]
    }
  }

  private func playCue(cue: String, volume: Int, duck: Bool, preview: Bool, wavBase64: String?) -> [String: Any] {
    guard volume > 0 else {
      releaseAudio()
      return ["played": false, "focusGranted": false, "message": "Son coupé."]
    }

    // Consecutive countdown beeps should reuse the active mix/duck session.
    // Restarting AVAudioSession every 140 ms would prevent iOS from applying
    // an audible attenuation ramp before the next cue.
    if let previousMode = activeDuckingMode, previousMode != duck {
      releaseAudio()
    }
    cueToken += 1
    player?.stop()
    player = nil

    // This is only a hint from iOS, NOT evidence that Spotify will actually
    // change its volume (e.g. Spotify Connect may be rendering elsewhere).
    let otherAudioWasPlaying = audio.isOtherAudioPlaying
    do {
      let duration: Double
      switch cue {
      case "finish": duration = 3.4
      case "effort": duration = 0.58
      case "recovery": duration = 0.34
      case "countdown": duration = 0.14
      default: duration = 0.24
      }
      if activeDuckingMode == nil {
        // duckOthers implicitly sets mixWithOthers on the playback category.
        // It must be configured BEFORE activation to affect other sessions.
        let options: AVAudioSession.CategoryOptions =
          duck ? [.duckOthers] : [.mixWithOthers]
        try audio.setCategory(.playback, mode: .default, options: options)
      }

      // The restored JSB UI sends its original synthesized sound as WAV.
      // When absent, fall back to the validated iOS cue generator.
      let bytes = wavBase64.flatMap { Data(base64Encoded: $0) }
        ?? synthesize(cue: cue, duration: duration)
      let sound = try AVAudioPlayer(data: bytes)
      sound.volume = Float(volume) / 100.0
      sound.prepareToPlay()

      if activeDuckingMode == nil {
        try audio.setActive(true)
        activeDuckingMode = duck
      }

      let duckConfigured = audio.categoryOptions.contains(.duckOthers)
      let route = audio.currentRoute.outputs.map { $0.portType.rawValue }.joined(separator: ", ")
      guard sound.play() else {
        releaseAudio()
        return ["played": false, "focusGranted": false,
                "duckConfigured": duckConfigured,
                "otherAudioPlaying": otherAudioWasPlaying,
                "outputRoute": route,
                "message": "Lecture du signal impossible."]
      }
      player = sound
      let token = cueToken

      // Keep Spotify attenuated for 3 s AFTER the cue has finished.
      // Each subsequent cue extends this window, so a 3-2-1 countdown does
      // not cause volume pumping between short successive beeps.
      let realDuration = sound.duration
      let holdSeconds: Double = preview ? max(4.0, realDuration + 0.15) :
        realDuration + 3.0
      DispatchQueue.main.asyncAfter(deadline: .now() + holdSeconds) { [weak self] in
        guard let self = self, token == self.cueToken else { return }
        self.releaseAudio()
      }

      let status: String
      if !duck {
        status = "Mixage sans réduction demandé."
      } else if !duckConfigured {
        status = "iOS n'a pas conservé l'option duckOthers."
      } else if preview {
        status = "Atténuation iOS active pendant 4 secondes (intensité contrôlée par iOS)."
      } else {
        status = "DuckOthers configuré sur la session audio."
      }

      return ["played": true, "focusGranted": true,
              "duckConfigured": duckConfigured,
              "otherAudioPlaying": otherAudioWasPlaying,
              "outputRoute": route,
              "message": status]
    } catch {
      releaseAudio()
      return ["played": false, "focusGranted": false,
              "message": error.localizedDescription]
    }
  }

  /// Pure synthesized PCM 16-bit mono, packed into RIFF/WAV.
  private func synthesize(cue: String, duration: Double) -> Data {
    let sampleRate = 22050
    let count = Int(duration * Double(sampleRate))
    var wav = Data()
    func appendASCII(_ value: String) { wav.append(contentsOf: value.utf8) }
    func appendU16(_ value: UInt16) {
      let le = value.littleEndian
      withUnsafeBytes(of: le) { wav.append(contentsOf: $0) }
    }
    func appendU32(_ value: UInt32) {
      let le = value.littleEndian
      withUnsafeBytes(of: le) { wav.append(contentsOf: $0) }
    }
    appendASCII("RIFF"); appendU32(UInt32(36 + count * 2))
    appendASCII("WAVEfmt "); appendU32(16); appendU16(1); appendU16(1)
    appendU32(UInt32(sampleRate)); appendU32(UInt32(sampleRate * 2))
    appendU16(2); appendU16(16); appendASCII("data"); appendU32(UInt32(count * 2))

    for index in 0..<count {
      let t = Double(index) / Double(sampleRate)
      let progress = Double(index) / Double(count)
      let envelope: Double
      if cue == "finish" {
        envelope = exp(-4.5 * progress) * min(1, t / 0.006)
      } else {
        envelope = min(1, t / 0.003) * max(0, 1 - progress)
      }
      let sample: Double
      switch cue {
      case "finish":
        sample = 0.56 * sin(2 * .pi * 196 * t) +
                 0.30 * sin(2 * .pi * 287 * t) +
                 0.14 * sin(2 * .pi * 407 * t)
      case "recovery": sample = sin(2 * .pi * 590 * t)
      case "countdown": sample = sin(2 * .pi * 1200 * t)
      case "preparation": sample = sin(2 * .pi * 880 * t)
      default:
        sample = 0.70 * sin(2 * .pi * 300 * t) + 0.30 * sin(2 * .pi * 450 * t)
      }
      // Preserve headroom for overlapping partials while making JSB cues
      // more prominent. This gain affects only JSB, not Spotify.
      let value = Int16(max(-32767, min(32767, Int(sample * envelope * 28500))))
      appendU16(UInt16(bitPattern: value))
    }
    return wav
  }

  override func applicationWillTerminate(_ application: UIApplication) {
    releaseAudio()
    super.applicationWillTerminate(application)
  }
}
