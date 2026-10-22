plugins { kotlin("jvm") version "2.4.10" }

kotlin {
    jvmToolchain(21)
    sourceSets.main {
        kotlin.setSrcDirs(listOf("stubs", "../../src/en/comix/src"))
        kotlin.include("**/SChapter.kt", "**/ChapterListMemo.kt")
    }
}
dependencies {
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.11.0")
    testImplementation("junit:junit:4.13.2")
}
