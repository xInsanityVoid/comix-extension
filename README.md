# COMIX extension fix

Independent build of [Keiyoushi's COMIX extension](https://github.com/keiyoushi/extensions-source/tree/ff521c17bb3e503c01e658e8fac00b60a95829f3/src/en/comix), version **1.6.66**, build **106066**.

Fixes author/tag search and aligns content-rating and demographic filters with the current site. Retains the existing chapter refresh, image fallback, recovery, mirror-link and CAPTCHA-header fixes.

## Install or update

Refresh your reader's existing extension repository and update COMIX to **1.6.66**. Keep **Faster chapter list fetching** enabled.

- [Release and checksums](https://github.com/xInsanityVoid/comix-extension/releases/tag/v1.6.66)
- [Android APK](https://github.com/xInsanityVoid/comix-extension/releases/download/v1.6.66/tachiyomi-en.comix-v1.6.66.apk)
- [Extension JAR](https://github.com/xInsanityVoid/comix-extension/releases/download/v1.6.66/tachiyomi-en.comix-v1.6.66.jar)

Repository URL:

```text
https://raw.githubusercontent.com/xInsanityVoid/comix-extension/repo/index.pb
```

[Repository descriptor](https://raw.githubusercontent.com/xInsanityVoid/comix-extension/repo/repo.json). The repository uses upstream's protobuf format and requires extension API 1.6. The APK and index both advertise build **106066**.

The package, source ID and signing key are unchanged. Updating from our earlier builds does not require uninstalling. On Android, switching from the official Keiyoushi-signed APK requires uninstalling only that extension first; keep the reader and library.

## Changes in 1.6.66

The site's author/tag lookup returns a bare list, while the extension's Kotlin parser expected a response object. This build normalizes the JavaScript result before parsing it, prefers case-insensitive exact label matches, and reports an explicit error when no author or tag matches.

Incorporates the search/filter changes from official [PR #20419](https://github.com/keiyoushi/extensions-source/pull/20419), merged as `71552cfb93bb99fd3853c8494c9317e4ee485be3`:

- Content ratings use the site's single comma-separated `content_rating` browse parameter. “Show all” sends an explicit unrestricted selection. Removed the local-storage override that could conflict with a search selection.
- Demographics support include, exclude and ignore. Unticked default demographics are excluded through `genres_ex[]`; explicit search inclusions use `demographics[]`. An empty saved default selection is treated as unrestricted.
- Author/tag selection prefers exact labels, with the site's fuzzy results retained when there is no exact match.

The PR's DOM chapter-list walker changes do not apply to this build's API-based chapter list. The title parsing guard from merged PR #20384 was already included in 1.6.65. Reviewed the new core-header PR #20458; a core rebase is not required for the reproduced search defects. Open PR #20547 uses native browser interaction unavailable in our Tachimanga path, so its pagination approach is not included.

## Validation on October 31, 2026

- Desktop WebKit returned popular, latest, paginated browse, search, empty-search, chapter and image-list results on both `comix.to` and `comix.ws`.
- The old Safe-only URL returned both safe and suggestive titles when a Suggestive site preference was present. The corrected URL returned only safe titles on both mirrors. Demographic exclusions reached the site's API and changed its result total; result rows do not expose demographic IDs, so individual demographic membership was not independently verified.
- Live author lookup returned a normalized exact match for Cheongdam and an explicit empty list for a nonexistent author on both mirrors. Kotlin tests verify native deserialization and exact/fuzzy/no-match selection.
- The tested Bacteriomancer upload was chapter 19 (73 images); Shepherd Wizard was chapter 42 (178 images). First, middle and last primary image requests returned HTTP 200/WebP on both mirrors.
- With primary image hosts deliberately rejected, the actual production Kotlin fallback methods fetched all six sampled images through live alternate hosts. All six decoded successfully. One title exercised the second alternate domain after the first alternate failed.
- All 49 JavaScript and 48 Kotlin tests passed. Release formatting, assembly and lint passed (0 errors; 2 existing generated-manifest warnings). APK/JAR signatures, packaged assets, source identity and build number verified.

See `tests/site-audit-v66.json` for evidence and scope. Tests used desktop WebKit and JVM OkHttp, not a physical iPhone or native Tachimanga. Representative titles were checked, not the entire catalog. Normal requests did not encounter a challenge; no new Cloudflare solver claim is made. Manual WebView verification may still be needed. Existing refresh pacing and resumable full-list behavior remain; large initial imports can still take around a minute or longer.

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

The Kotlin harnesses compile the production chapter memo helper, filters and DTOs, and extract the production refresh/cache, URL/header, page-building and fallback methods. Host model dependencies are stubbed; image transport uses OkHttp. Device integration is outside their coverage. The opt-in `probeImages` task takes `-PpagesFile=/absolute/path/to/live-chapter-payload.json`, deliberately fails each sampled primary host, and downloads images through the production fallback interceptor.

Signing certificate SHA-256: `f3d9ad42724b8269e1f0b78339fafa150da8c436b811e17225ad9759260b7264`. The private signing key is not published. Independently signed rebuilds have a different fingerprint.

This repository is independent of Keiyoushi and COMIX and does not automatically track upstream updates. Code is based on Keiyoushi under Apache-2.0; see [LICENSE](LICENSE). Exported API recovery is adapted from [PR #20223](https://github.com/keiyoushi/extensions-source/pull/20223), including its readable sources at commit 794e11a. These fixes were prepared and published with AI assistance.
