# COMIX extension fix

Independent build of [Keiyoushi's COMIX extension](https://github.com/keiyoushi/extensions-source/tree/ff521c17bb3e503c01e658e8fac00b60a95829f3/src/en/comix), version **1.6.62**, build **106062**.

Chapter refreshes retain progress when the reader times out, and the first API request starts without an artificial delay. Includes the previous API-discovery, filtered-upload checkpoint and missing-chapter fixes.

## Install or update

Refresh your reader's existing extension repository and update COMIX to **1.6.62**. Keep **Faster chapter list fetching** enabled. If a large title times out, refresh that title again promptly: this build can continue from its saved batches.

- [Release and checksums](https://github.com/xInsanityVoid/comix-extension/releases/tag/v1.6.62)
- [Android APK](https://github.com/xInsanityVoid/comix-extension/releases/download/v1.6.62/tachiyomi-en.comix-v1.6.62.apk)
- [Extension JAR](https://github.com/xInsanityVoid/comix-extension/releases/download/v1.6.62/tachiyomi-en.comix-v1.6.62.jar)

Repository URL:

```text
https://raw.githubusercontent.com/xInsanityVoid/comix-extension/repo/index.pb
```

[Repository descriptor](https://raw.githubusercontent.com/xInsanityVoid/comix-extension/repo/repo.json). The repository uses upstream's protobuf format and requires extension API 1.6. Both the APK and repository index advertise build **106062**.

The package, source ID and signing key are unchanged from our previous builds. Updates from this repository do not require uninstalling. On Android, switching from the official Keiyoushi-signed APK requires uninstalling only that extension first; keep the reader and library.

## Changes in 1.6.62

The Shepherd Wizard has 314 scanlation entries. A full fetch on the previous build took 60.3 seconds in a desktop WebKit test. If the reader cancelled it, the next attempt started at page one again because no completed list had reached the app.

Full fetches now save each completed batch in the source's preferences. On retry, the extension first checks the live first page. It reuses progress only when the title, first-page IDs, total and page count still match, and the saved entries are valid and unique. A changed head, changed total, invalid state or expired checkpoint causes a fresh walk. Partial lists still return an error; they cannot replace a complete library list.

Checkpoints expire five minutes after the last new batch. A completed checkpoint is retained briefly in case the reader lost the final response; reusing it does not extend its expiry. The cache holds at most eight titles and 1 MiB per title. Cache-storage errors do not fail a chapter refresh.

The first API request no longer waits 2.5–5 seconds before starting. Later requests retain the tested 20-entry batch size and pacing. Shared native request pacing remains in place for hosts that intercept WebView traffic, including overlapping title requests. Larger batches and shorter delays triggered server rejections in live testing and are not used.

Every check still contacts the live chapter API. Successful normal updates continue to remember the newest raw upload, including uploads hidden by scanlator filtering or chapter deduplication. Changing those settings rebuilds the selected list from the full raw data; a recent validated recovery checkpoint may supply already-fetched batches. Existing chapter dates are preserved.

This improves recovery from timeouts and removes the initial wait. It does **not** make the first full fetch instantaneous or change the reader's own timeout. Initial imports can still take around a minute for this title, and longer for larger lists. A retry after the cache expires must start over. Private API discovery, native-free requests and the previous chapter-16 fix are retained.

## Validation

The exact short URL `https://comix.to/title/vwk5z` was tested in desktop Playwright WebKit and Chromium. The recovery tests kept the same browser context between page loads.

| Scenario | WebKit | Chromium |
| --- | ---: | ---: |
| Fetch interrupted after 300 entries | 56.8 s | 52.6 s |
| Retry finishes all 314 entries | 3.9 s | 3.4 s |
| Recover a lost completed response | 0.5 s | 0.6 s |
| Normal check with saved newest upload | 0.6 s | 0.6 s |
| Check with 35 new uploads | 3.8 s | 3.6 s |

Both recovery results matched every ID in the complete 314-entry baseline. Both new-upload checks found all 35 expected entries across two pages. The live benchmark records are in `tests/performance-v62.json`; prior-release benchmarks remain in `tests/performance-results.json`.

- 31 JavaScript regression tests passed, including interruption recovery, expiry, changed heads, corrupt checkpoints and incomplete results.
- 21 Kotlin tests passed. They compile the production metadata helper and extract the unchanged production refresh/cache methods into lightweight host harnesses. Cache recreation, eviction, UTF-8 size bounds and storage failures are covered.
- Release formatting, assembly and lint passed (0 lint errors; 2 existing generated-manifest warnings).
- APK signature and build number verified; packaged APK/JAR JavaScript matches the tested source.

These timings exercise the JavaScript in desktop browsers, with images/fonts/media blocked. They do not include native-host pacing or prove iPhone performance. An actual Tachimanga device was unavailable for end-to-end testing.

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

Android/reader dependencies are stubbed in the Kotlin harnesses; device integration is outside their coverage.

Signing certificate SHA-256: `f3d9ad42724b8269e1f0b78339fafa150da8c436b811e17225ad9759260b7264`. The private signing key is not published. Independently signed rebuilds have a different fingerprint.

This repository is independent of Keiyoushi and COMIX and does not automatically track upstream updates. Code is based on Keiyoushi under Apache-2.0; see [LICENSE](LICENSE). Exported API recovery is adapted from [PR #20223](https://github.com/keiyoushi/extensions-source/pull/20223), including its readable sources at commit 794e11a. These fixes were prepared and published with AI assistance.
