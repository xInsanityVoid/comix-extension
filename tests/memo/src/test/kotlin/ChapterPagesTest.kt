package eu.kanade.tachiyomi.extension.en.comix

import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ChapterPagesTest {
    private val json = Json { ignoreUnknownKeys = true }

    private fun pages(metadata: String) = json.decodeFromString<ChapterPages>(
        """{"items":[{"url":"https://pq4.amandathoughts.site/hi/image-token","width":800}],$metadata}""",
    )

    @Test fun `current API metadata follows the observed reader host sequence`() {
        val pages = pages(""""alt":["puremind27.site","clearglow16.site","purelife84.site","trueforce46.site","happymind76.site"],"alt2":"kkplayer.wtf","alt_node":"447"""")
        assertEquals(
            listOf("pq4.puremind27.site", "pq4.kkplayer.wtf", "447.amandathoughts.site", "447.puremind27.site", "447.kkplayer.wtf"),
            pages.altHosts("pq4.amandathoughts.site", 0),
        )
        assertEquals(
            listOf("pq4.clearglow16.site", "pq4.kkplayer.wtf", "447.andrewsnotes.site", "447.clearglow16.site", "447.kkplayer.wtf"),
            pages.altHosts("pq4.andrewsnotes.site", 1),
        )
    }

    @Test fun `alternate domains rotate by page and alphanumeric nodes are retained`() {
        val pages = pages(""""alt":["one.site","two.site","three.site","four.site","five.site"],"alt2":"kkplayer.wtf","alt_node":"lov"""")
        assertEquals(listOf("1xx.two.site", "1xx.kkplayer.wtf", "lov.primary.site", "lov.two.site", "lov.kkplayer.wtf"), pages.altHosts("1xx.primary.site", 91))
    }

    @Test fun `current metadata wins when a cached legacy node is also present`() {
        val pages = pages(""""alt":["alt.site"],"node":"old","alt_node":"new"""")
        assertEquals(listOf("a.alt.site", "new.primary.site", "new.alt.site"), pages.altHosts("a.primary.site", 0))
    }

    @Test fun `missing or empty alternate arrays still permit the second domain and node`() {
        for (array in listOf("", "\"alt\":[],", "\"alt\":null,")) {
            val pages = pages("""${array}"alt2":"backup.site","alt_node":"node2"""")
            assertEquals(listOf("a.backup.site", "node2.primary.site", "node2.backup.site"), pages.altHosts("a.primary.site", 0))
        }
    }

    @Test fun `duplicate domains and nodes do not repeat the original host`() {
        val pages = pages(""""alt":["primary.site"],"alt2":"primary.site","alt_node":"a"""")
        assertTrue(pages.altHosts("a.primary.site", 0).isEmpty())
    }

    @Test fun `legacy metadata keeps the previous retry sequence`() {
        val pages = pages(""""alt":["one.site","two.site"],"node":"447"""")
        assertEquals(listOf("c131.two.site", "c131.one.site", "447.two.site", "447.one.site", "c131.two.site", "c131.one.site"), pages.altHosts("c131.old.site", 1))
    }

    @Test fun `plain images without fallback metadata remain supported`() {
        val pages = json.decodeFromString<ChapterPages>("""{"items":[{"url":"https://images.site/hi/token","s":1}]}""")
        assertEquals("https://images.site/hi/token", pages.items.single().url)
        assertEquals(1, pages.items.single().s)
        assertTrue(pages.altHosts("images.site", 0).isEmpty())
    }
}
