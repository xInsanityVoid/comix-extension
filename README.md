# COMIX extension fix

Independent build of [Keiyoushi's COMIX extension](https://github.com/keiyoushi/extensions-source/tree/ff521c17bb3e503c01e658e8fac00b60a95829f3/src/en/comix), version **1.6.69**, build **106069**.

Updates COMIX search, sorting, and filters to use the site's current browse URL format. Title searches default to relevance when the reader supplies no sort filter.

## Install or update

Refresh your reader's existing extension repository and update COMIX to **1.6.69**.

- [Release and checksums](https://github.com/xInsanityVoid/comix-extension/releases/tag/v1.6.69)
- [Android APK](https://github.com/xInsanityVoid/comix-extension/releases/download/v1.6.69/tachiyomi-en.comix-v1.6.69.apk)
- [Extension JAR](https://github.com/xInsanityVoid/comix-extension/releases/download/v1.6.69/tachiyomi-en.comix-v1.6.69.jar)

Repository URL:

```text
https://raw.githubusercontent.com/xInsanityVoid/comix-extension/repo/index.pb
```

[Repository descriptor](https://raw.githubusercontent.com/xInsanityVoid/comix-extension/repo/repo.json). The repository uses Keiyoushi's protobuf format and requires extension API 1.6. The APK and index advertise build **106069**.

The release is signed with the same key as previous independent builds and can be installed over them. On Android, switching from the official Keiyoushi-signed APK requires uninstalling only that extension first.

## Search fix

The old browse URL made the site request the latest titles without the search phrase. The extension waited for a matching response and showed a loading spinner. The updated URL parameters follow the browse commit in [Keiyoushi PR #21077](https://github.com/keiyoushi/extensions-source/pull/21077).

Tested on November 18, 2026 in desktop WebKit. “Got a Gallery in the Wild” returned as the first result on both mirrors in under a second. Both mirrors also passed searches with no results, pagination, combined filters, Popular, and Latest. The desktop tests exercised the extension's browse JavaScript and live site responses.

All 52 JavaScript and 55 Kotlin regression tests passed. Release lint reported 0 errors and 2 existing generated manifest warnings. APK and JAR signatures, assets, source identity, and build number were verified.

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

The Kotlin harnesses compile the production chapter memo helper, filters, and DTOs. They extract the production refresh, URL, header, page-building, and fallback methods with host model stubs. The opt-in `probeImages` task takes `-PpagesFile=/absolute/path/to/live-chapter-payload.json`, deliberately fails each sampled primary host, and downloads images through the production fallback interceptor. The opt-in `probeCovers` task takes `-PcoversFile=/absolute/path/to/captured-browse.json`, maps cover URLs, and downloads samples on both mirrors.

Signing certificate SHA-256 is `f3d9ad42724b8269e1f0b78339fafa150da8c436b811e17225ad9759260b7264`. Independently signed rebuilds have a different fingerprint.

This repository is independent of Keiyoushi and COMIX. Code is based on Keiyoushi under Apache-2.0 as described in [LICENSE](LICENSE). Exported API recovery is adapted from [PR #20223](https://github.com/keiyoushi/extensions-source/pull/20223), including its readable sources at commit 794e11a. These fixes were prepared and published with AI assistance.
