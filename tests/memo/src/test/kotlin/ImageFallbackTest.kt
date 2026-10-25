package eu.kanade.tachiyomi.extension.en.comix

import kotlinx.serialization.json.Json
import okhttp3.HttpUrl
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Request
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.IOException

class ImageFallbackTest {
    private val harness = ImageHarness()
    private fun page() = harness.pages(Json.decodeFromString<ChapterPages>("""
        {"alt":["alt.site"],"alt2":"backup.site","alt_node":"447",
         "items":[{"url":"https://pq4.primary.site/hi/token?quality=high","s":1}]}
    """.trimIndent())).single()

    @Test fun `image fragment reaches the fallback interceptor and preserves path and flags`() {
        val attempted = mutableListOf<HttpUrl>()
        val client = OkHttpClient.Builder().addInterceptor(harness.interceptor()).addInterceptor { chain ->
            val request = chain.request()
            attempted.add(request.url)
            if (request.url.host != "447.alt.site") throw IOException("Controlled image host failure")
            Response.Builder().request(request).protocol(Protocol.HTTP_1_1).code(200).message("OK")
                .body("image bytes".toResponseBody()).build()
        }.build()
        client.newCall(Request.Builder().url(page().imageUrl!!).build()).execute().use {
            assertEquals("image bytes", it.body.string())
        }
        assertEquals(listOf("pq4.primary.site", "pq4.alt.site", "pq4.backup.site", "447.primary.site", "447.alt.site"), attempted.map { it.host })
        attempted.forEach {
            assertEquals("/hi/token", it.encodedPath)
            assertEquals("high", it.queryParameter("quality"))
            assertTrue("v3" in it.queryParameterNames)
        }
        assertEquals(listOf(null, "1", "2", "3", "4"), attempted.map { it.queryParameter("r") })
    }

    @Test fun `a working primary image does not contact backup hosts`() {
        var requests = 0
        val client = OkHttpClient.Builder().addInterceptor(harness.interceptor()).addInterceptor { chain ->
            requests++
            Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1).code(200).message("OK")
                .body("image bytes".toResponseBody()).build()
        }.build()
        client.newCall(Request.Builder().url(page().imageUrl!!).build()).execute().close()
        assertEquals(1, requests)
    }

    @Test fun `all failed hosts terminate with an error after one bounded cycle`() {
        var requests = 0
        val client = OkHttpClient.Builder().addInterceptor(harness.interceptor()).addInterceptor {
            requests++
            throw IOException("Unavailable image host")
        }.build()
        try {
            client.newCall(Request.Builder().url(page().imageUrl!!).build()).execute().close()
            throw AssertionError("Expected image failure")
        } catch (error: IOException) {
            assertEquals("Unavailable image host", error.message)
        }
        assertEquals(6, requests)
    }
}
