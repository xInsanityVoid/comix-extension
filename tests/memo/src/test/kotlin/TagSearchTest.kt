package eu.kanade.tachiyomi.extension.en.comix

import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class TagSearchTest {
    private val json = Json { ignoreUnknownKeys = true }
    private val payload = """{"result":[{"id":13470,"label":"Cheongdam","slug":"cheongdam"},{"id":294,"label":"Cheongmin"}]}"""

    @Test fun `exact names are preferred without regard to case`() {
        assertEquals(listOf("13470"), json.decodeFromString<TagSearchResponse>(payload).matchingIds("author", "CHEONGDAM"))
    }

    @Test fun `fuzzy matches are retained when there is no exact name`() {
        assertEquals(listOf("13470", "294"), json.decodeFromString<TagSearchResponse>(payload).matchingIds("author", "Cheon"))
    }

    @Test fun `no results fail clearly instead of silently dropping the filter`() {
        val response = json.decodeFromString<TagSearchResponse>("""{"result":[]}""")
        val error = assertThrows(Exception::class.java) { response.matchingIds("artist", "Unknown Name") }
        assertEquals("No artist named \"Unknown Name\"", error.message)
    }

    @Test fun `the unwrapped live payload reproduces the old native parsing failure`() {
        assertThrows(SerializationException::class.java) { json.decodeFromString<TagSearchResponse>("""[{"id":13470,"label":"Cheongdam"}]""") }
    }
}
