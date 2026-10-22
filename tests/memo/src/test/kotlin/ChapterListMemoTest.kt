package eu.kanade.tachiyomi.extension.en.comix

import eu.kanade.tachiyomi.source.model.SChapter
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Test

class ChapterListMemoTest {
    private val empty = JsonObject(emptyMap())
    private fun state(deduplicate: Boolean, complete: Boolean = true) = buildJsonObject {
        put(CHAPTER_LIST_DEDUPLICATED_MEMO, deduplicate)
        put(CHAPTER_LIST_BLACKLIST_MEMO, "")
        put(CHAPTER_LIST_COMPLETE_MEMO, complete)
    }

    @Test fun `reader chapter order does not change the refresh state`() {
        val memo = state(false)
        val newest = SChapter(100f, memo)
        val oldest = SChapter(1f, empty)
        val middle = SChapter(50f, empty)
        for (chapters in listOf(listOf(newest, middle, oldest), listOf(oldest, middle, newest), listOf(middle, newest, oldest))) {
            assertSame(memo, chapters.chapterListMemo())
        }
    }

    @Test fun `old metadata cannot override the newest chapter state`() {
        val old = SChapter(99f, state(true))
        val current = SChapter(100f, state(false))
        assertSame(current.memo, listOf(old, current).chapterListMemo())
        assertSame(current.memo, listOf(current, old).chapterListMemo())
    }

    @Test fun `incomplete state is retained rather than an older complete state`() {
        val old = SChapter(99f, state(false))
        val incomplete = SChapter(100f, state(false, complete = false))
        assertSame(incomplete.memo, listOf(old, incomplete).chapterListMemo())
    }

    @Test fun `duplicate chapter numbers without metadata do not hide the marker`() {
        val marker = SChapter(100f, state(false))
        val duplicate = SChapter(100f, empty)
        assertSame(marker.memo, listOf(duplicate, marker).chapterListMemo())
    }

    @Test fun `missing state still requires a full initial fetch`() {
        assertNull(emptyList<SChapter>().chapterListMemo())
        assertNull(listOf(SChapter(100f, empty)).chapterListMemo())
    }
}
