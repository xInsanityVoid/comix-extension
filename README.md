# COMIX extension fix

Independent build of [Keiyoushi's COMIX extension](https://github.com/keiyoushi/extensions-source/tree/ff521c17bb3e503c01e658e8fac00b60a95829f3/src/en/comix), version **1.6.59**, build **106059**.

Combines the JavaScript API discovery from [Keiyoushi PR #20223, commit 794e11a](https://github.com/keiyoushi/extensions-source/pull/20223/changes/794e11a70d1780eeafcdee47dc6aaa0a1a37e69b) with our existing native-touch compatibility and incremental-refresh fixes.

## Install or update

Refresh your reader's existing extension repository and update COMIX to **1.6.59**.

- [Release and checksums](https://github.com/xInsanityVoid/comix-extension/releases/tag/v1.6.59)
- [Android APK](https://github.com/xInsanityVoid/comix-extension/releases/download/v1.6.59/tachiyomi-en.comix-v1.6.59.apk)
- [Extension JAR](https://github.com/xInsanityVoid/comix-extension/releases/download/v1.6.59/tachiyomi-en.comix-v1.6.59.jar)

Repository URL:

```text
https://raw.githubusercontent.com/xInsanityVoid/comix-extension/repo/index.pb
```

[Repository descriptor](https://raw.githubusercontent.com/xInsanityVoid/comix-extension/repo/repo.json). The repository uses upstream's protobuf format and requires extension API 1.6. Both the APK and repository index advertise build **106059**.

The package, source ID and signing key are unchanged from our previous builds. Updates from this repository do not require uninstalling. On Android, switching from the official Keiyoushi-signed APK requires uninstalling only that extension first; keep the reader and library.

## Combined discovery in 1.6.59

The site's API objects hide their keys and bind their functions. Discovery now recovers method names and original function text from loaded JavaScript assets, following upstream's implementation. This replaces our temporary wrapper around the global Proxy constructor, and works with API objects created before discovery starts.

All loaded JavaScript assets under /assets/ are considered, including alternate /t3/ locations. An unimportable script does not abort the search. Imported modules, script text and recovered members are cached for the duration of discovery.

Our direct-function discovery is retained so pagination can find the site's activity callback. Members from multiple chunks are combined, allowing the callback and API client to come from different files. The site's own client continues to sign and decode requests.

## Retained chapter fixes

- Chapter pagination uses the site's JavaScript activity callback. It does not send Android MotionEvents or require visible chapter controls.
- Refresh metadata is found regardless of the order in which a reader supplies stored chapters. Routine updates can stop at a known chapter with **Faster chapter list fetching** enabled (the default).
- Sequential requests retain the 2.5-5 second JavaScript pacing and existing shared request pacing.
- Data-request inactivity timeout remains 60 seconds, with a JavaScript progress bridge for hosts that do not report WebView requests.
- Failed or truncated walks remain marked incomplete and preserve stored chapters. Changed filters and incomplete lists still require full refreshes.

These address concrete behavior in [Tachimanga's published compatibility source](https://github.com/tachimanga/Tachidesk-Server/tree/2e52214106ffab02d13ff61a620def78414a8a45): its View.getResources returns null, and its stored chapter list is supplied in descending source order. The removed touch code dereferenced view.resources.displayMetrics; the old refresh code looked for metadata only on the first supplied chapter.

Initial imports and forced full refreshes remain paced by COMIX. This build does not change a reader's own timeout. Trials of larger batches and faster request rates in the previous release were rejected by the site and are not included.

## Validation

- Live WebKit and Chromium: 35 simulated new entries in a 311-entry title were found in 2 chapter requests, about 8.7 and 8.6 seconds respectively.
- Live WebKit and Chromium: full 311-entry lists across 16 API pages and a complete one-chapter title, with chapter controls hidden and no native input bridge.
- Live WebKit: chapter reader returned 55 image-page entries.
- 20 JavaScript tests cover hidden API recovery, alternate asset paths, cross-chunk callbacks, source-fetch caching, import failures, late chunks, pagination without layout/input, pacing/progress, known-chapter stopping and incomplete-list handling.
- 5 Kotlin regression tests for the production metadata-selection helper remain passing through Gradle's unchanged test cache.
- Release assembly, formatting and release lint passed (0 errors; 2 existing generated-manifest warnings).
- APK signature and build number verified; packaged APK/JAR JavaScript matches the tested source.

An actual Tachimanga device was unavailable. Browser and compatibility-source checks are not a claim of end-to-end testing on the Apple app.

## Rebuild

Apply comix-fix.patch to upstream revision `ff521c17bb3e503c01e658e8fac00b60a95829f3`, configure an Android SDK, and run:

```text
gradlew :src:en:comix:spotlessApply :src:en:comix:lintRelease :src:en:comix:assembleRelease
```

Run the JavaScript regression tests with Node.js:

```text
node --experimental-vm-modules --test tests/site-api.test.cjs tests/chapter-list.test.cjs
```

Run the Kotlin regression tests with the upstream Gradle wrapper (JDK 21):

```text
/path/to/upstream/gradlew -p tests/memo test
```

Signing certificate SHA-256: `f3d9ad42724b8269e1f0b78339fafa150da8c436b811e17225ad9759260b7264`. The private signing key is not published. Independently signed rebuilds have a different fingerprint.

This repository is independent of Keiyoushi and COMIX and does not automatically track upstream updates. Code is based on Keiyoushi under Apache-2.0; see [LICENSE](LICENSE). API source recovery is adapted from PR #20223, including its readable sources at commit 794e11a. This combined fix was prepared and published with AI assistance.
