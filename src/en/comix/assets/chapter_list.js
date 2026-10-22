// Chapter lists through the site's JavaScript pagination API, without native touch events.
(siteApi, knownIds, mangaId, chapterPath, maxPages, pass, progress = () => {}) => {
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
                /\{"items":[\w$]+,"meta":[\w$]+\}=[\w$]+/.test(source));
    };
    // The site's exported activity callback records the timestamp used by its pagination client.
    // Resolve its source shape, since export names change with each site build.
    const isActivityCallback = (value) => typeof value === "function" &&
        /^function(?: [\w$]+)?\(\)\{[\w$]+=Date(?:\.now|\[[\w$]+\(\d+\)\])\(\);?\}$/.test(String(value));
    // The walk reads the raw pages the helper returns to the site's own code
    const findChaptersApi = siteApi((members, isGet) => {
        const method = members.map((member) => member.value).find(isChapterMethod);
        const target = members.find((member) => isGet(member.value));
        const callbacks = [...new Set(members.map((member) => member.value).filter(isActivityCallback))];
        if (!method || !target || callbacks.length !== 1) return null;
        const activity = callbacks[0];
        const records = [];
        const original = target.value;
        const isChapterList = (url) => /^\/manga\/[^/]+\/chapters$/.test(String(url));
        target.owner[target.key] = async (url, config) => {
            const params = config && config.params;
            try {
                const result = await original.call(target.owner, url, config);
                if (isChapterList(url)) records.push({ params, result });
                return result;
            } catch (error) {
                if (isChapterList(url)) records.push({ params, error });
                throw error;
            }
        };
        return { method, records, activity };
    });
    // The detail lives in the same document, so the caller reads the manga from this one load
    const queries = () => {
        try { return JSON.parse(document.querySelector("script#initial-data")?.textContent || "null")?.queries || null; }
        catch (e) { return null; }
    };
    const finish = (complete, error) => pass(JSON.stringify({ chapters, complete, error, queries: queries() }));
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const readPage = async (api, page) => {
        // Keep pacing in JavaScript too: not every host intercepts WebView requests.
        await sleep(2500 + Math.random() * 2500);
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
            (record) => record.params && record.params.page === page && record.params.order &&
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
        const ids = new Set();
        let meta;
        let removed = false;
        const add = (result) => {
            chapters.push(...result.items);
            result.items.forEach((item) => ids.add(item.id));
            if (meta && result.meta.total < meta.total) removed = true;
            meta = result.meta;
        };
        for (let page = 1; ; page++) {
            const result = await readPage(api, page);
            add(result);
            if (result.items.some((item) => known.has(item.id))) return finish(true);
            if (page >= Math.min(meta.lastPage, maxPages)) break;
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
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
}
