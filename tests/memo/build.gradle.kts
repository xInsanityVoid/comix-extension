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

kotlin {
    jvmToolchain(21)
    sourceSets.main {
        kotlin.setSrcDirs(listOf("stubs", comixSourceDir.get(), layout.buildDirectory.dir("generated/refresh")))
        kotlin.include("**/SChapter.kt", "**/ChapterListMemo.kt", "**/RefreshHost.kt", "**/RefreshHarness.kt")
    }
}
tasks.named("compileKotlin") { dependsOn(generateRefreshHarness) }
dependencies {
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.11.0")
    testImplementation("junit:junit:4.13.2")
}
