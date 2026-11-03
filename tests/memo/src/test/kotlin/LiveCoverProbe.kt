package eu.kanade.tachiyomi.extension.en.comix

import kotlinx.serialization.json.*
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.util.concurrent.TimeUnit
import javax.imageio.ImageIO

// Opt-in: compile production Manga/Poster mapping, then fetch representative live covers.
fun main(args: Array<String>) {
    val payload = File(args.single())
    val json = Json { ignoreUnknownKeys = true }
    val items = json.parseToJsonElement(payload.readText()).jsonObject["result"]!!.jsonObject["result"]!!.jsonObject["items"]!!.jsonArray
    val relative = items.filter { it.jsonObject["poster"]!!.jsonObject["medium"]!!.jsonPrimitive.content.startsWith('/') }.take(3)
    val absolute = items.filter { it.jsonObject["poster"]!!.jsonObject["medium"]!!.jsonPrimitive.content.startsWith("https://") }.take(1)
    check(relative.size == 3 && absolute.size == 1)
    val client = OkHttpClient.Builder().callTimeout(15, TimeUnit.SECONDS).build()
    try {
        for (base in listOf("https://comix.to", "https://comix.ws")) {
            for ((index, item) in (relative + absolute).withIndex()) {
                val manga = json.decodeFromJsonElement<Manga>(item)
                for (quality in listOf("medium", "large")) {
                    val basic = manga.toBasicSManga(base, quality)
                    val detail = manga.toSManga(base, quality, scorePosition = "top")
                    check(basic.thumbnail_url == detail.thumbnail_url)
                    val request = Request.Builder().url(basic.thumbnail_url!!)
                        .header("Accept", "*/*").header("Origin", base).header("Referer", "$base/").build()
                    client.newCall(request).execute().use { response ->
                        check(response.isSuccessful) { "HTTP ${response.code}" }
                        val bytes = response.body.bytes()
                        val decoded = ImageIO.read(bytes.inputStream()) ?: error("Not a decodable image")
                        println("host=${request.url.host}, hid=${manga.hid}, quality=$quality, bytes=${bytes.size}, width=${decoded.width}, height=${decoded.height}")
                        File(payload.parentFile, "native-cover-${base.substringAfter("://")}-${index}-$quality.bin").writeBytes(bytes)
                    }
                    Thread.sleep(210)
                }
            }
        }
    } finally {
        client.connectionPool.evictAll()
        client.dispatcher.executorService.shutdown()
    }
}
