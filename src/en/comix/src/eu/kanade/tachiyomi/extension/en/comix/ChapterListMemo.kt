package eu.kanade.tachiyomi.extension.en.comix

import eu.kanade.tachiyomi.source.model.SChapter
import kotlinx.serialization.json.JsonObject

const val CHAPTER_LIST_DEDUPLICATED_MEMO = "chapterListDeduplicated"
const val CHAPTER_LIST_BLACKLIST_MEMO = "chapterListBlacklist"
const val CHAPTER_LIST_COMPLETE_MEMO = "chapterListComplete"
const val CHAPTER_LIST_FETCHED_AT_MEMO = "chapterListFetchedAt"

// Readers can pass oldest-first lists; the refresh state is stored on the newest selected chapter.
internal fun List<SChapter>.chapterListMemo(): JsonObject? = asSequence()
    .filter { CHAPTER_LIST_DEDUPLICATED_MEMO in it.memo }
    .maxByOrNull { it.chapter_number }
    ?.memo
