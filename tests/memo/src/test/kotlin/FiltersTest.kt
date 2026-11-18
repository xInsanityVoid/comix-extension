package eu.kanade.tachiyomi.extension.en.comix

import eu.kanade.tachiyomi.source.model.Filter
import eu.kanade.tachiyomi.source.model.FilterList
import okhttp3.HttpUrl.Companion.toHttpUrl
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class FiltersTest {
    private fun filters(
        rating: String = "",
        types: Set<String> = setOf("manga", "manhwa", "manhua", "other"),
        demographics: Set<String> = setOf("1", "2", "3", "4"),
        blockedGenres: Set<String> = emptySet(),
    ) = Filters(rating, types, demographics, blockedGenres).getFilterList()

    private fun FilterList.named(name: String) = single { it.name == name }

    private fun FilterList.tristates(name: String) =
        (named(name) as Filter.Group<*>).state.map { it as Filter.TriState }

    private fun uri(vararg filters: Filter<*>) = "https://comix.to/browse".toHttpUrl().newBuilder().apply {
        filters.filterIsInstance<Filters.UriFilter>().forEach { it.addToUri(this) }
    }.build().joinBrowseParameters()

    @Test fun `partial default demographics hide unticked terms without requiring selected terms`() {
        val filters = filters(demographics = setOf("2", "4"))
        val states = filters.tristates("Demographic").associate { it.name to it.state }
        assertEquals(Filter.TriState.STATE_IGNORE, states["Shounen"])
        assertEquals(Filter.TriState.STATE_IGNORE, states["Seinen"])
        assertEquals(Filter.TriState.STATE_EXCLUDE, states["Shoujo"])
        assertEquals(Filter.TriState.STATE_EXCLUDE, states["Josei"])

        val url = uri(filters.named("Demographic"))
        assertEquals(listOf("3,1"), url.queryParameterValues("genres_ex"))
        assertNull(url.queryParameter("demos"))
    }

    @Test fun `explicit demographic inclusion and exclusion use their respective site parameters`() {
        val filters = filters()
        filters.tristates("Demographic").single { it.name == "Shounen" }.state = Filter.TriState.STATE_INCLUDE
        filters.tristates("Demographic").single { it.name == "Josei" }.state = Filter.TriState.STATE_EXCLUDE

        val url = uri(filters.named("Demographic"))
        assertEquals(listOf("2"), url.queryParameterValues("demos"))
        assertEquals(listOf("3"), url.queryParameterValues("genres_ex"))
        assertNull(url.queryParameter("genres_in"))
    }

    @Test fun `clearing demographic states overrides the saved exclusions`() {
        val filters = filters(demographics = setOf("2"))
        filters.tristates("Demographic").forEach { it.state = Filter.TriState.STATE_IGNORE }
        assertEquals(0, uri(filters.named("Demographic")).querySize)
    }

    @Test fun `all default demographics leave both inclusion and exclusion unrestricted`() {
        val filters = filters()
        assertTrue(filters.tristates("Demographic").all { it.state == Filter.TriState.STATE_IGNORE })
        assertEquals(0, uri(filters.named("Demographic")).querySize)
        assertTrue(filters.named("Demographic") is Filters.PreferenceFilter)
    }

    @Test fun `each rating choice emits one comma separated scalar including show all`() {
        val cases = mapOf(
            "safe" to "safe",
            "suggestive" to "safe,suggestive",
            "erotica" to "safe,suggestive,erotica",
            "pornographic" to "safe,suggestive,erotica,pornographic",
            "" to "safe,suggestive,erotica,pornographic",
        )
        for ((selected, expected) in cases) {
            val url = uri(filters(rating = selected).named("Content rating"))
            assertEquals(selected, listOf(expected), url.queryParameterValues("content_rating"))
            assertNull(selected, url.queryParameter("content_rating[]"))
            assertEquals(selected, 1, url.querySize)
        }
    }

    @Test fun `show all search choice overrides a safe default`() {
        val rating = filters(rating = "safe").named("Content rating") as Filter.Select<*>
        rating.state = rating.values.indexOf("Show all")
        assertEquals("safe,suggestive,erotica,pornographic", uri(rating).queryParameter("content_rating"))
    }

    @Test fun `demographic exclusions compose with genre exclusions and existing filters`() {
        val filters = filters(types = setOf("manga", "manhwa"), demographics = setOf("2", "4"), blockedGenres = setOf("6"))
        val statuses = (filters.named("Status") as Filter.Group<*>).state.map { it as Filter.CheckBox }
        statuses.single { it.name == "Releasing" }.state = true
        statuses.single { it.name == "Finished" }.state = true
        filters.tristates("Formats").single { it.name == "Full Color" }.state = Filter.TriState.STATE_INCLUDE
        (filters.named("Minimum Chapter Length") as Filter.Text).state = "42"
        for ((name, year) in mapOf("From" to "1999", "To" to "2005")) {
            val filter = filters.named(name) as Filter.Select<*>
            filter.state = filter.values.indexOf(year)
        }

        val url = uri(*filters.toTypedArray())
        assertEquals(listOf("6,3,1"), url.queryParameterValues("genres_ex"))
        assertEquals(listOf("93172"), url.queryParameterValues("genres_in"))
        assertEquals("and", url.queryParameter("genres_mode"))
        assertEquals(listOf("manga,manhwa"), url.queryParameterValues("types"))
        assertEquals(listOf("releasing,finished"), url.queryParameterValues("statuses"))
        assertEquals("42", url.queryParameter("min_chap"))
        assertEquals("1999", url.queryParameter("year_from"))
        assertEquals("2005", url.queryParameter("year_to"))
        assertEquals("chapter_updated_at:desc", url.queryParameter("sort"))
        assertFalse(url.queryParameterNames.contains("demos"))
        assertEquals(listOf("safe,suggestive,erotica,pornographic"), url.queryParameterValues("content_rating"))
    }

    @Test fun `an explicit sort replaces the default search sort without altering the title or page`() {
        val query = "A Gallery, in the Wild!"
        val filter = filters().named("Sort By") as Filter.Sort
        filter.state = Filter.Sort.Selection(filter.values.indexOf("Title"), true)
        val url = "https://comix.to/browse".toHttpUrl().newBuilder().apply {
            addQueryParameter("q", query)
            addQueryParameter("page", "2")
            addQueryParameter("sort", "relevance:desc")
            (filter as Filters.QueryAwareFilter).addToUri(this, query)
        }.build().joinBrowseParameters()

        assertEquals(query, url.queryParameter("q"))
        assertEquals("2", url.queryParameter("page"))
        assertEquals(listOf("title:asc"), url.queryParameterValues("sort"))
    }
}
