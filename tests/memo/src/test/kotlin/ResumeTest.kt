package eu.kanade.tachiyomi.extension.en.comix

import org.junit.Assert.*
import org.junit.Test

class ResumeTest {
    @Test fun `checkpoint survives recreating the source`() {
        val first = ResumeHarness()
        first.save("vwk5z", """{"mangaId":"vwk5z","nextPage":16} """.trim())
        val reopened = ResumeHarness(first.preferences)
        assertEquals("16", reopened.read("vwk5z")?.get("nextPage").toString())
        assertNull(reopened.read("other"))
    }

    @Test fun `heartbeat does not overwrite saved progress`() {
        val cache = ResumeHarness()
        cache.save("abc", "{\"nextPage\":3}")
        cache.save("abc", "")
        assertEquals("3", cache.read("abc")?.get("nextPage").toString())
    }

    @Test fun `eight title bound evicts least recently used checkpoint`() {
        val cache = ResumeHarness()
        repeat(8) { cache.save("m$it", "{}") }
        cache.read("m0")
        cache.save("m8", "{}")
        assertNull(cache.read("m1"))
        assertNotNull(cache.read("m0"))
        assertNotNull(cache.read("m8"))
        assertEquals(8, cache.preferences.values.keys.count { it.startsWith("chapterListResume_") })
    }

    @Test fun `repeated saves replace one title without evicting others`() {
        val cache = ResumeHarness()
        repeat(8) { cache.save("m$it", "{}") }
        repeat(20) { cache.save("m0", "{\"nextPage\":$it}") }
        assertEquals(8, cache.preferences.values.keys.count { it.startsWith("chapterListResume_") })
        assertNotNull(cache.read("m1"))
        assertEquals("19", cache.read("m0")?.get("nextPage").toString())
    }

    @Test fun `byte size limit preserves earlier valid checkpoint`() {
        val cache = ResumeHarness()
        cache.save("abc", "{}")
        cache.save("abc", "{\"text\":\"" + "界".repeat(350000) + "\"}")
        assertEquals("{}", cache.read("abc").toString())
        cache.preferences.values["chapterListResume_abc"] = "x".repeat(1024 * 1024 + 1)
        assertNull(cache.read("abc"))
    }

    @Test fun `malformed preference is ignored`() {
        val cache = ResumeHarness()
        cache.preferences.values["chapterListResume_abc"] = "not json"
        assertNull(cache.read("abc"))
        cache.preferences.values["chapterListResume_abc"] = "[]"
        assertNull(cache.read("abc"))
    }

    @Test fun `optional cache storage failures cannot fail a chapter refresh`() {
        val cache = ResumeHarness()
        cache.save("abc", "{\"nextPage\":3}")
        cache.preferences.failWrite = true
        cache.save("abc", "{\"nextPage\":4}")
        assertEquals("3", cache.read("abc")?.get("nextPage").toString())
        cache.preferences.failRead = true
        assertNull(cache.read("abc"))
        cache.save("other", "{}")
    }
}
