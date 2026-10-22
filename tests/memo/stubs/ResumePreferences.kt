package eu.kanade.tachiyomi.extension.en.comix

import kotlinx.serialization.json.Json

inline fun <reified T> String.parseAs(): T = Json.decodeFromString(this)

class ResumePreferences {
    val values = mutableMapOf<String, String>()
    var failRead = false
    var failWrite = false
    fun getString(key: String, default: String?): String? {
        if (failRead) throw IllegalStateException("Preference read failed")
        return values[key] ?: default
    }
    fun edit() = Editor()
    inner class Editor {
        private val changes = mutableMapOf<String, String?>()
        fun putString(key: String, value: String) { changes[key] = value }
        fun remove(key: String) { changes[key] = null }
        fun apply() {
            if (failWrite) throw IllegalStateException("Preference write failed")
            changes.forEach { (key, value) -> if (value == null) values.remove(key) else values[key] = value }
        }
    }
}
