# COMIX extension fix

Independent build of [Keiyoushi's COMIX extension](https://github.com/keiyoushi/extensions-source/tree/ff521c17bb3e503c01e658e8fac00b60a95829f3/src/en/comix), version **1.6.65**, build **106065**.

Updates image-server fallbacks for COMIX's changed API metadata and fixes premature title-data parsing. Retains the earlier chapter API, refresh, recovery, mirror-link and CAPTCHA-header fixes.

## Install or update

Refresh your reader's existing extension repository and update COMIX to **1.6.65**. Keep **Faster chapter list fetching** enabled.

- [Release and checksums](https://github.com/xInsanityVoid/comix-extension/releases/tag/v1.6.65)
- [Android APK](https://github.com/xInsanityVoid/comix-extension/releases/download/v1.6.65/tachiyomi-en.comix-v1.6.65.apk)
- [Extension JAR](https://github.com/xInsanityVoid/comix-extension/releases/download/v1.6.65/tachiyomi-en.comix-v1.6.65.jar)

Repository URL:

```text
https://raw.githubusercontent.com/xInsanityVoid/comix-extension/repo/index.pb
```

[Repository descriptor](https://raw.githubusercontent.com/xInsanityVoid/comix-extension/repo/repo.json). The repository uses upstream's protobuf format and requires extension API 1.6. The APK and index both advertise build **106065**.

The package, source ID and signing key are unchanged. Updating from our earlier builds does not require uninstalling. On Android, switching from the official Keiyoushi-signed APK requires uninstalling only that extension first; keep the reader and library.

## Changes in 1.6.65

COMIX changed its image metadata from `node` to `alt_node` and added `alt2`. Build 64 ignored those fields, so a failed primary image could fall through to invalid alternate hostnames. This build reads the new fields and uses the host order observed in the site's current reader: the selected alternate domain, the second alternate domain, then the original and alternate domains with the alternate node. Legacy `alt`/`node` responses remain supported.

The existing interceptor still uses one bounded cycle and increments the `r` query parameter per alternate request. Only the host order is taken from the current browser reader; this extension does not copy the browser's repeated whole-cycle retries.

Also incorporates the loading-state guard proposed in official [PR #20384](https://github.com/keiyoushi/extensions-source/pull/20384), at commit `e8017765131117309156f134d6aeb153a1e34255`. Title metadata is read once HTML parsing finishes, preventing incomplete JSON from being sent to Kotlin during a streaming page load. That PR was open and unmerged when checked; the latest merged COMIX commit was still `70476a1a69459eb31176df6667ba376fd22b3daf`.

## Validation on October 25, 2026

- Desktop WebKit fetched browse/search results, author lookup, chapter lists and image lists on both COMIX mirrors. The tested Bacteriomancer upload returned 87 images; the tested Shepherd Wizard upload returned 183.
- Controlled native-reader observation, with image requests deliberately aborted, recorded the site's new fallback host order. Captured image metadata confirms the field change since the previous day's audit.
- The actual build 64 Kotlin page builder and fallback interceptor failed with `UnknownHostException` when the primary Bacteriomancer host was deliberately disabled. The updated production methods fetched the first, middle and last images through live alternate hosts. The same controlled fallback test passed for Shepherd Wizard. All six downloaded responses decoded as valid WebP images.
- Primary hosts worked on this test network. The failure reproduced here is fallback recovery; it does not establish why every series failed on the user's iPhone. Actual Tachimanga/iPhone behavior remains unverified.
- All 44 JavaScript and 37 Kotlin tests passed, including actual DTO deserialization, new and legacy host selection, page URL/fragment construction, retry dispatch, bounded failure, and partial title-JSON handling.
- Release formatting, assembly and lint passed (0 errors; 2 existing generated-manifest warnings). APK/JAR signatures, packaged assets, source identity and build number verified.

See `tests/image-fallback-v65.json` for the evidence and test boundaries. No Cloudflare solver change is included; manual WebView verification may still be needed. The previous refresh pacing and resumable full-list behavior are retained. Large initial imports can still take around a minute or longer, and retries can reuse saved batches after validating the live first page.

## Rebuild

Apply `comix-fix.patch` to upstream revision `ff521c17bb3e503c01e658e8fac00b60a95829f3`, configure an Android SDK, and run:

```text
gradlew :src:en:comix:spotlessApply :src:en:comix:lintRelease :src:en:comix:assembleRelease
```

Run regression tests:

```text
node --experimental-vm-modules --test tests/site-api.test.cjs tests/chapter-list.test.cjs tests/details.test.cjs
/path/to/upstream/gradlew -p tests/memo test
```

The Kotlin harnesses compile the production chapter memo helper and image DTO, and extract the production refresh/cache, URL/header, page-building and fallback methods. Host model dependencies are stubbed; image transport uses OkHttp. Device integration is outside their coverage. The opt-in `probeImages` task takes `-PpagesFile=/absolute/path/to/live-chapter-payload.json`, deliberately fails each sampled primary host, and downloads images through the production fallback interceptor.

Signing certificate SHA-256: `f3d9ad42724b8269e1f0b78339fafa150da8c436b811e17225ad9759260b7264`. The private signing key is not published. Independently signed rebuilds have a different fingerprint.

This repository is independent of Keiyoushi and COMIX and does not automatically track upstream updates. Code is based on Keiyoushi under Apache-2.0; see [LICENSE](LICENSE). Exported API recovery is adapted from [PR #20223](https://github.com/keiyoushi/extensions-source/pull/20223), including its readable sources at commit 794e11a. These fixes were prepared and published with AI assistance.
