package eu.kanade.tachiyomi.extension.en.comix

import eu.kanade.tachiyomi.source.model.SChapter
import eu.kanade.tachiyomi.source.model.SManga
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.Assert.*
import org.junit.Test
import kotlin.coroutines.Continuation
import kotlin.coroutines.EmptyCoroutineContext
import kotlin.coroutines.startCoroutine

class RefreshTest {
    private val manga = SManga("/0080d-the-unlimited-bacteriomancer")
    private fun stored(number: Float = 15f) = SChapter(number, buildJsonObject {
        put(CHAPTER_LIST_DEDUPLICATED_MEMO, false)
        put(CHAPTER_LIST_BLACKLIST_MEMO, "")
        put(CHAPTER_LIST_COMPLETE_MEMO, true)
        put(CHAPTER_LIST_FETCHED_AT_MEMO, System.currentTimeMillis() + 60_000L)
    }, date_upload = 1234L)

    private fun <T> runSuspend(block: suspend () -> T): T {
        var completion: Result<T>? = null
        block.startCoroutine(object : Continuation<T> {
            override val context = EmptyCoroutineContext
            override fun resumeWith(result: Result<T>) { completion = result }
        })
        return checkNotNull(completion) { "The test host unexpectedly suspended" }.getOrThrow()
    }

    @Test fun `discovery failure is an error for an existing library without mutating it`() {
        val chapter = stored()
        val originalMemo = chapter.memo
        val host = RefreshHarness().apply {
            preferences.faster = false
            nextChapterList = ChapterList(emptyList(), false, "Could not find site's chapter API", JsonObject(emptyMap()))
        }
        val error = assertThrows(Exception::class.java) {
            runSuspend { host.fetchMangaUpdate(manga, listOf(chapter), true, true) }
        }
        assertEquals("Could not find site's chapter API", error.message)
        assertSame(originalMemo, chapter.memo)
        assertEquals(1234L, chapter.date_upload)
        assertEquals(0, host.cachedQueryWrites)
        assertEquals(0, host.selectionCalls)
        assertEquals(0, host.detailParses)
    }

    @Test fun `partial refresh is an error even when some new chapters arrived`() {
        val chapter = stored()
        val originalMemo = chapter.memo
        val fresh = Chapter(16f)
        val host = RefreshHarness().apply {
            preferences.faster = false
            nextChapterList = ChapterList(listOf(fresh), false, "HTTP 503", JsonObject(emptyMap()))
        }
        val error = assertThrows(Exception::class.java) {
            runSuspend { host.fetchMangaUpdate(manga, listOf(chapter), false, true) }
        }
        assertEquals("HTTP 503", error.message)
        assertSame(originalMemo, chapter.memo)
        assertEquals(0, fresh.mappingCalls)
        assertEquals(0, host.cachedQueryWrites)
    }

    @Test fun `incomplete initial fetch still fails with a useful fallback`() {
        val host = RefreshHarness().apply { nextChapterList = ChapterList(emptyList(), false) }
        val error = assertThrows(Exception::class.java) {
            runSuspend { host.fetchMangaUpdate(manga, emptyList(), false, true) }
        }
        assertEquals("Chapter list is incomplete", error.message)
    }

    @Test fun `recent refresh metadata cannot hide a newly released chapter`() {
        val old = stored()
        val host = RefreshHarness().apply { nextChapterList = ChapterList(listOf(Chapter(16f)), true) }
        val update = runSuspend { host.fetchMangaUpdate(manga, listOf(old), false, true) }
        assertEquals(1, host.chapterRequests)
        assertEquals(listOf(15), host.requestedKnownIds)
        assertEquals(listOf(16f, 15f), update.chapters.map { it.chapter_number })
        assertSame(old, update.chapters.last())
        assertEquals(0, host.detailNavigations)
    }

    @Test fun `refresh keeps original upload dates and reuses details from the chapter page`() {
        val old = stored()
        val host = RefreshHarness().apply {
            nextChapterList = ChapterList(listOf(Chapter(16f, 7890L), Chapter(15f, 9999L)), true, queries = detailQueries)
        }
        val update = runSuspend { host.fetchMangaUpdate(manga, listOf(old), true, true) }
        assertEquals(1234L, update.chapters[1].date_upload)
        assertEquals(7890L, update.chapters[0].date_upload)
        assertSame(host.parsedManga, update.manga)
        assertEquals(1, host.cachedQueryWrites)
        assertEquals(0, host.detailNavigations)
    }

    @Test fun `details only update does not fetch or alter chapters`() {
        val old = listOf(stored())
        val host = RefreshHarness()
        val update = runSuspend { host.fetchMangaUpdate(manga, old, true, false) }
        assertSame(old, update.chapters)
        assertEquals(0, host.chapterRequests)
        assertEquals(1, host.detailNavigations)
    }
}
