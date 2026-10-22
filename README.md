# COMIX extension fix

Independent build of [Keiyoushi's COMIX extension](https://github.com/keiyoushi/extensions-source/tree/ff521c17bb3e503c01e658e8fac00b60a95829f3/src/en/comix), version **1.6.56**.

Fixes **"The chapter list has nothing to tap"**, while retaining the earlier **"Could not find the site's chapter API"** fix.

## Download

- [Download the Android APK](https://github.com/xInsanityVoid/comix-extension/releases/download/v1.6.56/tachiyomi-en.comix-v1.6.56.apk)
- [Release and checksums](https://github.com/xInsanityVoid/comix-extension/releases/tag/v1.6.56)
- [Download the extension JAR](https://github.com/xInsanityVoid/comix-extension/releases/download/v1.6.56/tachiyomi-en.comix-v1.6.56.jar)

## Add the extension repository

Use this URL in your reader's extension-repository settings:

```text
https://raw.githubusercontent.com/xInsanityVoid/comix-extension/repo/index.pb
```

Repository descriptor: [repo.json](https://raw.githubusercontent.com/xInsanityVoid/comix-extension/repo/repo.json). This uses the same protobuf repository format as the current upstream repository. The build requires a reader supporting extension API **1.6**.

## Replacing the official COMIX extension

If you already installed version 1.6.55 from this repository, install this update directly: the signing key is unchanged.

This APK has an independent signing certificate. Android cannot install it over the official signed COMIX APK. If switching from the official build, uninstall **only the COMIX extension**, install this APK, and trust it in your reader if prompted. Keep your reader app and manga library. The COMIX source ID and package name are preserved, so existing library entries should reconnect. Extension preferences may need to be set again.

This repository is independent of Keiyoushi and COMIX. It contains only COMIX and does not automatically track future upstream releases.

Certificate SHA-256:

```text
f3d9ad42724b8269e1f0b78339fafa150da8c436b811e17225ad9759260b7264
```

## What changed

COMIX wraps its API objects in proxies that hide keys and return bound functions. The old discovery logic could not enumerate those methods. The fix tracks proxy targets during document initialization, uses the underlying objects for API discovery, and restores the original Proxy constructor after discovery finishes or fails. The site's proxy behavior is preserved.

Version 1.6.56 removes the dependency on visible pagination buttons. The site's request checks observe trusted input on the document; they do not require a particular pagination button. Chapter fetching now waits for chapter content and a rendered heading, then taps that heading. This works when pagination is hidden, clipped, not yet laid out, or absent for short lists.

## Validation

- Android 16 emulator, detached Android WebView 133: fetched all 311 chapter entries across 16 API pages for a live title.
- The same Android test fetched a complete one-chapter title with no pagination.
- Hidden-pagination regression: version 1.6.55 reproduced "The chapter list has nothing to tap"; version 1.6.56 fetched all 311 entries with the pager hidden.
- Thirteen focused regression tests passed, covering API proxies, hidden/absent pagination, delayed content/layout, empty lists, and stop-at-known behavior.
- The earlier page-reader test returned 55 pages; that script is unchanged.
- Release build and release lint passed (0 errors; 2 generated-manifest warnings).
- APK signature verified; packaged JavaScript matched the tested source.
- Android testing used a dedicated harness with the extension's actual JavaScript, detached WebView settings, native touch input, and request pacing. The user's exact reader/device was not available.

## Rebuild

The `src/en/comix` directory contains the patched module. The full build infrastructure comes from upstream at `ff521c17bb3e503c01e658e8fac00b60a95829f3`. Apply `comix-fix.patch` to that revision, configure an Android SDK, then run:

```text
gradlew :src:en:comix:spotlessApply :src:en:comix:lintRelease :src:en:comix:assembleRelease
```

To reproduce the published signing identity, the private signing key is required; it is not included in this public repository. Independently signed rebuilds will have a different fingerprint.

Run the discovery tests with Node.js:

```text
node --experimental-vm-modules tests/site-api.test.cjs
node tests/chapter-list.test.cjs
```

Code is based on Keiyoushi under Apache-2.0; see [LICENSE](LICENSE). This fix was prepared and published with AI assistance.
