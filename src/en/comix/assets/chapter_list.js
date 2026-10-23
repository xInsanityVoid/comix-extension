// Chapter lists through the site's JavaScript pagination API, without native touch events.
(siteApi, knownIds, mangaId, chapterPath, maxPages, pass, progress = () => {}, resume = null) => {
    const known = new Set(knownIds);
    const chapters = [];
    const isChapter = (item) => item &&
        typeof item.id === "number" &&
        typeof item.number === "number" &&
        typeof item.url === "string" &&
        item.url.includes(chapterPath);
    // The site's method: two arguments with an object default for the second, items mapped through
    // a named mapper, the params forwarded to the GET helper
    const isChapterMethod = (value) => {
        const source = typeof value === "function" && String(value).replace(/^async["']([\w$]+)["']/, "async $1");
        return !!source &&
            /^(?:async [\w$]+ ?|async ?|[\w$]+ ?)?\([\w$]+,[\w$]+=\{\}\)(?:=>|\{)/.test(source) &&
            ((source.includes(".items.map(") && source.includes(".meta") &&
                source.includes("{params:") && !/\.items\.map\([\w$]+=>/.test(source)) ||
                /\{"items":[\w$]+,"meta":[\w$]+\}=[\w$]+/.test(source) ||
                // New builds share the list mapper instead of spelling out items/meta here.
                /^async [\w$]+\(([\w$]+),([\w$]+)=\{\}\)\{const ([\w$]+)=[\w$]+,([\w$]+)=[\w$]+\.[\w$]+\.[\w$]+\(\1\);[\w$]+\(\4,\2\[\3\(\d+\)\]\);const ([\w$]+)=\{\};return \5\[(?:[\w$]+|\3\(\d+\))\]=\2,function\(([\w$]+)\)\{return [\w$]+\(\6,[\w$]+\)\}\(await ([\w$]+)\.([\w$]+)\(\4,\5\)\)\}$/.test(source));
    };
    // The site's exported activity callback records the timestamp used by its pagination client.
    // Resolve its source shape, since export names change with each site build.
    const isActivityCallback = (value) => typeof value === "function" &&
        /^function(?: [\w$]+)?\(\)\{[\w$]+=Date(?:\.now|\[[\w$]+\(\d+\)\])\(\);?\}$/.test(String(value));
    // The walk reads the raw pages the helper returns to the site's own code
    const findChaptersApi = siteApi((members, isGet) => {
        const uniqueMembers = (test) => members.filter((member) => test(member.value)).filter(
            (member, index, matches) => matches.findIndex((other) => other.owner === member.owner && other.key === member.key) === index,
        );
        const targets = uniqueMembers(isGet);
        const candidates = uniqueMembers(isChapterMethod).filter((member) => {
            const sharedGet = String(member.value).match(/\(await [\w$]+\.([\w$]+)\([\w$]+,[\w$]+\)\)\}$/);
            return !sharedGet || targets.some((target) => target.key === sharedGet[1]);
        });
        const callbacks = [...new Set(members.map((member) => member.value).filter(isActivityCallback))];
        if (!candidates.length || !targets.length || callbacks.length !== 1) return null;
        const activity = callbacks[0];
        const records = [];
        let probing = false;
        let probeRecords = [];
        const isChapterList = (url) => /^\/manga\/[^/]+\/chapters$/.test(String(url));
        for (const target of targets) {
            const original = target.value;
            const intercepted = async (url, config) => {
                const params = config && config.params;
                // Identify the read method locally. Other site requests still use the original GET.
                if (probing) {
                    probeRecords.push({ url: String(url), params });
                    throw new Error("Chapter method probe");
                }
                try {
                    const result = await original.call(target.owner, url, config);
                    if (isChapterList(url)) records.push({ url, params, result });
                    return result;
                } catch (error) {
                    if (isChapterList(url)) records.push({ url, params, error });
                    throw error;
                }
            };
            if (!Reflect.set(target.owner, target.key, intercepted)) {
                throw new Error("Could not intercept the site's chapter API");
            }
        }
        const selectMethod = async () => {
            const matches = [];
            for (const candidate of candidates) {
                const params = { page: 1, limit: 20, order: { created_at: "desc" } };
                const expectedParams = JSON.stringify(params);
                probeRecords = [];
                try {
                    // These method shapes call GET before their first await. Only that synchronous
                    // prefix is intercepted, so background requests cannot be mistaken for probes.
                    let pending;
                    probing = true;
                    try { pending = candidate.value(mangaId, params); }
                    finally { probing = false; }
                    await pending;
                } catch (e) {
                    // The GET wrapper stops the probe before any network request or mapping.
                } finally {
                    probing = false;
                }
                if (probeRecords.length === 1 && probeRecords[0].url === `/manga/${mangaId}/chapters` &&
                    probeRecords[0].params === params && JSON.stringify(params) === expectedParams) matches.push(candidate.value);
            }
            if (matches.length !== 1) throw new Error("Could not identify the site's manga chapters API");
            return matches[0];
        };
        return { selectMethod, records, activity };
    });
    // The detail lives in the same document, so the caller reads the manga from this one load
    const queries = () => {
        try { return JSON.parse(document.querySelector("script#initial-data")?.textContent || "null")?.queries || null; }
        catch (e) { return null; }
    };
    const finish = (complete, error) => pass(JSON.stringify({ chapters, complete, error, queries: queries() }));
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    let requested = false;
    const readPage = async (api, page) => {
        // Keep pacing in JavaScript too: not every host intercepts WebView requests.
        if (requested) await sleep(2500 + Math.random() * 2500);
        requested = true;
        progress();
        api.activity();
        const before = api.records.length;
        try {
            await api.method(mangaId, { page, limit: 20, order: { created_at: "desc" } });
        } catch (e) {
            // The failed request is recorded; its error carries the status
        }
        // The method's return has key names that change every build; the raw page the helper hands
        // it does not. The records can also hold the site's own requests, so ours is matched by params
        const record = api.records.slice(before).find(
            (record) => record.url === `/manga/${mangaId}/chapters` &&
                record.params && record.params.page === page && record.params.limit === 20 && record.params.order &&
                record.params.order.created_at === "desc",
        );
        if (!record) throw new Error(`Chapter page ${page} didn't come back`);
        if (record.error) {
            const status = record.error && record.error.response && record.error.response.status;
            throw new Error(status === 502
                ? `Comix blocked chapter page ${page} (HTTP 502). Try again later, or change the user agent in Advanced settings`
                : `Chapter page ${page} failed: ${status ? `HTTP ${status}` : record.error && record.error.message || record.error}`);
        }
        const items = record.result && record.result.items;
        const meta = record.result && record.result.meta;
        if (!Array.isArray(items) || !items.every(isChapter) || !meta ||
            typeof meta.lastPage !== "number" || typeof meta.total !== "number") {
            throw new Error(`Chapter page ${page} came back in a shape the extension doesn't recognise`);
        }
        return record.result;
    };

    const walk = async () => {
        const api = await findChaptersApi();
        if (!api) return finish(false, "Could not find the site's chapters API");
        api.method = await api.selectMethod();
        const ids = new Set();
        let meta;
        let removed = false;
        const add = (result) => {
            chapters.push(...result.items);
            result.items.forEach((item) => ids.add(item.id));
            if (meta && result.meta.total < meta.total) removed = true;
            meta = result.meta;
        };
        const first = await readPage(api, 1);
        add(first);
        if (first.items.some((item) => known.has(item.id))) return finish(true);

        // A reader can cancel the request before its full walk completes. Recheck page one before
        // resuming: a changed head or total invalidates the old page offsets and requires a restart.
        const now = Date.now();
        const canResume = known.size === 0 && resume && resume.mangaId === mangaId &&
            Number.isFinite(resume.savedAt) && now >= resume.savedAt && now - resume.savedAt < 300000 &&
            resume.total === meta.total && resume.lastPage === meta.lastPage &&
            Number.isInteger(resume.nextPage) && resume.nextPage >= 2 && resume.nextPage <= meta.lastPage + 1 &&
            Array.isArray(resume.chapters) && resume.chapters.every(isChapter) &&
            resume.chapters.length === Math.min((resume.nextPage - 1) * 20, meta.total) &&
            new Set(resume.chapters.map((item) => item.id)).size === resume.chapters.length &&
            first.items.every((item, index) => resume.chapters[index]?.id === item.id);
        let nextPage = 2;
        if (canResume) {
            chapters.push(...resume.chapters.slice(first.items.length));
            chapters.forEach((item) => ids.add(item.id));
            nextPage = resume.nextPage;
        }
        let savedAt = canResume ? resume.savedAt : now;
        const save = (nextPage) => {
            if (known.size === 0) progress(JSON.stringify({
                mangaId, savedAt, total: meta.total, lastPage: meta.lastPage, nextPage, chapters,
            }));
        };
        save(nextPage);
        for (let page = nextPage; page <= Math.min(meta.lastPage, maxPages); page++) {
            const result = await readPage(api, page);
            add(result);
            if (result.items.some((item) => known.has(item.id))) return finish(true);
            // Only new progress refreshes the expiry; repeatedly reusing a complete list does not.
            savedAt = Date.now();
            save(page + 1);
        }
        // Chapters uploaded during the walk, from the top of the list
        for (let page = 1; ids.size < meta.total && page <= Math.min(meta.lastPage, maxPages); page++) {
            const result = await readPage(api, page);
            const overlaps = result.items.some((item) => ids.has(item.id));
            add(result);
            if (overlaps) break;
        }
        // A chapter removed during the walk moves the rest up a page boundary, skipping one
        if (removed) return finish(false, "Chapters were removed on the site during the refresh");
        return finish(ids.size === meta.total, `Got ${ids.size} of ${meta.total} chapters`);
    };

    const start = () => walk().catch((e) => finish(false, e && e.message || String(e)));
    // Images, ads and other subresources can hold up load long after the API is ready.
    if (document.readyState !== "loading") start();
    else document.addEventListener("DOMContentLoaded", start, { once: true });
}
