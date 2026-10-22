# COMIX extension fix

Independent build of [Keiyoushi's COMIX extension](https://github.com/keiyoushi/extensions-source/tree/ff521c17bb3e503c01e658e8fac00b60a95829f3/src/en/comix), version **1.6.57**, build **106057**.

Removes the native-touch chapter-fetching path that can throw a NullPointerException in compatibility runtimes. Chapter pagination now runs through the site's JavaScript methods, without native taps, swipes, or visible pagination controls. The earlier API-proxy discovery fix is retained.

## Install or update

Refresh your reader's extension repository and update COMIX to **1.6.57**.

- [Release and checksums](https://github.com/xInsanityVoid/comix-extension/releases/tag/v1.6.57)
- [Android APK](https://github.com/xInsanityVoid/comix-extension/releases/download/v1.6.57/tachiyomi-en.comix-v1.6.57.apk)
- [Extension JAR](https://github.com/xInsanityVoid/comix-extension/releases/download/v1.6.57/tachiyomi-en.comix-v1.6.57.jar)

Repository URL:

```text
https://raw.githubusercontent.com/xInsanityVoid/comix-extension/repo/index.pb
```

[Repository descriptor](https://raw.githubusercontent.com/xInsanityVoid/comix-extension/repo/repo.json). The repository uses upstream's protobuf format and requires extension API 1.6. Both the APK and repository index advertise build **106057**.

The package, source ID and signing key are unchanged from our previous builds. Updates from this repository do not require uninstalling. On Android, switching from the official Keiyoushi-signed APK requires uninstalling only that extension first; keep the reader and library.

## Cause and changes

The previous chapter-list implementation sent Android MotionEvents through a WebView. Before every gesture, it read `view.resources.displayMetrics`. In [Tachimanga's published compatibility implementation](https://github.com/tachimanga/Tachidesk-Server/blob/2e52214106ffab02d13ff61a620def78414a8a45/AndroidCompat/src/main/java/android/view/View.java#L2465), `getResources()` returns null and `dispatchTouchEvent()` returns false. This is a concrete null dereference in the old path; guarding it would still leave pagination without input.

Version 1.6.57 removes the touch bridge and Swipe.kt. It discovers the site's exported JavaScript activity callback by function shape and invokes it before the site's chapter-pagination method. It does not hardcode the site's changing export names. Missing or ambiguous callbacks fail discovery instead of choosing a random function. The site's own client still performs signing and decoding.

Paging remains sequential, with a 2.5–5 second delay in JavaScript as well as the existing shared request pacing. A progress bridge keeps long chapter walks alive on hosts that do not report WebView resource requests. Failed or truncated walks remain marked incomplete, preserving previously stored chapters.

## Validation

- WebKit 26.5 and Chromium: each fetched 311 unique chapter entries across 16 API pages, plus a complete one-chapter title.
- Both engines ran with no native-input bridge, no touch support, and the entire chapter section hidden.
- Fifteen regression tests cover proxy discovery, direct function exports, pagination without layout/input, request pacing and progress, known-chapter stopping, empty lists, failed requests, wrong-title responses, ambiguous callbacks and capped lists.
- Release assembly and release lint passed (0 errors; 2 existing generated-manifest warnings).
- APK signature verified; APK/JAR JavaScript matches the tested source.
- The null dereference was identified in the published compatibility source. An actual Tachimanga device was not available; WebKit testing is not a claim of end-to-end Tachimanga validation.

## Rebuild

Apply `comix-fix.patch` to upstream revision `ff521c17bb3e503c01e658e8fac00b60a95829f3`, configure an Android SDK, and run:

```text
gradlew :src:en:comix:spotlessApply :src:en:comix:lintRelease :src:en:comix:assembleRelease
```

Run the regression tests with Node.js:

```text
node --experimental-vm-modules --test tests/site-api.test.cjs tests/chapter-list.test.cjs
```

Signing certificate SHA-256: `f3d9ad42724b8269e1f0b78339fafa150da8c436b811e17225ad9759260b7264`. The private signing key is not published. Independently signed rebuilds have a different fingerprint.

This repository is independent of Keiyoushi and COMIX and does not automatically track upstream updates. Code is based on Keiyoushi under Apache-2.0; see [LICENSE](LICENSE). This fix was prepared and published with AI assistance.
