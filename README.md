# COMIX extension fix

Independent build of [Keiyoushi's COMIX extension](https://github.com/keiyoushi/extensions-source/tree/ff521c17bb3e503c01e658e8fac00b60a95829f3/src/en/comix), version **1.6.60**, build **106060**.

Fixes chapter discovery after COMIX moved its request helper into a private, obfuscated API core. Also prevents failed refreshes from being reported as an unchanged chapter list.

## Install or update

Refresh your reader's existing extension repository and update COMIX to **1.6.60**, then refresh the affected title.

- [Release and checksums](https://github.com/xInsanityVoid/comix-extension/releases/tag/v1.6.60)
- [Android APK](https://github.com/xInsanityVoid/comix-extension/releases/download/v1.6.60/tachiyomi-en.comix-v1.6.60.apk)
- [Extension JAR](https://github.com/xInsanityVoid/comix-extension/releases/download/v1.6.60/tachiyomi-en.comix-v1.6.60.jar)

Repository URL:

```text
https://raw.githubusercontent.com/xInsanityVoid/comix-extension/repo/index.pb
```

[Repository descriptor](https://raw.githubusercontent.com/xInsanityVoid/comix-extension/repo/repo.json). The repository uses upstream's protobuf format and requires extension API 1.6. Both the APK and repository index advertise build **106060**.

The package, source ID and signing key are unchanged from our previous builds. Updates from this repository do not require uninstalling. On Android, switching from the official Keiyoushi-signed APK requires uninstalling only that extension first; keep the reader and library.

## Changes in 1.6.60

The current site build hides the request helper from module exports and uses quoted method names and indirect property lookups. Export probing alone could no longer find the API. Discovery now captures hidden clients when the page creates them, recognizes the new request and chapter method shapes, and retains the upstream fallback for exported objects and alternate script locations. The temporary Proxy constructor observer is restored after discovery, including failure paths. No mangled method names or numeric string-table positions are hardcoded.

Chapter pages use the site's discovered request helper with the established chapter endpoint. The site still performs request signing and decoding. Native touch events and visible chapter controls are not required.

The Kotlin refresh path previously swallowed incomplete results for existing libraries. An API-discovery failure could therefore appear as no new chapters found. All incomplete chapter refreshes now throw before caching, mapping or modifying saved chapters. Existing library entries remain untouched on failure.

Every requested chapter refresh consults the chapter API. The shortcut based on a relative last-upload date has been removed. Known-ID early stopping remains available with **Faster chapter list fetching** enabled, and stored upload dates are preserved. Chapter-order-independent metadata lookup, sequential pacing, progress signals and the 60-second inactivity timeout are retained.

Initial imports and full refreshes remain paced by COMIX. This build does not change timeouts imposed by a reader.

## Validation

- Reproduced 1.6.59 failing discovery for The Unlimited Bacteriomancer while the site's page advertised chapter 16.
- WebKit and Chromium: the fixed full fetch returns all 133 scanlation entries, including chapter 16 from Vortex Scans, Lagoon Scans and Genz Toons.
- Both engines: a simulated library containing chapters through 15 finds all three chapter-16 entries in one chapter API request.
- Both engines: chapter 16 returns 99 image-page entries.
- Both engines: 35 simulated new entries on a larger title are found in two chapter requests.
- 24 JavaScript regression tests passed, including private clients, quoted method names, indirect activity callbacks and existing discovery/pagination behavior.
- 11 Kotlin tests passed. Six compile the actual production refresh method with lightweight host dependencies; the old 1.6.59 fails four of these regression checks.
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
