package eu.kanade.tachiyomi.extension.en.comix

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import okhttp3.Request
import org.junit.Assert.*
import org.junit.Test

class CoverTest {
    private val json = Json { ignoreUnknownKeys = true }
    private val livePath = "/images/covers/47780/8c537e90fe343b977a44664b832287a1853375ea@280.jpg"
    private fun manga(poster: String) = json.decodeFromString<Manga>("""{"hid":"8wgym","title":"The Greatest Estate Developer","poster":$poster} """)
    private fun poster(vararg values: Pair<String, String>) = buildJsonObject { values.forEach { (key, value) -> put(key, value) } }.toString()
    private fun cover(value: Manga, base: String, quality: String? = null): String? {
        val basic = value.toBasicSManga(base, quality)
        val detail = value.toSManga(base, quality, scorePosition = "top")
        assertEquals("Browse/related and detail must resolve the same cover", basic.thumbnail_url, detail.thumbnail_url)
        assertEquals("The Greatest Estate Developer", basic.title)
        assertEquals("/8wgym", basic.url)
        return basic.thumbnail_url
    }

    @Test fun `live root relative cover becomes a requestable URL on each selected mirror`() {
        assertThrows(IllegalArgumentException::class.java) { Request.Builder().url(livePath) }
        for (base in listOf("https://comix.to", "https://comix.ws")) {
            val resolved = cover(manga(poster("medium" to livePath)), base)!!
            assertEquals(base + livePath, Request.Builder().url(resolved).build().url.toString())
        }
    }

    @Test fun `absolute CDN covers keep their host path and query on either mirror`() {
        val url = "https://static.comix.to/d4b2/i/f/5a/68e0ce2d1ebcb@280.jpg?v=2"
        for (base in listOf("https://comix.to", "https://comix.ws")) {
            assertEquals(url, cover(manga(poster("medium" to url)), base))
        }
    }

    @Test fun `protocol relative and path relative values use URL resolution`() {
        assertEquals("https://static.comix.to/cover.jpg", cover(manga(poster("medium" to "//static.comix.to/cover.jpg")), "https://comix.ws"))
        assertEquals("https://comix.ws/images/covers/a.jpg", cover(manga(poster("medium" to "images/covers/a.jpg")), "https://comix.ws/"))
    }

    @Test fun `quality selection and absent size fallbacks are preserved`() {
        val base = "https://comix.to"
        val all = manga(poster("small" to "/s.jpg", "medium" to "/m.jpg", "large" to "/l.jpg"))
        for ((quality, expected) in listOf("small" to "s", "medium" to "m", "large" to "l", null to "m")) {
            assertEquals("$base/$expected.jpg", cover(all, base, quality))
        }
        assertEquals("$base/m.jpg", cover(manga(poster("medium" to "/m.jpg", "large" to "/l.jpg")), base, "small"))
        assertEquals("$base/l.jpg", cover(manga(poster("large" to "/l.jpg")), base))
        assertEquals("$base/s.jpg", cover(manga(poster("small" to "/s.jpg")), base, "large"))
    }

    @Test fun `missing and empty covers never resolve to the site home page`() {
        val base = "https://comix.to"
        assertNull(cover(manga("null"), base))
        for (value in listOf("{}", """{"medium":null}""", poster("medium" to ""), poster("medium" to "  "))) {
            assertEquals("", cover(manga(value), base))
        }
    }

    @Test fun `unsupported URL scheme is not exposed as a thumbnail`() {
        assertEquals("", cover(manga(poster("medium" to "file:///cover.jpg")), "https://comix.to"))
    }
}
