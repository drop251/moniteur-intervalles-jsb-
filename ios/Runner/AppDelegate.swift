import Flutter
import UIKit
import AVFoundation

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  private var player: AVAudioPlayer?
  private var cueToken = 0
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
      guard call.method == "playCue" else {
        result(FlutterMethodNotImplemented)
        return
      }
      let args = call.arguments as? [String: Any] ?? [:]
      let cue = args["cue"] as? String ?? "effort"
      let volume = min(100, max(0, args["volume"] as? Int ?? 90))
      let duck = args["duckOthers"] as? Bool ?? true
      result(self?.playCue(cue: cue, volume: volume, duck: duck) ??
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
    try? audio.setActive(false, options: .notifyOthersOnDeactivation)
  }

  private func playCue(cue: String, volume: Int, duck: Bool) -> [String: Any] {
    releaseAudio()
    guard volume > 0 else {
      return ["played": false, "focusGranted": false, "message": "Son coupé."]
    }
    do {
      var options: AVAudioSession.CategoryOptions = [.mixWithOthers]
      if duck { options.insert(.duckOthers) }
      try audio.setCategory(.playback, mode: .default, options: options)
      try audio.setActive(true)
      let duration: Double
      switch cue {
      case "finish": duration = 3.4
      case "effort": duration = 0.58
      case "recovery": duration = 0.34
      case "countdown": duration = 0.14
      default: duration = 0.24
      }
      let bytes = synthesize(cue: cue, duration: duration)
      let sound = try AVAudioPlayer(data: bytes)
      sound.volume = Float(volume) / 100.0
      sound.prepareToPlay()
      guard sound.play() else {
        releaseAudio()
        return ["played": false, "focusGranted": false, "message": "Lecture impossible."]
      }
      player = sound
      let token = cueToken
      DispatchQueue.main.asyncAfter(deadline: .now() + duration + 0.1) { [weak self] in
        guard let self = self, token == self.cueToken else { return }
        self.releaseAudio()
      }
      return ["played": true, "focusGranted": true,
              "message": duck ? "Atténuation temporaire demandée." : "Mixage sans atténuation."]
    } catch {
      releaseAudio()
      return ["played": false, "focusGranted": false, "message": error.localizedDescription]
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
      let value = Int16(max(-32767, min(32767, Int(sample * envelope * 23000))))
      appendU16(UInt16(bitPattern: value))
    }
    return wav
  }

  override func applicationWillTerminate(_ application: UIApplication) {
    releaseAudio()
    super.applicationWillTerminate(application)
  }
}
