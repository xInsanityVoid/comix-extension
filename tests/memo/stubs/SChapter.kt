package eu.kanade.tachiyomi.source.model

import kotlinx.serialization.json.JsonObject

// Only the two host-model properties consumed by the production helper.
class SChapter(val chapter_number: Float, val memo: JsonObject)
