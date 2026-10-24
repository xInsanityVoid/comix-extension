package eu.kanade.tachiyomi.extension.en.comix

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RoutingTest {
    private val routing = RoutingHarness()

    @Test fun `both mirrors and their www aliases work with either selected mirror`() {
        val mirrors = listOf("comix.to", "www.comix.to", "comix.ws", "www.comix.ws")
        mirrors.forEach { selected ->
            mirrors.forEach { host ->
                assertTrue("$host with $selected selected", routing.acceptsHost(host, selected))
            }
        }
    }

    @Test fun `the selected host is retained if another mirror is configured`() {
        listOf("mirror.example", "www.mirror.example").forEach { selected ->
            listOf("mirror.example", "www.mirror.example", "comix.to", "comix.ws").forEach { host ->
                assertTrue("$host with $selected selected", routing.acceptsHost(host, selected))
            }
        }
    }

    @Test fun `unrelated hosts and lookalikes are rejected`() {
        val rejected = listOf(
            "evilcomix.to", "comix.to.evil", "comix.ws.evil", "api.comix.to",
            "www.www.comix.to", "other.example", "", "comix.to.",
        )
        listOf("comix.to", "comix.ws").forEach { selected ->
            rejected.forEach { host ->
                assertFalse("$host with $selected selected", routing.acceptsHost(host, selected))
            }
        }
    }

    @Test fun `HTML navigation accepts any header and media type casing`() {
        listOf("Accept", "accept", "aCcEpT").forEach { name ->
            listOf("text/html", "TEXT/HTML", "application/xhtml+xml,Text/Html;q=0.9,*/*;q=0.8").forEach { value ->
                assertTrue("$name: $value", routing.acceptsHtml(mapOf(name to value)))
            }
        }
    }

    @Test fun `missing headers are not treated as an HTML navigation`() {
        assertFalse(routing.acceptsHtml(null))
        assertFalse(routing.acceptsHtml(emptyMap()))
        assertFalse(routing.acceptsHtml(mapOf("Accept" to "")))
        assertFalse(routing.acceptsHtml(mapOf("Content-Type" to "text/html")))
    }

    @Test fun `solver fetch and JSON requests cannot recursively replace the captcha page`() {
        listOf("Accept", "accept").forEach { name ->
            listOf("*/*", "application/json", "application/json, */*;q=0.8").forEach { value ->
                assertFalse("$name: $value", routing.acceptsHtml(mapOf(name to value)))
            }
        }
    }
}
