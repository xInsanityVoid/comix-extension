# COMIX extension fix

Independent build of [Keiyoushi's COMIX extension](https://github.com/keiyoushi/extensions-source/tree/ff521c17bb3e503c01e658e8fac00b60a95829f3/src/en/comix), version **1.6.67**, build **106067**.

Fixes missing covers caused by COMIX returning relative image paths. Retains the existing chapter refresh, image fallback, search, filter and recovery fixes.

## Install or update

Refresh your reader's existing extension repository and update COMIX to **1.6.67**. Then refresh affected series to replace cover URLs saved by an older build. Keep **Faster chapter list fetching** enabled.

- [Release and checksums](https://github.com/xInsanityVoid/comix-extension/releases/tag/v1.6.67)
- [Android APK](https://github.com/xInsanityVoid/comix-extension/releases/download/v1.6.67/tachiyomi-en.comix-v1.6.67.apk)
- [Extension JAR](https://github.com/xInsanityVoid/comix-extension/releases/download/v1.6.67/tachiyomi-en.comix-v1.6.67.jar)

Repository URL:

```text
https://raw.githubusercontent.com/xInsanityVoid/comix-extension/repo/index.pb
```

[Repository descriptor](https://raw.githubusercontent.com/xInsanityVoid/comix-extension/repo/repo.json). The repository uses upstream's protobuf format and requires extension API 1.6. The APK and index both advertise build **106067**.

The package, source ID and signing key are unchanged. Updating from our earlier builds does not require uninstalling. On Android, switching from the official Keiyoushi-signed APK requires uninstalling only that extension first; keep the reader and library.

## Changes in 1.6.67

COMIX now mixes absolute CDN cover URLs with relative paths such as `/images/covers/47780/...@280.jpg`. Build 66 passed both formats straight to the reader. Relative paths have no domain and cannot be used as image request URLs.

This build resolves cover paths against the selected COMIX mirror before returning browse/search results, series details and related titles. Absolute CDN URLs stay on their original host, and the existing quality selection and missing-size fallback order are preserved. Empty cover values remain empty instead of pointing to the site home page.

Update COMIX, then refresh affected series so Tachimanga can replace any previously saved relative cover URLs. The extension update cannot directly rewrite cover URLs already stored in the reader's library.

## Validation on November 3, 2026

- Popular and latest browse captures succeeded on both mirrors. The combined audit contained 38 relative cover paths and 56 absolute URLs, including saved October 31 URLs. All 56 absolute URLs returned HTTP 200; the 38 relative paths reproduced invalid-URL errors before resolution.
- All 38 relative covers returned HTTP 200 after resolving against `comix.to`, and again against `comix.ws`. Eight additional header-comparison requests also succeeded. All 84 downloaded responses decoded as images.
- The actual production Kotlin Manga/Poster mapping and OkHttp downloaded and decoded 16 additional cover samples: medium and large covers for three titles with relative paths and one with an absolute CDN URL, using both selected mirrors and the current source Origin/Referer headers.
- All 49 JavaScript and 54 Kotlin tests passed. New regression coverage checks browse/detail consistency, each mirror, absolute and protocol-relative URLs, quality fallback, missing covers and invalid schemes.
- Release formatting, assembly and lint passed (0 errors; 2 existing generated-manifest warnings). APK/JAR signatures, assets, source ID and build number verified.

Reviewed official commits through `72b13edd8cb97c8cd289639320cdd445227ffbdd`: [PR #20643](https://github.com/keiyoushi/extensions-source/pull/20643) changes description formatting, and [PR #20573](https://github.com/keiyoushi/extensions-source/pull/20573) migrates request APIs/headers. Neither resolves relative poster URLs. This cover fix does not require a core or Cloudflare change.

See `tests/cover-audit-v67.json` for evidence and scope. Testing used desktop WebKit and JVM OkHttp, not the installed iPhone app. Representative covers were checked, not every catalog entry. Chapter/image API behavior was not re-audited live for this cover-only change; its regression tests passed and the production chapter code is unchanged.

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
