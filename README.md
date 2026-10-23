# COMIX extension fix

Independent build of [Keiyoushi's COMIX extension](https://github.com/keiyoushi/extensions-source/tree/ff521c17bb3e503c01e658e8fac00b60a95829f3/src/en/comix), version **1.6.63**, build **106063**.

Repairs chapter-list and chapter-image API discovery for COMIX's changed JavaScript. Includes the previous refresh-speed, timeout-recovery and missing-chapter fixes.

## Install or update

Refresh your reader's existing extension repository and update COMIX to **1.6.63**. Keep **Faster chapter list fetching** enabled.

- [Release and checksums](https://github.com/xInsanityVoid/comix-extension/releases/tag/v1.6.63)
- [Android APK](https://github.com/xInsanityVoid/comix-extension/releases/download/v1.6.63/tachiyomi-en.comix-v1.6.63.apk)
- [Extension JAR](https://github.com/xInsanityVoid/comix-extension/releases/download/v1.6.63/tachiyomi-en.comix-v1.6.63.jar)

Repository URL:

```text
https://raw.githubusercontent.com/xInsanityVoid/comix-extension/repo/index.pb
```

[Repository descriptor](https://raw.githubusercontent.com/xInsanityVoid/comix-extension/repo/repo.json). The repository uses upstream's protobuf format and requires extension API 1.6. The APK and index both advertise build **106063**.

The package, source ID and signing key are unchanged. Updating from our earlier builds does not require uninstalling. On Android, switching from the official Keiyoushi-signed APK requires uninstalling only that extension first; keep the reader and library.

## Changes in 1.6.63

COMIX changed two parts of its generated JavaScript: the GET helper now refers to separate character-code constants, and chapter pagination uses a shared list mapper. Build 62's function-shape checks no longer recognized either function, producing the chapter API discovery error.

Discovery recognizes both the earlier forms and the new forms without depending on their changing function names. Similar methods exist for manga and group chapter lists, so the extension verifies the exact manga endpoint and unchanged pagination parameters before selecting one. The verification intercepts the method's synchronous GET call locally; it does not send candidate requests. Duplicate references are ignored, and ambiguous endpoints or failed interception produce an error instead of guessing.

The updated GET discovery is also used when loading a chapter's image list. The existing request pacing, chapter-16 fix, hidden-upload checkpoints and resumable full fetches are retained.

Every refresh still contacts the live API. Large initial imports can still take around a minute or longer. If a full fetch times out, retry the title promptly: saved batches can be reused after checking the live first page. Recovery checkpoints expire five minutes after the last new batch and are bounded to eight titles / 1 MiB per title. Partial lists cannot overwrite a complete library list.

## Validation

- Reproduced build 62's chapter API discovery failure against the current site JavaScript.
- WebKit and Chromium each fetched all 133 Bacteriomancer entries, including all three chapter-16 uploads, and loaded that chapter's 99 image entries.
- Both engines resumed a capped Shepherd Wizard fetch and returned all 314 entries, matching every baseline ID without fetching the saved second and third pages again.
- All 40 JavaScript regressions pass, covering current/older API forms, manga/group method selection, duplicate references, rejected endpoint/parameter mismatches and failed interception. The 21 Kotlin metadata/refresh/cache tests also pass.
- Release formatting, assembly and lint passed (0 errors; 2 existing generated-manifest warnings).
- APK/JAR signatures, build number and packaged JavaScript verified.

Live results are in `tests/api-change-v63.json`; prior-release performance records are retained. These are desktop-browser tests with images/fonts/media and unrelated third-party resources blocked. They do not include native-host pacing or establish actual iPhone performance. An actual Tachimanga device was unavailable.

## Rebuild

Apply `comix-fix.patch` to upstream revision `ff521c17bb3e503c01e658e8fac00b60a95829f3`, configure an Android SDK, and run:

```text
gradlew :src:en:comix:spotlessApply :src:en:comix:lintRelease :src:en:comix:assembleRelease
```

Run regression tests:

```text
node --experimental-vm-modules --test tests/site-api.test.cjs tests/chapter-list.test.cjs
/path/to/upstream/gradlew -p tests/memo test
```

The Kotlin harnesses compile the production metadata helper and extract the unchanged production refresh/cache methods with host dependencies stubbed. Device integration is outside their coverage.

Signing certificate SHA-256: `f3d9ad42724b8269e1f0b78339fafa150da8c436b811e17225ad9759260b7264`. The private signing key is not published. Independently signed rebuilds have a different fingerprint.

This repository is independent of Keiyoushi and COMIX and does not automatically track upstream updates. Code is based on Keiyoushi under Apache-2.0; see [LICENSE](LICENSE). Exported API recovery is adapted from [PR #20223](https://github.com/keiyoushi/extensions-source/pull/20223), including its readable sources at commit 794e11a. These fixes were prepared and published with AI assistance.
