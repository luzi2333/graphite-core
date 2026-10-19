package com.example.graphitecore

import java.util.Locale
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.log10
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * 2048 点 FFT → 24 个对数频段（38Hz–16.5kHz），输出 "0.123,0.456,..." 这样的字符串。
 * 频段划分跟网页版 audio.js 里的一致，所以直接喂给 GC.nativeFrame 就能用。
 */
object Spectrum {

    const val FFT_SIZE = 2048
    private const val BANDS = 24
    private const val FMIN = 38.0
    private const val FMAX = 16500.0

    private val hann = FloatArray(FFT_SIZE) {
        (0.5 - 0.5 * cos(2.0 * PI * it / (FFT_SIZE - 1))).toFloat()
    }
    private val re = FloatArray(FFT_SIZE)
    private val im = FloatArray(FFT_SIZE)
    private val cosT = FloatArray(FFT_SIZE / 2) { cos(2.0 * PI * it / FFT_SIZE).toFloat() }
    private val sinT = FloatArray(FFT_SIZE / 2) { sin(2.0 * PI * it / FFT_SIZE).toFloat() }
    private val rev = IntArray(FFT_SIZE)

    init {
        val bits = Integer.numberOfTrailingZeros(FFT_SIZE)
        for (i in 0 until FFT_SIZE) {
            rev[i] = Integer.reverse(i) ushr (32 - bits)
        }
    }

    fun bands(samples: FloatArray, sampleRate: Int): String {
        val n = FFT_SIZE

        for (i in 0 until n) {
            re[i] = samples[i] * hann[i]
            im[i] = 0f
        }

        for (i in 0 until n) {
            val j = rev[i]
            if (j > i) {
                val tr = re[i]; re[i] = re[j]; re[j] = tr
                val ti = im[i]; im[i] = im[j]; im[j] = ti
            }
        }

        var len = 2
        while (len <= n) {
            val half = len / 2
            val step = n / len
            var base = 0
            while (base < n) {
                for (k in 0 until half) {
                    val c = cosT[k * step]
                    val s = sinT[k * step]
                    val a = base + k
                    val b = a + half
                    val tr = re[b] * c + im[b] * s
                    val ti = im[b] * c - re[b] * s
                    re[b] = re[a] - tr
                    im[b] = im[a] - ti
                    re[a] += tr
                    im[a] += ti
                }
                base += len
            }
            len *= 2
        }

        val sb = StringBuilder(BANDS * 6)
        val nyq = sampleRate / 2.0
        val bins = n / 2
        val ratio = FMAX / FMIN

        for (band in 0 until BANDS) {
            val f0 = FMIN * ratio.pow(band.toDouble() / BANDS)
            val f1 = FMIN * ratio.pow((band + 1).toDouble() / BANDS)
            var i0 = (f0 / nyq * bins).toInt()
            var i1 = (f1 / nyq * bins).toInt()
            i0 = max(1, min(bins - 1, i0))
            i1 = max(i0 + 1, min(bins, i1))

            var sum = 0.0
            for (i in i0 until i1) {
                sum += sqrt((re[i] * re[i] + im[i] * im[i]).toDouble())
            }
            val mag = sum / ((i1 - i0).toDouble() * n)
            val db = 20.0 * log10(mag + 1e-9)
            var v = ((db + 72.0) / 72.0).toFloat()
            if (v < 0f) v = 0f
            if (v > 1f) v = 1f

            if (band > 0) sb.append(',')
            sb.append(String.format(Locale.US, "%.3f", v))
        }
        return sb.toString()
    }
}
