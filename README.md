# COMIX extension fix

Independent build of [Keiyoushi's COMIX extension](https://github.com/keiyoushi/extensions-source/tree/ff521c17bb3e503c01e658e8fac00b60a95829f3/src/en/comix), version **1.6.61**, build **106061**.

Speeds up chapter refreshes by starting at document readiness and remembering uploads hidden by chapter deduplication or scanlator filters. Includes the previous API-discovery and missing-chapter fixes.

## Install or update

Refresh your reader's existing extension repository and update COMIX to **1.6.61**, then refresh the affected title.

- [Release and checksums](https://github.com/xInsanityVoid/comix-extension/releases/tag/v1.6.61)
- [Android APK](https://github.com/xInsanityVoid/comix-extension/releases/download/v1.6.61/tachiyomi-en.comix-v1.6.61.apk)
- [Extension JAR](https://github.com/xInsanityVoid/comix-extension/releases/download/v1.6.61/tachiyomi-en.comix-v1.6.61.jar)

Repository URL:

```text
https://raw.githubusercontent.com/xInsanityVoid/comix-extension/repo/index.pb
```

[Repository descriptor](https://raw.githubusercontent.com/xInsanityVoid/comix-extension/repo/repo.json). The repository uses upstream's protobuf format and requires extension API 1.6. Both the APK and repository index advertise build **106061**.

The package, source ID and signing key are unchanged from our previous builds. Updates from this repository do not require uninstalling. On Android, switching from the official Keiyoushi-signed APK requires uninstalling only that extension first; keep the reader and library.

## Changes in 1.6.61

Chapter checks start at DOMContentLoaded instead of waiting for the full window load event. Unrelated slow frames and other subresources no longer delay an otherwise ready API. Discovery still waits for the site's JavaScript client when needed.

A successful refresh now saves the ID of the newest raw upload alongside the selected chapter's existing refresh metadata. Previously, an upload hidden by deduplication or a scanlator blacklist was absent from the stored chapter IDs. Later refreshes could repeatedly scan many pages to find a retained chapter. With **Faster chapter list fetching** enabled, the saved raw-upload ID lets the next check stop at already-inspected uploads, even when those uploads are hidden from the displayed list.

Every requested refresh still checks the live chapter API. The checkpoint advances only after a complete response. Changed deduplication/blacklist settings, an incomplete prior list, or disabling faster fetching still require a full scan. Existing saved chapters and upload dates are preserved. Failed refreshes remain errors rather than being reported as no new chapters.

The first refresh after upgrading may still need to scan several pages to establish the checkpoint. Initial imports and full refreshes remain paced in 20-entry batches: larger pages and aggressively shortened delays failed live tests. This release retains the working request pacing and does not change reader-imposed timeouts or Tachimanga's global-update exclusion settings.

Private API discovery, upstream export probing, native-free requests and the previous chapter-16 fix are retained.

## Validation

- Controlled slow-frame test on the live Bacteriomancer page: 1.6.60 took 45.5 seconds; 1.6.61 finished in 4.0 seconds on WebKit and 5.0 seconds on Chromium, before the frame completed. All three chapter-16 uploads were found. These are controlled browser measurements, not device timing guarantees.
- Full Bacteriomancer fetch with early startup returned all 133 scanlation entries in both engines.
- Filtered-library replay and benchmark results are included in tests/performance-results.json.
- A saved checkpoint 35 uploads behind still retrieves all 35 new entries across two pages in both engines.
- 25 JavaScript regression tests passed, including startup without the full load event and existing discovery/pagination behavior.
- 14 Kotlin tests passed. Nine compile the actual production refresh method with lightweight host dependencies, including hidden-upload checkpoints, settings changes and failure preservation.
- Release formatting, assembly and lint passed (0 lint errors; 2 existing generated-manifest warnings).
- APK signature and build number verified; packaged APK/JAR JavaScript matches the tested source.

An actual Tachimanga device was unavailable. Browser and compatibility-source checks do not substitute for end-to-end testing on the Apple app.

## Rebuild

Apply comix-fix.patch to upstream revision `ff521c17bb3e503c01e658e8fac00b60a95829f3`, configure an Android SDK, and run:

```text
gradlew :src:en:comix:spotlessApply :src:en:comix:lintRelease :src:en:comix:assembleRelease
```

Run regression tests:

```text
node --experimental-vm-modules --test tests/site-api.test.cjs tests/chapter-list.test.cjs
/path/to/upstream/gradlew -p tests/memo test
```

The Kotlin tests compile the production metadata helper and extract the unchanged production refresh method into a host harness. Android/reader dependencies are stubbed; selection and device integration are outside that harness.

Signing certificate SHA-256: `f3d9ad42724b8269e1f0b78339fafa150da8c436b811e17225ad9759260b7264`. The private signing key is not published. Independently signed rebuilds have a different fingerprint.

This repository is independent of Keiyoushi and COMIX and does not automatically track upstream updates. Code is based on Keiyoushi under Apache-2.0; see [LICENSE](LICENSE). Exported API recovery is adapted from [PR #20223](https://github.com/keiyoushi/extensions-source/pull/20223), including its readable sources at commit 794e11a. These fixes were prepared and published with AI assistance.
