package eu.kanade.tachiyomi.source.model

import kotlinx.serialization.json.JsonObject

// Only the host-model properties consumed by the production refresh method and memo helper.
class SChapter(
    val chapter_number: Float,
    var memo: JsonObject,
    var date_upload: Long = 0L,
    val id: Int = chapter_number.toInt(),
)

class SManga(var url: String = "", var memo: JsonObject = JsonObject(emptyMap())) {
    var title = ""
    var author: String? = null
    var artist: String? = null
    var description: String? = null
    var initialized = false
    var status = UNKNOWN
    var thumbnail_url: String? = null
    var genre: String? = null

    companion object {
        const val UNKNOWN = 0
        const val ONGOING = 1
        const val COMPLETED = 2
        const val ON_HIATUS = 6
        const val CANCELLED = 5
        fun create() = SManga()
    }
}

class SMangaUpdate(val manga: SManga, val chapters: List<SChapter>)
