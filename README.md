# COMIX extension fix

Independent build of [Keiyoushi's COMIX extension](https://github.com/keiyoushi/extensions-source/tree/ff521c17bb3e503c01e658e8fac00b60a95829f3/src/en/comix), version **1.6.55**.

Fixes **"Could not find the site's chapter API"** and the shared chapter-list API discovery.

## Download

- [Download the Android APK](https://github.com/xInsanityVoid/comix-extension/releases/download/v1.6.55/tachiyomi-en.comix-v1.6.55.apk)
- [Release and checksums](https://github.com/xInsanityVoid/comix-extension/releases/tag/v1.6.55)
- [Download the extension JAR](https://github.com/xInsanityVoid/comix-extension/releases/download/v1.6.55/tachiyomi-en.comix-v1.6.55.jar)

## Add the extension repository

Use this URL in your reader's extension-repository settings:

```text
https://raw.githubusercontent.com/xInsanityVoid/comix-extension/repo/index.pb
```

Repository descriptor: [repo.json](https://raw.githubusercontent.com/xInsanityVoid/comix-extension/repo/repo.json). This uses the same protobuf repository format as the current upstream repository. The build requires a reader supporting extension API **1.6**.

## Replacing the official COMIX extension

This APK has an independent signing certificate. Android cannot install it over the official signed COMIX APK. Uninstall **only the COMIX extension**, install this APK, and trust it in your reader if prompted. Keep your reader app and manga library. The COMIX source ID and package name are preserved, so existing library entries should reconnect. Extension preferences may need to be set again.

This repository is independent of Keiyoushi and COMIX. It contains only COMIX and does not automatically track future upstream releases.

Certificate SHA-256:

```text
f3d9ad42724b8269e1f0b78339fafa150da8c436b811e17225ad9759260b7264
```

## What changed

COMIX wraps its API objects in proxies that hide keys and return bound functions. The old discovery logic could not enumerate those methods. The fix tracks proxy targets during document initialization, uses the underlying objects for API discovery, and restores the original Proxy constructor after discovery finishes or fails. The site's proxy behavior is preserved.

## Validation

- Original code reproduced the missing-API failure against the live site.
- Patched reader returned 55 pages for a live chapter.
- Patched chapter-list script returned 20 chapters and completed its stop-at-known-chapter path.
- Seven focused regression tests passed, including hidden exports, plain exports, nested proxies, interception, timeout, and cleanup.
- Release build and release lint passed (0 errors; 2 generated-manifest warnings).
- APK signature verified; packaged JavaScript matched the tested source.
- Live testing used Chromium. No end-to-end Android reader test was performed.

## Rebuild

The `src/en/comix` directory contains the patched module. The full build infrastructure comes from upstream at `ff521c17bb3e503c01e658e8fac00b60a95829f3`. Apply `comix-fix.patch` to that revision, configure an Android SDK, then run:

```text
gradlew :src:en:comix:spotlessApply :src:en:comix:lintRelease :src:en:comix:assembleRelease
```

To reproduce the published signing identity, the private signing key is required; it is not included in this public repository. Independently signed rebuilds will have a different fingerprint.

Run the discovery tests with Node.js:

```text
node --experimental-vm-modules tests/site-api.test.cjs
```

Code is based on Keiyoushi under Apache-2.0; see [LICENSE](LICENSE). This fix was prepared and published with AI assistance.
