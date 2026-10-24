# COMIX extension fix

Independent build of [Keiyoushi's COMIX extension](https://github.com/keiyoushi/extensions-source/tree/ff521c17bb3e503c01e658e8fac00b60a95829f3/src/en/comix), version **1.6.64**, build **106064**.

Fixes cross-mirror title links and CAPTCHA request detection. Retains the previous chapter API, refresh-speed, timeout-recovery and missing-chapter fixes.

## Install or update

Refresh your reader's existing extension repository and update COMIX to **1.6.64**. Keep **Faster chapter list fetching** enabled.

- [Release and checksums](https://github.com/xInsanityVoid/comix-extension/releases/tag/v1.6.64)
- [Android APK](https://github.com/xInsanityVoid/comix-extension/releases/download/v1.6.64/tachiyomi-en.comix-v1.6.64.apk)
- [Extension JAR](https://github.com/xInsanityVoid/comix-extension/releases/download/v1.6.64/tachiyomi-en.comix-v1.6.64.jar)

Repository URL:

```text
https://raw.githubusercontent.com/xInsanityVoid/comix-extension/repo/index.pb
```

[Repository descriptor](https://raw.githubusercontent.com/xInsanityVoid/comix-extension/repo/repo.json). The repository uses upstream's protobuf format and requires extension API 1.6. The APK and index both advertise build **106064**.

The package, source ID and signing key are unchanged. Updating from our earlier builds does not require uninstalling. On Android, switching from the official Keiyoushi-signed APK requires uninstalling only that extension first; keep the reader and library.

## Changes in 1.6.64

Title links from either `comix.to` or `comix.ws`, including their `www` aliases, are accepted regardless of the currently selected mirror. Previously a link from the other mirror was rejected. The existing title parsing and selected-mirror routing are retained.

CAPTCHA HTML request detection now accepts lowercase or mixed-case `Accept` headers and media types, and tolerates missing headers. JSON and `*/*` fetch requests still pass through so the solver cannot recursively replace its own request.

Compared against official COMIX commit `70476a1a69459eb31176df6667ba376fd22b3daf`, including [PR #20265](https://github.com/keiyoushi/extensions-source/pull/20265) and [PR #20337](https://github.com/keiyoushi/extensions-source/pull/20337). Those changes move upstream toward reading the rendered site. This build retains its working API discovery. The extensionless-image problem described in open [PR #20348](https://github.com/keiyoushi/extensions-source/pull/20348) does not affect our API image-list path; live `/hi/...` image URLs were accepted. The official CAPTCHA solver is byte-for-byte identical to ours.

Every refresh still contacts the live API. Large initial imports can take around a minute or longer. If a full fetch times out, retry the title promptly: saved batches can be reused after checking the live first page. Recovery checkpoints expire five minutes after the last new batch and are bounded to eight titles / 1 MiB per title. Partial lists cannot overwrite a complete library list.

## Validation on October 24, 2026

- Desktop WebKit checked both mirrors; Chromium also checked `comix.to`. Popular browsing and pagination, latest updates, relevance-ordered search, empty search, author lookup, chapter lists and page lists returned valid results. Search put The Shepherd Wizard first on both mirrors.
- Checked short and slugged title URLs, title metadata and cover images. Bacteriomancer returned chapter 16; its latest tested upload had 87 image entries. The tested Shepherd Wizard chapter had 183 image entries. These are representative titles, not a scan of the entire catalog.
- Downloaded and decoded sampled chapter images. One Bacteriomancer primary image host failed TLS; the existing site-provided alternate-host sequence returned valid images at the first, middle and last positions. No new image fallback was necessary.
- Both mirrors still expose the same Cloudflare Turnstile challenge and verification endpoints. In a controlled WebKit iframe test, the existing solver loaded the widget but did **not** complete verification and returned its WebView instruction. Automatic Cloudflare completion is not established by these tests; manual verification may still be needed.
- All 40 JavaScript and 27 Kotlin regression tests passed. Release formatting, assembly and lint passed (0 errors; 2 existing generated-manifest warnings). APK/JAR signatures, build number and packaged assets verified.

The audit record is in `tests/site-audit-v64.json`. Prior-release performance and API-change records are retained. Browser tests block images/fonts/media and unrelated third-party resources during metadata fetches; image downloads are tested separately. They do not include native-host pacing or establish actual iPhone performance. An actual Tachimanga device was unavailable, so native WebView interception and challenge completion remain unverified on iOS.

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

The Kotlin harnesses compile the production metadata helper and extract the unchanged production refresh/cache methods and URL/header helpers with host dependencies stubbed. Device integration is outside their coverage.

Signing certificate SHA-256: `f3d9ad42724b8269e1f0b78339fafa150da8c436b811e17225ad9759260b7264`. The private signing key is not published. Independently signed rebuilds have a different fingerprint.

This repository is independent of Keiyoushi and COMIX and does not automatically track upstream updates. Code is based on Keiyoushi under Apache-2.0; see [LICENSE](LICENSE). Exported API recovery is adapted from [PR #20223](https://github.com/keiyoushi/extensions-source/pull/20223), including its readable sources at commit 794e11a. These fixes were prepared and published with AI assistance.
