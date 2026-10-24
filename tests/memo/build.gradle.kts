plugins { kotlin("jvm") version "2.4.10" }

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

kotlin {
    jvmToolchain(21)
    sourceSets.main {
        kotlin.setSrcDirs(listOf("stubs", comixSourceDir.get(), layout.buildDirectory.dir("generated/refresh"), layout.buildDirectory.dir("generated/resume"), layout.buildDirectory.dir("generated/routing")))
        kotlin.include("**/SChapter.kt", "**/ChapterListMemo.kt", "**/RefreshHost.kt", "**/RefreshHarness.kt", "**/ResumePreferences.kt", "**/ResumeHarness.kt", "**/RoutingHarness.kt")
    }
}
tasks.named("compileKotlin") { dependsOn(generateRefreshHarness, generateResumeHarness, generateRoutingHarness) }
dependencies {
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.11.0")
    testImplementation("junit:junit:4.13.2")
}
