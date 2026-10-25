package eu.kanade.tachiyomi.extension.en.comix

import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.IOException
import java.util.concurrent.TimeUnit
import javax.imageio.ImageIO

// Explicit opt-in diagnostic: `probeImages -PpagesFile=/absolute/path/to/live-payload.json`.
fun main(args: Array<String>) {
    require(args.single().isNotBlank()) { "Supply pagesFile containing a live chapter-page payload" }
    val payload = File(args.single())
    val pages = Json { ignoreUnknownKeys = true }.decodeFromString<ChapterPages>(payload.readText())
    val harness = ImageHarness()
    val images = harness.pages(pages)
    for (index in listOf(0, images.size / 2, images.lastIndex).distinct()) {
        val request = Request.Builder().url(images[index].imageUrl!!).build()
        val primary = request.url.host
        val attempted = mutableListOf<String>()
        val client = OkHttpClient.Builder().connectTimeout(5, TimeUnit.SECONDS).readTimeout(10, TimeUnit.SECONDS)
            .callTimeout(45, TimeUnit.SECONDS).addInterceptor(harness.interceptor()).addInterceptor { chain ->
                attempted.add(chain.request().url.host)
                // Deliberately fail the primary to test actual fallback transport, even when it is healthy.
                if (chain.request().url.host == primary) throw IOException("Controlled primary-host failure")
                chain.proceed(chain.request())
            }.build()
        val started = System.nanoTime()
        client.newCall(request).execute().use { response ->
            check(response.isSuccessful) { "HTTP ${response.code}" }
            val bytes = response.body.bytes()
            val webp = bytes.size > 12 && String(bytes, 0, 4) == "RIFF" && String(bytes, 8, 4) == "WEBP"
            check(webp || ImageIO.read(bytes.inputStream()) != null) { "Response is not a recognized image" }
            println("index=$index, host=${response.request.url.host}, bytes=${bytes.size}, seconds=${(System.nanoTime() - started) / 1e9}, attempts=$attempted")
            File(payload.parentFile, "native-fallback-${payload.nameWithoutExtension}-$index.bin").writeBytes(bytes)
        }
        client.connectionPool.evictAll()
        client.dispatcher.executorService.shutdown()
    }
}
