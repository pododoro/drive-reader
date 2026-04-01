import ExpoModulesCore
import AVFoundation

// iOS scaffold for the same LocalTts contract used on Android.
// This file is intentionally kept in the repository even though the iOS
// project directory is not present yet. Once the ios project is generated,
// this module can be moved into the app target and completed with
// AVSpeechSynthesizer.write(...) based file generation.
public final class LocalTtsModule: Module {
  private let synthesizer = AVSpeechSynthesizer()

  public func definition() -> ModuleDefinition {
    Name("LocalTts")

    AsyncFunction("synthesize") { (_: [String: Any]) -> [String: Any] in
      throw Exception(
        name: "E_IOS_SCAFFOLD_ONLY",
        description: "iOS LocalTts is scaffolded in source but the ios project is not generated yet."
      )
    }

    AsyncFunction("stop") { () in
      self.synthesizer.stopSpeaking(at: .immediate)
      return
    }

    AsyncFunction("clear") { () in
      return
    }
  }
}
