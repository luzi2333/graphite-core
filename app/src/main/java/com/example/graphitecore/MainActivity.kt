package com.example.graphitecore

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

class MainActivity : AppCompatActivity() {

    private lateinit var web: WebView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        web = WebView(this)
        setContentView(web)
        web.setBackgroundColor(0xFF040506.toInt())

        with(web.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = true
            mediaPlaybackRequiresUserGesture = false
            cacheMode = WebSettings.LOAD_DEFAULT
        }

        web.webViewClient = WebViewClient()
        web.webChromeClient = WebChromeClient()
        web.addJavascriptInterface(Bridge(), "AndroidAudio")

        CaptureBus.listener = { payload ->
            runOnUiThread {
                web.evaluateJavascript(
                    "window.GC && GC.nativeFrame && GC.nativeFrame('$payload')", null
                )
            }
        }

        web.loadUrl("file:///android_asset/index.html")

        applyImmersive()
    }

    /* 真全屏：隐藏状态栏、导航栏、手势条，内容延伸进挖孔区；上滑可临时唤出 */
    private fun applyImmersive() {
        WindowCompat.setDecorFitsSystemWindows(window, false)

        val lp = window.attributes
        lp.layoutInDisplayCutoutMode =
            WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
        window.attributes = lp

        val controller = WindowCompat.getInsetsController(window, window.decorView)
        controller.hide(WindowInsetsCompat.Type.systemBars())
        controller.systemBarsBehavior =
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) applyImmersive()
    }

    override fun onDestroy() {
        CaptureBus.listener = null
        stopService(Intent(this, CaptureService::class.java))
        super.onDestroy()
    }

    /* JS 调用的桥 */
    inner class Bridge {
        @JavascriptInterface
        fun startCapture() {
            runOnUiThread { beginCapture() }
        }

        @JavascriptInterface
        fun stopCapture() {
            runOnUiThread {
                stopService(Intent(this@MainActivity, CaptureService::class.java))
            }
        }
    }

    private fun beginCapture() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
            != PackageManager.PERMISSION_GRANTED
        ) {
            val perms = mutableListOf(Manifest.permission.RECORD_AUDIO)
            if (Build.VERSION.SDK_INT >= 33) {
                perms.add(Manifest.permission.POST_NOTIFICATIONS)
            }
            ActivityCompat.requestPermissions(this, perms.toTypedArray(), REQ_PERM)
            return
        }
        requestProjection()
    }

    private fun requestProjection() {
        val mgr = getSystemService(MediaProjectionManager::class.java)
        startActivityForResult(mgr.createScreenCaptureIntent(), REQ_PROJ)
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != REQ_PERM) return

        if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            requestProjection()
        } else {
            showError("需要录音权限才能抓取系统音频")
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != REQ_PROJ) return

        if (resultCode != Activity.RESULT_OK || data == null) {
            showError("没有授权录制，抓不到系统音频")
            return
        }

        val svc = Intent(this, CaptureService::class.java).apply {
            putExtra("code", resultCode)
            putExtra("data", data)
        }
        ContextCompat.startForegroundService(this, svc)
    }

    private fun showError(msg: String) {
        val safe = msg.replace("'", "").replace("\n", " ")
        runOnUiThread {
            web.evaluateJavascript(
                "window.GC && GC.nativeError && GC.nativeError('$safe')", null
            )
        }
    }

    companion object {
        private const val REQ_PERM = 1001
        private const val REQ_PROJ = 1002
    }
}
