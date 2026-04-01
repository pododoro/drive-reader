package com.anonymous.drivereader

import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.net.Uri
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.util.Locale
import java.util.UUID

class LocalTtsModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {
  private data class PendingRequest(
      val text: String,
      val rate: Float,
      val pitch: Float,
      val language: String?,
      val promise: Promise,
      val outputFile: File,
      val utteranceId: String,
  )

  private val mainHandler = Handler(Looper.getMainLooper())
  private val generatedFiles = mutableSetOf<File>()

  private var tts: TextToSpeech? = null
  private var isInitializing = false
  private var activeRequest: PendingRequest? = null
  override fun getName(): String = NAME

  @ReactMethod
  fun synthesize(request: ReadableMap, promise: Promise) {
    mainHandler.post {
      val text = request.getString("text")?.trim().orEmpty()
      if (text.isEmpty()) {
        promise.reject("E_EMPTY_TEXT", "Text cannot be empty.")
        return@post
      }

      if (activeRequest != null) {
        promise.reject("E_BUSY", "Local TTS is already synthesizing audio.")
        return@post
      }

      val outputDir = File(reactContext.cacheDir, "local-tts")
      if (!outputDir.exists()) {
        outputDir.mkdirs()
      }

      val outputFile = File(outputDir, "tts-${UUID.randomUUID()}.wav")
      val pendingRequest = PendingRequest(
          text = text,
          rate = request.getDoubleOrDefault("rate", 0.96).toFloat(),
          pitch = request.getDoubleOrDefault("pitch", 1.0).toFloat(),
          language = request.getString("language"),
          promise = promise,
          outputFile = outputFile,
          utteranceId = UUID.randomUUID().toString(),
      )

      activeRequest = pendingRequest
      generatedFiles.add(outputFile)
      ensureTts()
      if (tts != null && !isInitializing) {
        startPendingRequest()
      }
    }
  }

  @ReactMethod
  fun stop(promise: Promise) {
    mainHandler.post {
      activeRequest?.let { request ->
        request.promise.reject("E_STOPPED", "Local TTS synthesis stopped.")
      }
      activeRequest = null
      tts?.stop()
      promise.resolve(null)
    }
  }

  @ReactMethod
  fun clear(promise: Promise) {
    mainHandler.post {
      generatedFiles.toList().forEach { file ->
        runCatching {
          if (file.exists()) {
            file.delete()
          }
        }
      }
      generatedFiles.clear()
      promise.resolve(null)
    }
  }

  private fun ensureTts() {
    if (tts != null || isInitializing) {
      return
    }

    isInitializing = true
    tts = TextToSpeech(reactContext) { status ->
      isInitializing = false
      if (status != TextToSpeech.SUCCESS) {
        activeRequest?.promise?.reject("E_TTS_INIT", "Unable to initialize the local TTS engine.")
        activeRequest = null
        return@TextToSpeech
      }

      tts?.setOnUtteranceProgressListener(
          object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) = Unit

            override fun onDone(utteranceId: String?) {
              mainHandler.post {
                val request = activeRequest
                if (request == null || request.utteranceId != utteranceId) {
                  return@post
                }

                request.promise.resolve(
                    Arguments.createMap().apply {
                      putString("uri", Uri.fromFile(request.outputFile).toString())
                      putString("title", "Drive Reader")
                      putString("artist", "Local TTS")
                    }
                )
                activeRequest = null
              }
            }

            override fun onError(utteranceId: String?) {
              mainHandler.post {
                val request = activeRequest
                if (request == null || request.utteranceId != utteranceId) {
                  return@post
                }

                request.promise.reject("E_TTS_SYNTHESIS", "Unable to synthesize audio.")
                activeRequest = null
              }
            }
          }
      )

      startPendingRequest()
    }
  }

  private fun startPendingRequest() {
    val request = activeRequest ?: return
    val engine = tts ?: return

    val languageTag = request.language?.takeIf { it.isNotBlank() }
    if (languageTag != null) {
      runCatching {
        engine.setLanguage(Locale.forLanguageTag(languageTag))
      }
    }

    engine.setSpeechRate(request.rate)
    engine.setPitch(request.pitch)

    val synthResult = engine.synthesizeToFile(
        request.text,
        null,
        request.outputFile,
        request.utteranceId,
    )

    if (synthResult != TextToSpeech.SUCCESS) {
      request.promise.reject("E_TTS_SYNTHESIS", "Unable to synthesize audio.")
      activeRequest = null
      return
    }
  }

  private fun ReadableMap.getDoubleOrDefault(name: String, defaultValue: Double): Double {
    return if (hasKey(name) && !isNull(name)) {
      getDouble(name)
    } else {
      defaultValue
    }
  }

  companion object {
    private const val NAME = "LocalTts"
  }
}
