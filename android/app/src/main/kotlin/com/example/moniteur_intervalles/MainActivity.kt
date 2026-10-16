package com.example.moniteur_intervalles

import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack
import android.os.Build
import android.os.Handler
import android.os.Looper
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import kotlin.math.PI
import kotlin.math.exp
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

/**
 * Native cues for dojo / Taïso: external Spotify or Apple Music keep playing.
 * Request temporary MAY_DUCK focus only for the length of a cue, then release.
 * The OS determines actual attenuation; the application never controls the
 * third-party app volume.
 */
class MainActivity : FlutterActivity() {
    private val channelName = "jsb/native_audio"
    private val audioRate = 22050
    private val handler = Handler(Looper.getMainLooper())
    private lateinit var audioManager: AudioManager
    private var track: AudioTrack? = null
    private var focusRequest: AudioFocusRequest? = null
    private var legacyFocus = false
    private var finishTask: Runnable? = null
    private var playbackToken = 0

    override fun configureFlutterEngine(engine: FlutterEngine) {
        super.configureFlutterEngine(engine)
        audioManager = getSystemService(AUDIO_SERVICE) as AudioManager
        MethodChannel(engine.dartExecutor.binaryMessenger, channelName)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "playCue" -> {
                        val kind = call.argument<String>("cue") ?: "effort"
                        val volume = (call.argument<Int>("volume") ?: 90).coerceIn(0, 100)
                        val duck = call.argument<Boolean>("duckOthers") ?: true
                        result.success(playCue(kind, volume, duck))
                    }
                    else -> result.notImplemented()
                }
            }
    }

    private fun playCue(kind: String, volume: Int, duck: Boolean): Map<String, Any> {
        stopCurrent()
        if (volume == 0) return mapOf(
            "played" to false, "focusGranted" to false,
            "message" to "Volume réglé à zéro."
        )

        val focusGranted = if (duck) requestTemporaryDuck() else true
        if (!focusGranted) return mapOf(
            "played" to false, "focusGranted" to false,
            "message" to "Priorité audio refusée par Android."
        )

        return try {
            val duration = durationMs(kind)
            val samples = makeSamples(kind, volume, duration)
            val attributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
            val format = AudioFormat.Builder().setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                .setSampleRate(audioRate).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build()
            val buffer = max(
                samples.size * 2,
                AudioTrack.getMinBufferSize(
                    audioRate, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT
                )
            )
            val player = AudioTrack.Builder().setAudioAttributes(attributes)
                .setAudioFormat(format).setTransferMode(AudioTrack.MODE_STATIC)
                .setBufferSizeInBytes(buffer).build()
            val wrote = player.write(samples, 0, samples.size)
            if (wrote <= 0) {
                player.release()
                releaseFocus()
                return mapOf("played" to false, "focusGranted" to focusGranted,
                    "message" to "Écriture audio impossible.")
            }
            track = player
            player.play()
            val token = ++playbackToken
            val task = Runnable { if (token == playbackToken) stopCurrent() }
            finishTask = task
            handler.postDelayed(task, duration.toLong() + 120)
            mapOf("played" to true, "focusGranted" to focusGranted,
                "message" to if (duck) "Atténuation temporaire demandée." else "Sans atténuation.")
        } catch (error: Exception) {
            stopCurrent()
            mapOf("played" to false, "focusGranted" to false,
                "message" to (error.localizedMessage ?: "Son indisponible."))
        }
    }

    private fun requestTemporaryDuck(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val attributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build()
            val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                .setAudioAttributes(attributes)
                .setOnAudioFocusChangeListener { change ->
                    if (change == AudioManager.AUDIOFOCUS_LOSS ||
                        change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT) {
                        handler.post { stopCurrent() }
                    }
                }.build()
            val granted = audioManager.requestAudioFocus(request) ==
                AudioManager.AUDIOFOCUS_REQUEST_GRANTED
            if (granted) focusRequest = request
            granted
        } else {
            @Suppress("DEPRECATION")
            val granted = audioManager.requestAudioFocus(
                { change ->
                    if (change == AudioManager.AUDIOFOCUS_LOSS ||
                        change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT) {
                        handler.post { stopCurrent() }
                    }
                }, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK
            ) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
            legacyFocus = granted
            granted
        }
    }

    private fun releaseFocus() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            focusRequest?.let { audioManager.abandonAudioFocusRequest(it) }
            focusRequest = null
        } else if (legacyFocus) {
            @Suppress("DEPRECATION")
            audioManager.abandonAudioFocus(null)
            legacyFocus = false
        }
    }

    private fun stopCurrent() {
        playbackToken++
        finishTask?.let { handler.removeCallbacks(it) }
        finishTask = null
        track?.let { player ->
            try { player.pause(); player.flush() } catch (_: Exception) {}
            try { player.release() } catch (_: Exception) {}
        }
        track = null
        releaseFocus()
    }

    private fun durationMs(cue: String) = when (cue) {
        "finish" -> 3400
        "effort" -> 580
        "recovery" -> 340
        "countdown" -> 140
        else -> 240
    }

    /** Procedural audible cue, no external media or copyright recordings. */
    private fun makeSamples(cue: String, volume: Int, durationMs: Int): ShortArray {
        val frames = durationMs * audioRate / 1000
        val out = ShortArray(frames)
        val amplitude = volume / 100.0 * 0.70
        for (i in 0 until frames) {
            val time = i.toDouble() / audioRate
            val position = i.toDouble() / frames
            val envelope = when (cue) {
                "finish" -> exp(-4.5 * position) * min(1.0, time / 0.006)
                else -> min(1.0, time / 0.003) * (1.0 - position).coerceAtLeast(0.0)
            }
            val wave = when (cue) {
                "finish" -> 0.56 * sin(2 * PI * 196 * time) +
                    0.30 * sin(2 * PI * 287 * time) + 0.14 * sin(2 * PI * 407 * time)
                "recovery" -> sin(2 * PI * 590 * time)
                "countdown" -> sin(2 * PI * 1200 * time)
                "preparation" -> sin(2 * PI * 880 * time)
                else -> 0.70 * sin(2 * PI * 300 * time) +
                    0.30 * sin(2 * PI * 450 * time)
            }
            out[i] = (wave * envelope * amplitude * 32767).toInt()
                .coerceIn(-32767, 32767).toShort()
        }
        return out
    }

    override fun onDestroy() {
        stopCurrent()
        super.onDestroy()
    }
}
