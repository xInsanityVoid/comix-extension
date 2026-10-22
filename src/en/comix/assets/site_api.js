// The site's own API client, from the chunks next to the running entry. Every build re-mangles
// names, so members are resolved by source shape; the selector receives the exported members
// found so far, each with the object holding it, and returns what it needs.
(select) => {
    // Runs at document start: the site's API proxies hide keys and bind methods on access.
    const targets = new WeakMap();
    const originalProxy = window.Proxy;
    const trackingProxy = new originalProxy(originalProxy, {
        construct(constructor, args) {
            const proxy = Reflect.construct(constructor, args);
            targets.set(proxy, args[0]);
            return proxy;
        },
    });
    window.Proxy = trackingProxy;
    const unwrap = (value) => targets.get(value) || value;
    const FIND_TIMEOUT_MS = 10000;
    const isGet = (value) => typeof value === "function" &&
        String(value).includes(".get(") &&
        String(value).endsWith(".data");
    const find = async () => {
        const scripts = performance.getEntriesByType("resource")
            .map((entry) => entry.name)
            .filter((url) => /\/assets\/.*\.js$/.test(url));
        const entry = scripts.find((url) => /\/main-[^/]+\.js$/.test(url));
        if (!entry) return null;
        const directory = entry.slice(0, entry.lastIndexOf("/") + 1);
        const members = [];
        for (const url of new Set(scripts.filter((url) => url.startsWith(directory)))) {
            for (const value of Object.values(await import(url))) {
                const exported = unwrap(value);
                if (exported && typeof exported === "object") {
                    for (const [key, value] of Object.entries(exported)) {
                        const member = unwrap(value);
                        members.push({ owner: exported, key, value: member });
                        if (member && typeof member === "object") {
                            for (const [nestedKey, nested] of Object.entries(member)) {
                                members.push({ owner: member, key: nestedKey, value: unwrap(nested) });
                            }
                        }
                    }
                }
            }
            const found = select(members, isGet);
            if (found) return found;
        }
        return null;
    };
    return async () => {
        try {
            // The site's chunks keep loading after the page's load event
            const deadline = Date.now() + FIND_TIMEOUT_MS;
            for (;;) {
                const api = await find();
                if (api || Date.now() >= deadline) return api;
                await new Promise((resolve) => setTimeout(resolve, 250));
            }
        } finally {
            if (window.Proxy === trackingProxy) window.Proxy = originalProxy;
        }
    };
}
