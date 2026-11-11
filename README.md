# COMIX extension fix

Independent build of [Keiyoushi's COMIX extension](https://github.com/keiyoushi/extensions-source/tree/ff521c17bb3e503c01e658e8fac00b60a95829f3/src/en/comix), version **1.6.68**, build **106068**.

Fetches 100 chapter entries per request with the existing 2.5-5 second pagination interval, reducing the requests needed for longer lists. Retains the cover, image fallback, search, filter and refresh recovery fixes.

## Install or update

Refresh your reader's existing extension repository and update COMIX to **1.6.68**. Keep **Faster chapter list fetching** enabled.

- [Release and checksums](https://github.com/xInsanityVoid/comix-extension/releases/tag/v1.6.68)
- [Android APK](https://github.com/xInsanityVoid/comix-extension/releases/download/v1.6.68/tachiyomi-en.comix-v1.6.68.apk)
- [Extension JAR](https://github.com/xInsanityVoid/comix-extension/releases/download/v1.6.68/tachiyomi-en.comix-v1.6.68.jar)

Repository URL:

```text
https://raw.githubusercontent.com/xInsanityVoid/comix-extension/repo/index.pb
```

[Repository descriptor](https://raw.githubusercontent.com/xInsanityVoid/comix-extension/repo/repo.json). The repository uses upstream's protobuf format and requires extension API 1.6. The APK and index both advertise build **106068**.

The package, source ID and signing key are unchanged. Updating from our earlier builds does not require uninstalling. On Android, switching from the official Keiyoushi-signed APK requires uninstalling only that extension first; keep the reader and library.

## Changes in 1.6.68

Adopts the larger-batch approach discussed in official [PR #20547](https://github.com/keiyoushi/extensions-source/pull/20547), reviewed at head `9a17afffe79a2905e7cffd67e33fe54e97302bda` (still open). COMIX now accepts 100 entries per chapter-list request. The extension requests 100 instead of 20 while retaining sequential requests and the existing 2.5-5 second interval in both the JavaScript and native pacing paths.

This uses our existing API discovery and raw-response mapping. It does not require the PR's native tap/display implementation. Returned chapter IDs and metadata remain the same. Stored progress now records its page size; progress from older 20-entry builds is discarded and re-fetched so an interrupted refresh cannot resume at the wrong offset. Known-chapter stopping and incomplete-list rejection remain covered by regression tests.

The PR discussion reports CAPTCHA failures from bursts and tighter intervals, then a clean paced 100-entry walk. We adopted the batch size without changing the interval. This reduces requests; it does not guarantee a particular speed on every device/network, and very large initial imports can still take minutes.

## Validation on November 10, 2026

Fresh desktop WebKit contexts, no native taps, no saved chapter progress, same network:

| Case | Chapter entries | Extension chapter requests | Elapsed |
| --- | ---: | ---: | ---: |
| Shepherd Wizard, 1.6.67 behavior, comix.to | 337 | 17 | 65.240 s |
| Shepherd Wizard, 100-entry candidate, comix.to | 337 | 4 | 13.729 s |
| Shepherd Wizard, final 1.6.68 JavaScript, comix.ws | 337 | 4 | 12.992 s |

The two batch sizes returned identical chapter IDs, URLs, numbers, names, votes, scanlator groups and official flags. All observed chapter requests returned HTTP 200 with `v=0&w=0`. The site also made one separate default 20-entry request per navigation; that request is excluded from the extension-request counts above. No CAPTCHA appeared during these runs.

- All 52 JavaScript and 54 Kotlin regression tests passed, including 100-entry boundaries, known-chapter stopping, failed-page recovery, incompatible saved offsets and incomplete-list rejection.
- Release formatting, assembly and lint passed (0 errors; 2 existing generated-manifest warnings). APK/JAR signatures, assets, source identity and build number verified.
- The comix.to candidate changed only the request size and resume-length arithmetic; the final implementation also names the page-size constant and tags saved progress. The comix.ws run used that final implementation.

See `tests/chapter-batching-v68.json` for request timing and comparison evidence. This is one representative title on one network, not a catalog-wide or fresh-IP CAPTCHA test. The installed iPhone app and Tachimanga 5.4 beta were not directly tested. Covers and image transport were not re-audited live for this change; their code is unchanged and regression tests passed.

## Rebuild

Apply `comix-fix.patch` to upstream revision `ff521c17bb3e503c01e658e8fac00b60a95829f3`, configure an Android SDK, and run:

```text
gradlew :src:en:comix:spotlessApply :src:en:comix:lintRelease :src:en:comix:assembleRelease
```

Run regression tests:

```text
node --experimental-vm-modules --test tests/site-api.test.cjs tests/chapter-list.test.cjs tests/details.test.cjs tests/tags-search.test.cjs
/path/to/upstream/gradlew -p tests/memo test
```

The Kotlin harnesses compile the production chapter memo helper, filters and DTOs, and extract the production refresh/cache, URL/header, page-building and fallback methods. Host model dependencies are stubbed; image transport uses OkHttp. The production Manga DTO also supplies cover mapping tests. Device integration is outside their coverage. The opt-in `probeImages` task takes `-PpagesFile=/absolute/path/to/live-chapter-payload.json`, deliberately fails each sampled primary host, and downloads images through the production fallback interceptor.

Signing certificate SHA-256: `f3d9ad42724b8269e1f0b78339fafa150da8c436b811e17225ad9759260b7264`. The private signing key is not published. Independently signed rebuilds have a different fingerprint.

This repository is independent of Keiyoushi and COMIX and does not automatically track upstream updates. Code is based on Keiyoushi under Apache-2.0; see [LICENSE](LICENSE). Exported API recovery is adapted from [PR #20223](https://github.com/keiyoushi/extensions-source/pull/20223), including its readable sources at commit 794e11a. These fixes were prepared and published with AI assistance.

The opt-in `probeCovers` task takes `-PcoversFile=/absolute/path/to/captured-browse.json`, maps cover URLs using production code, and downloads medium/large samples on both mirrors.
