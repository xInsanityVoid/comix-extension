plugins {
    kotlin("jvm") version "2.4.10"
    kotlin("plugin.serialization") version "2.4.10"
}

val comixSourceDir = providers.gradleProperty("comixSourceDir").orElse("../../src/en/comix/src")
val productionSource = file(comixSourceDir.get()).resolve("eu/kanade/tachiyomi/extension/en/comix/Comix.kt")
val generatedRefresh = layout.buildDirectory.file("generated/refresh/RefreshHarness.kt")
val generateRefreshHarness = tasks.register("generateRefreshHarness") {
    inputs.file(productionSource)
    outputs.file(generatedRefresh)
    doLast {
        val source = productionSource.readText()
        val start = source.indexOf("    override suspend fun fetchMangaUpdate(")
        val end = source.indexOf("    private fun JsonObject.mangaDetail()", start)
        check(start >= 0 && end > start) { "Could not locate the production refresh method" }
        generatedRefresh.get().asFile.apply {
            parentFile.mkdirs()
            // Compile the unchanged production method, with only its host dependencies replaced.
            writeText("""
                package eu.kanade.tachiyomi.extension.en.comix
                import eu.kanade.tachiyomi.source.model.*
                import kotlinx.serialization.json.*
                class RefreshHarness : RefreshHost() {
            """.trimIndent() + "\n" + source.substring(start, end) + "}\n")
        }
    }
}

val generatedResume = layout.buildDirectory.file("generated/resume/ResumeHarness.kt")
val generateResumeHarness = tasks.register("generateResumeHarness") {
    inputs.file(productionSource)
    outputs.file(generatedResume)
    doLast {
        val source = productionSource.readText()
        val start = source.indexOf("    private fun readChapterListResume(")
        val end = source.indexOf("    private fun selectChapters(", start)
        check(start >= 0 && end > start)
        val constants = source.lineSequence().filter {
            it.contains("private const val CHAPTER_LIST_RESUME") || it.contains("private const val MAX_CHAPTER_LIST_RESUME")
        }.joinToString("\n")
        generatedResume.get().asFile.apply {
            parentFile.mkdirs()
            writeText("""
                package eu.kanade.tachiyomi.extension.en.comix
                import kotlinx.serialization.json.*
                class ResumeHarness(val preferences: ResumePreferences = ResumePreferences()) {
                    fun read(id: String) = readChapterListResume(id)
                    fun save(id: String, state: String) = saveChapterListResume(id, state)
            """.trimIndent() + "\n" + source.substring(start, end) + "companion object {\n" + constants + "\n}\n}\n")
        }
    }
}

val generatedRouting = layout.buildDirectory.file("generated/routing/RoutingHarness.kt")
val generateRoutingHarness = tasks.register("generateRoutingHarness") {
    inputs.file(productionSource)
    outputs.file(generatedRouting)
    doLast {
        val source = productionSource.readText()
        val start = source.indexOf("    private fun isComixHost(")
        val end = source.indexOf("    private fun HttpUrl.isChapterPagesRequest()", start)
        check(start >= 0 && end > start) { "Could not locate the production URL/header helpers" }
        generatedRouting.get().asFile.apply {
            parentFile.mkdirs()
            writeText("""
                package eu.kanade.tachiyomi.extension.en.comix
                class RoutingHarness {
                    fun acceptsHost(host: String, selectedHost: String) = isComixHost(host, selectedHost)
                    fun acceptsHtml(headers: Map<String, String>?) = isHtmlRequest(headers)
            """.trimIndent() + "\n" + source.substring(start, end) + "}\n")
        }
    }
}

val generatedPages = layout.buildDirectory.file("generated/pages/ChapterPages.kt")
val generatePagesHarness = tasks.register("generatePagesHarness") {
    val dtoSource = productionSource.parentFile.resolve("Dto.kt")
    inputs.file(dtoSource)
    outputs.file(generatedPages)
    doLast {
        val source = dtoSource.readText()
        val start = source.indexOf("@Serializable\nclass ChapterPages(")
        val end = source.indexOf("private val DATE_REGEX", start)
        check(start >= 0 && end > start) { "Could not locate the production ChapterPages DTO" }
        generatedPages.get().asFile.apply {
            parentFile.mkdirs()
            writeText("""
                package eu.kanade.tachiyomi.extension.en.comix
                import kotlinx.serialization.Serializable
                import kotlinx.serialization.SerialName
            """.trimIndent() + "\n" + source.substring(start, end))
        }
    }
}

val generatedImage = layout.buildDirectory.file("generated/image/ImageHarness.kt")
val generateImageHarness = tasks.register("generateImageHarness") {
    inputs.file(productionSource)
    outputs.file(generatedImage)
    doLast {
        val source = productionSource.readText()
        fun section(start: String, end: String): String {
            val from = source.indexOf(start)
            val until = source.indexOf(end, from)
            check(from >= 0 && until > from)
            return source.substring(from, until)
        }
        val fallback = section("    private fun altHostFallback(", "    private fun proceedWithRetry(")
        val pages = section("    private fun buildPages(", "    override fun getFilterList(")
        val constant = source.lineSequence().single { it.contains("private const val ALT_HOSTS_FRAGMENT") }
        generatedImage.get().asFile.apply {
            parentFile.mkdirs()
            writeText("""
                package eu.kanade.tachiyomi.extension.en.comix
                import eu.kanade.tachiyomi.source.model.Page
                import okhttp3.*
                import okhttp3.HttpUrl.Companion.toHttpUrl
                import java.io.IOException
                class ImageHarness {
                    fun pages(value: ChapterPages) = buildPages(value)
                    fun interceptor() = Interceptor(::altHostFallback)
            """.trimIndent() + "\n" + fallback + pages + "companion object {\n" + constant + "\n}\n}\n")
        }
    }
}

kotlin {
    jvmToolchain(21)
    sourceSets.main {
        kotlin.setSrcDirs(listOf("stubs", comixSourceDir.get(), layout.buildDirectory.dir("generated/refresh"), layout.buildDirectory.dir("generated/resume"), layout.buildDirectory.dir("generated/routing"), layout.buildDirectory.dir("generated/pages"), layout.buildDirectory.dir("generated/image")))
        kotlin.include("**/SChapter.kt", "**/ChapterListMemo.kt", "**/RefreshHost.kt", "**/RefreshHarness.kt", "**/ResumePreferences.kt", "**/ResumeHarness.kt", "**/RoutingHarness.kt", "**/ChapterPages.kt", "**/ImageHarness.kt", "**/Page.kt")
    }
}
tasks.named("compileKotlin") { dependsOn(generateRefreshHarness, generateResumeHarness, generateRoutingHarness, generatePagesHarness, generateImageHarness) }
dependencies {
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.11.0")
    implementation("com.squareup.okhttp3:okhttp:5.4.0")
    testImplementation("junit:junit:4.13.2")
}

tasks.register<JavaExec>("probeImages") {
    dependsOn("testClasses")
    classpath = sourceSets["test"].runtimeClasspath
    mainClass.set("eu.kanade.tachiyomi.extension.en.comix.LiveImageProbeKt")
    args(providers.gradleProperty("pagesFile").orElse("").get())
}
