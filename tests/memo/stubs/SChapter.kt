package eu.kanade.tachiyomi.source.model

import kotlinx.serialization.json.JsonObject

// Only the host-model properties consumed by the production refresh method and memo helper.
class SChapter(
    val chapter_number: Float,
    var memo: JsonObject,
    var date_upload: Long = 0L,
    val id: Int = chapter_number.toInt(),
)

class SManga(val url: String, val memo: JsonObject = JsonObject(emptyMap()))

class SMangaUpdate(val manga: SManga, val chapters: List<SChapter>)
