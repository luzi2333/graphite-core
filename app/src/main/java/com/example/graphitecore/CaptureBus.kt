package com.example.graphitecore

/**
 * 音频线程 → UI 线程的单向通道。
 * 服务里算出频段后直接回调，MainActivity 负责塞进 WebView。
 */
object CaptureBus {
    @Volatile
    var listener: ((String) -> Unit)? = null

    fun emit(payload: String) {
        listener?.invoke(payload)
    }
}
