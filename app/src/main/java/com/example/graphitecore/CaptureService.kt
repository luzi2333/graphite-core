package com.example.graphitecore

import android.app.Activity
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioPlaybackCaptureConfiguration
import android.media.AudioRecord
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import kotlin.math.max

/**
 * 前台服务：拿 MediaProjection token，用 AudioPlaybackCapture 抓系统混音，
 * 做 FFT 后通过 CaptureBus 推给 WebView。
 */
class CaptureService : Service() {

    private var projection: MediaProjection? = null
    private var record: AudioRecord? = null
    private var worker: Thread? = null
    private var sampleRate = 48000

    @Volatile
    private var running = false

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startAsForeground()

        val code = intent?.getIntExtra("code", Activity.RESULT_CANCELED) ?: Activity.RESULT_CANCELED
        @Suppress("DEPRECATION")
        val data = intent?.getParcelableExtra<Intent>("data")

        if (code != Activity.RESULT_OK || data == null) {
            stopSelf()
            return START_NOT_STICKY
        }

        if (record == null) startCapture(code, data)
        return START_NOT_STICKY
    }

    private fun startAsForeground() {
        val nm = getSystemService(NotificationManager::class.java)
        val channel = NotificationChannel(
            CHANNEL_ID, "系统音频抓取", NotificationManager.IMPORTANCE_LOW
        )
        channel.setShowBadge(false)
        nm.createNotificationChannel(channel)

        val notif: Notification = Notification.Builder(this, CHANNEL_ID)
            .setContentTitle("石墨芯")
            .setContentText("正在抓取系统音频")
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setOngoing(true)
            .build()

        startForeground(NOTIF_ID, notif, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION)
    }

    private fun startCapture(resultCode: Int, data: Intent) {
        val mgr = getSystemService(MediaProjectionManager::class.java)
        val proj = try {
            mgr.getMediaProjection(resultCode, data)
        } catch (e: Exception) {
            null
        }

        if (proj == null) {
            stopSelf()
            return
        }
        projection = proj

        proj.registerCallback(object : MediaProjection.Callback() {
            override fun onStop() {
                stopSelf()
            }
        }, Handler(Looper.getMainLooper()))

        val am = getSystemService(AudioManager::class.java)
        sampleRate = am
            .getProperty(AudioManager.PROPERTY_OUTPUT_SAMPLE_RATE)
            ?.toIntOrNull() ?: 48000

        val config = AudioPlaybackCaptureConfiguration.Builder(proj)
            .addMatchingUsage(AudioAttributes.USAGE_MEDIA)
            .addMatchingUsage(AudioAttributes.USAGE_GAME)
            .addMatchingUsage(AudioAttributes.USAGE_UNKNOWN)
            .build()

        val format = AudioFormat.Builder()
            .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
            .setSampleRate(sampleRate)
            .setChannelMask(AudioFormat.CHANNEL_IN_MONO)
            .build()

        val minBuf = AudioRecord.getMinBufferSize(
            sampleRate, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT
        )

        val rec = try {
            AudioRecord.Builder()
                .setAudioFormat(format)
                .setBufferSizeInBytes(max(minBuf * 2, Spectrum.FFT_SIZE * 4))
                .setAudioPlaybackCaptureConfig(config)
                .build()
        } catch (e: Exception) {
            null
        }

        if (rec == null || rec.state != AudioRecord.STATE_INITIALIZED) {
            rec?.release()
            stopSelf()
            return
        }

        record = rec
        running = true
        try {
            rec.startRecording()
        } catch (e: Exception) {
            stopSelf()
            return
        }

        worker = Thread { readLoop(rec) }.also {
            it.name = "graphite-capture"
            it.start()
        }
    }

    private fun readLoop(rec: AudioRecord) {
        val chunk = ShortArray(1024)
        val window = FloatArray(Spectrum.FFT_SIZE)
        var filled = 0

        while (running) {
            val n = try {
                rec.read(chunk, 0, chunk.size)
            } catch (e: Exception) {
                -1
            }
            if (n <= 0) continue

            for (i in 0 until n) {
                window[filled++] = chunk[i] / 32768f
                if (filled == Spectrum.FFT_SIZE) {
                    CaptureBus.emit(Spectrum.bands(window, sampleRate))
                    System.arraycopy(
                        window, Spectrum.FFT_SIZE / 2,
                        window, 0, Spectrum.FFT_SIZE / 2
                    )
                    filled = Spectrum.FFT_SIZE / 2
                }
            }
        }
    }

    override fun onDestroy() {
        running = false
        try {
            record?.stop()
        } catch (e: Exception) {
        }
        try {
            record?.release()
        } catch (e: Exception) {
        }
        record = null

        try {
            projection?.stop()
        } catch (e: Exception) {
        }
        projection = null

        worker?.interrupt()
        worker = null

        super.onDestroy()
    }

    companion object {
        private const val CHANNEL_ID = "graphite_capture"
        private const val NOTIF_ID = 41
    }
}
