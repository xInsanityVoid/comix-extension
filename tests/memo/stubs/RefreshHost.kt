package eu.kanade.tachiyomi.extension.en.comix

import eu.kanade.tachiyomi.source.model.SChapter
import eu.kanade.tachiyomi.source.model.SManga
import eu.kanade.tachiyomi.source.model.SMangaUpdate
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long

val JsonElement.booleanOrNull get() = jsonPrimitive.booleanOrNull
val JsonElement.string get() = jsonPrimitive.content
val JsonElement.long get() = jsonPrimitive.long

class RefreshPreferences {
    var faster = true
    var deduplicate = false
    var blacklist = emptySet<String>()
    fun fetchChaptersUntilKnown() = faster
    fun deduplicateChapters() = deduplicate
    fun scanlatorBlacklist() = blacklist
}

class Manga(val chapterUpdatedAtFormatted: String? = "2w")

class ChapterList(
    val chapters: List<Chapter>,
    val complete: Boolean,
    val error: String? = null,
    val queries: JsonObject? = null,
)

class Chapter(val number: Float, val date: Long = 0L, val id: Int = number.toInt()) {
    var mappingCalls = 0
    fun toSChapter(mangaSlug: String): SChapter {
        mappingCalls++
        return SChapter(number, JsonObject(emptyMap()), date, id)
    }
}

// A fixed old date keeps the removed detail-timestamp shortcut reproducible in regression checks.
fun parseRelativeDate(date: String, latest: Boolean = false) = 1L

abstract class RefreshHost {
    val preferences = RefreshPreferences()
    lateinit var nextChapterList: ChapterList
    var nextChapterError: Exception? = null
    var chapterRequests = 0
    var requestedKnownIds = emptyList<Int>()
    var detailNavigations = 0
    var cachedQueryWrites = 0
    var selectionCalls = 0
    var detailParses = 0
    val detailQueries = JsonObject(emptyMap())
    val parsedManga = SManga("/parsed-detail")

    abstract suspend fun fetchMangaUpdate(
        manga: SManga,
        chapters: List<SChapter>,
        fetchDetails: Boolean,
        fetchChapters: Boolean,
    ): SMangaUpdate

    protected fun SChapter.chapterId(): Int? = id
    protected fun getMangaUrl(manga: SManga) = "https://example.test/title${manga.url}"
    protected suspend fun navigateForQueries(url: String): JsonObject {
        detailNavigations++
        return detailQueries
    }

    protected fun JsonObject.mangaDetail() = Manga()
    protected fun parseMangaDetails(detail: Manga): SManga {
        detailParses++
        return parsedManga
    }

    protected suspend fun getWebViewChapterList(manga: SManga, knownIds: List<Int>): ChapterList {
        chapterRequests++
        requestedKnownIds = knownIds
        nextChapterError?.let { throw it }
        return nextChapterList
    }

    protected fun rememberQueries(url: String, queries: JsonObject) {
        cachedQueryWrites++
    }

    // Selection itself is unchanged and outside this harness; preserve candidates for assertions.
    protected fun selectChapters(
        candidates: List<SChapter>,
        shouldDeduplicate: Boolean,
        scanlatorBlacklist: Set<String>,
    ): List<SChapter> {
        selectionCalls++
        return candidates
    }
}
