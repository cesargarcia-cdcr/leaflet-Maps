document.addEventListener("DOMContentLoaded", async function() {
    const infoSectionBody = document.querySelector('#info-section .card-body');
    if (!infoSectionBody) return;

    const INDEX_FILENAME = "guidelines_search_index.json";
    const SEARCH_INDEX_VERSION = 1;
    const normalizedPath = path => path.replace(/\\/g, "/");

    function parseSortingName(rawName) {
        let order = Infinity;
        let remainder = rawName;
        const numMatch = rawName.match(/^(\d+)_(.+)$/);
        if (numMatch) {
            order = parseInt(numMatch[1], 10);
            remainder = numMatch[2];
        }

        const criticalMatch = remainder.match(/^critical_(.+)$/i);
        const isCritical = remainder.toLowerCase() === 'critical' || Boolean(criticalMatch);
        const displayName = criticalMatch
            ? criticalMatch[1].replace(/_/g, ' ')
            : remainder.replace(/_/g, ' ');

        return {
            order,
            cleanName: remainder.replace(/_/g, ' '),
            displayName,
            isCritical
        };
    }

    function sortItems(a, b) {
        const itemA = parseSortingName(a);
        const itemB = parseSortingName(b);
        return itemA.order - itemB.order || itemA.cleanName.localeCompare(itemB.cleanName);
    }

    function setStatus(message, className = "guidelines-loading") {
        status.textContent = message;
        status.className = `guidelines-status ${className}`;
    }

    function getSafeInventoryPaths(inventory) {
        if (!inventory || typeof inventory !== "object" || Array.isArray(inventory) ||
            !Array.isArray(inventory.Guidelines_Info)) {
            throw new Error("The OPFS asset inventory does not contain a valid Guidelines_Info file list.");
        }

        return [...new Set(inventory.Guidelines_Info
            .filter(path => typeof path === "string")
            .map(normalizedPath)
            .filter(path => path.toLowerCase().endsWith(".html") &&
                path.split("/").every(part => part && part !== "." && part !== "..")))];
    }

    async function readInventory(rootDir) {
        const appDataDir = await rootDir.getDirectoryHandle("App_Data", { create: false });
        const inventoryHandle = await appDataDir.getFileHandle("asset_sync_inventory.json", { create: false });
        return JSON.parse(await (await inventoryHandle.getFile()).text());
    }

    async function getGuidelineFile(rootDir, relativePath) {
        const parts = relativePath.split("/");
        let directory = await rootDir.getDirectoryHandle("Guidelines_Info", { create: false });
        for (const folder of parts.slice(0, -1)) {
            directory = await directory.getDirectoryHandle(folder, { create: false });
        }
        const handle = await directory.getFileHandle(parts[parts.length - 1], { create: false });
        return handle.getFile();
    }

    function extractSearchText(html) {
        const documentContent = new DOMParser().parseFromString(html, "text/html");
        documentContent.querySelectorAll("script, style, template, noscript").forEach(node => node.remove());
        return (documentContent.body?.textContent || documentContent.documentElement.textContent || "")
            .replace(/\s+/g, " ")
            .trim();
    }

    async function loadCachedIndex(appDataDir) {
        try {
            const handle = await appDataDir.getFileHandle(INDEX_FILENAME, { create: false });
            const cached = JSON.parse(await (await handle.getFile()).text());
            if (cached?.version !== SEARCH_INDEX_VERSION || !Array.isArray(cached.entries)) {
                throw new Error("The cached Guidelines search index has an unsupported format.");
            }
            return new Map(cached.entries
                .filter(entry => entry && typeof entry.path === "string" &&
                    typeof entry.text === "string" && typeof entry.title === "string" &&
                    typeof entry.category === "string" && Number.isFinite(entry.size) &&
                    Number.isFinite(entry.lastModified))
                .map(entry => [entry.path, entry]));
        } catch (error) {
            if (error.name !== "NotFoundError") {
                console.warn("Could not reuse the cached Guidelines search index; rebuilding it.", error);
            }
            return new Map();
        }
    }

    async function saveCachedIndex(appDataDir, entries) {
        const handle = await appDataDir.getFileHandle(INDEX_FILENAME, { create: true });
        const writable = await handle.createWritable();
        await writable.write(JSON.stringify({
            version: SEARCH_INDEX_VERSION,
            entries: [...entries.values()]
        }));
        await writable.close();
    }

    function makeSearchEntry(path, file, text) {
        const folderName = path.split("/")[0];
        const fileName = path.split("/").pop().replace(/\.html$/i, "");
        const folderInfo = parseSortingName(folderName);
        const fileInfo = parseSortingName(fileName);
        const title = fileInfo.displayName;
        const lowerName = fileInfo.cleanName.toLowerCase();
        const isHighRisk = lowerName.includes("dea") || lowerName.includes("fraud") ||
            lowerName.includes("compliance");

        return {
            path,
            size: file.size,
            lastModified: file.lastModified,
            title,
            category: folderInfo.displayName,
            isCritical: folderInfo.isCritical,
            isHighRisk,
            text
        };
    }

    async function buildSearchIndex(rootDir, appDataDir, inventoryPaths, indexStatus) {
        const previousEntries = await loadCachedIndex(appDataDir);
        const inventoryPathSet = new Set(inventoryPaths);
        const entries = new Map();
        let indexChanged = inventoryPathSet.size !== previousEntries.size;
        let indexedCount = 0;

        for (const path of inventoryPaths) {
            const file = await getGuidelineFile(rootDir, path);
            const previous = previousEntries.get(path);
            let entry;

            if (previous && previous.size === file.size && previous.lastModified === file.lastModified &&
                typeof previous.text === "string") {
                entry = previous;
            } else {
                const html = await file.text();
                entry = makeSearchEntry(path, file, extractSearchText(html));
                indexChanged = true;
            }

            entries.set(path, entry);
            indexedCount++;
            if (indexedCount % 10 === 0 || indexedCount === inventoryPaths.length) {
                indexStatus.textContent = `Preparing search index: ${indexedCount} of ${inventoryPaths.length} documents...`;
            }
        }

        if (indexChanged) await saveCachedIndex(appDataDir, entries);
        return entries;
    }

    function getSnippet(entry, queryTerms) {
        const text = entry.text;
        const matchIndex = queryTerms.reduce((best, term) => {
            const index = text.toLocaleLowerCase().indexOf(term);
            return index >= 0 && (best < 0 || index < best) ? index : best;
        }, -1);

        if (matchIndex < 0) return "";
        const start = Math.max(0, matchIndex - 75);
        const end = Math.min(text.length, matchIndex + 180);
        return `${start > 0 ? "..." : ""}${text.slice(start, end)}${end < text.length ? "..." : ""}`;
    }

    function addDocumentContent(details, path) {
        const content = document.createElement("div");
        content.className = "guidelines-file-content";
        content.innerHTML = '<span class="guidelines-loading">Loading local content...</span>';
        details.appendChild(content);
        details.dataset.loaded = "true";

        getGuidelineFile(rootDir, path)
            .then(async file => {
                content.innerHTML = await file.text();
                content.querySelectorAll("script").forEach(oldScript => {
                    const newScript = document.createElement("script");
                    Array.from(oldScript.attributes).forEach(attr =>
                        newScript.setAttribute(attr.name, attr.value));
                    newScript.appendChild(document.createTextNode(oldScript.innerHTML));
                    oldScript.parentNode.replaceChild(newScript, oldScript);
                });
            })
            .catch(error => {
                console.error(`Could not load Guidelines document '${path}'.`, error);
                content.textContent = `Unable to load this document: ${error.message}`;
                content.classList.add("guidelines-error");
            });
    }

    const searchLabel = document.createElement("label");
    searchLabel.className = "guidelines-search-label";
    searchLabel.htmlFor = "guidelines-search";
    searchLabel.textContent = "Search all Guidelines & Info documents";

    const searchInput = document.createElement("input");
    searchInput.id = "guidelines-search";
    searchInput.className = "guidelines-search";
    searchInput.type = "search";
    searchInput.placeholder = "Search titles and document contents...";
    searchInput.setAttribute("autocomplete", "off");

    const status = document.createElement("div");
    status.className = "guidelines-status guidelines-loading";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    status.textContent = "Loading the Guidelines file inventory...";

    const groupsContainer = document.createElement("div");
    groupsContainer.className = "guidelines-groups";
    infoSectionBody.replaceChildren(searchLabel, searchInput, status, groupsContainer);

    let rootDir;
    let entries = new Map();
    let refreshInProgress = false;
    let refreshRequested = false;

    function filterDocuments() {
        const queryTerms = searchInput.value.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
        let matchingCount = 0;

        groupsContainer.querySelectorAll(".info-group").forEach(group => {
            let visibleInGroup = 0;
            group.querySelectorAll(".guidelines-file-details").forEach(details => {
                const entry = entries.get(details.dataset.path);
                const searchableText = `${entry.category} ${entry.title} ${entry.text}`.toLocaleLowerCase();
                const isMatch = queryTerms.every(term => searchableText.includes(term));
                details.hidden = !isMatch;
                const snippet = details.querySelector(".guidelines-search-snippet");
                snippet.textContent = queryTerms.length && isMatch ? getSnippet(entry, queryTerms) : "";
                snippet.hidden = !queryTerms.length || !isMatch;
                if (isMatch) visibleInGroup++;
            });
            group.hidden = visibleInGroup === 0;
            matchingCount += visibleInGroup;
        });

        setStatus(queryTerms.length
            ? `${matchingCount} matching document${matchingCount === 1 ? "" : "s"} of ${entries.size}.`
            : `${entries.size} documents indexed. Search by words in a title or document.`,
        "guidelines-index-ready");
    }

    async function refreshGuidelinesIndex() {
        if (refreshInProgress) {
            refreshRequested = true;
            return;
        }

        refreshInProgress = true;
        groupsContainer.replaceChildren();
        setStatus("Loading the Guidelines file inventory...");

        try {
            rootDir = await navigator.storage.getDirectory();
            const inventory = await readInventory(rootDir);
            const inventoryPaths = getSafeInventoryPaths(inventory);
            if (inventoryPaths.length === 0) {
                entries = new Map();
                setStatus("No HTML documents are listed in the Guidelines_Info inventory.", "guidelines-empty");
                return;
            }

            const appDataDir = await rootDir.getDirectoryHandle("App_Data", { create: false });
            entries = await buildSearchIndex(rootDir, appDataDir, inventoryPaths, status);

            const groups = new Map();
            for (const entry of entries.values()) {
                const folderName = entry.path.split("/")[0];
                if (!groups.has(folderName)) groups.set(folderName, []);
                groups.get(folderName).push(entry);
            }

            for (const [folderName, groupEntries] of [...groups.entries()].sort(([a], [b]) => sortItems(a, b))) {
                const folderInfo = parseSortingName(folderName);
                const group = document.createElement("section");
                group.className = "info-group";
                group.classList.toggle("is-critical", folderInfo.isCritical);

                const heading = document.createElement("div");
                heading.className = "guidelines-group-header";
                heading.textContent = `📁 ${folderInfo.displayName}`;
                group.appendChild(heading);

                const content = document.createElement("div");
                content.className = "group-content";
                groupEntries.sort((a, b) => sortItems(a.path.split("/").pop(), b.path.split("/").pop()));

                for (const entry of groupEntries) {
                    const details = document.createElement("details");
                    details.setAttribute("name", `accordion-${folderName}`);
                    details.className = "guidelines-file-details";
                    details.dataset.path = entry.path;

                    const summary = document.createElement("summary");
                    summary.className = `guidelines-file-summary${entry.isHighRisk ? " is-high-risk" : ""}`;
                    summary.textContent = `${entry.isHighRisk ? "🛡️" : "📄"} ${entry.title}`;
                    details.appendChild(summary);

                    const snippet = document.createElement("p");
                    snippet.className = "guidelines-search-snippet";
                    details.appendChild(snippet);

                    details.addEventListener("toggle", () => {
                        if (details.open && details.dataset.loaded !== "true") {
                            addDocumentContent(details, entry.path);
                        }
                    });

                    content.appendChild(details);
                }

                group.appendChild(content);
                groupsContainer.appendChild(group);
            }

            filterDocuments();
        } catch (error) {
            console.error("Unable to prepare the Guidelines search index.", error);
            setStatus(`Unable to load Guidelines & Info: ${error.message}`, "guidelines-error");
        } finally {
            refreshInProgress = false;
            if (refreshRequested) {
                refreshRequested = false;
                refreshGuidelinesIndex();
            }
        }
    }

    searchInput.addEventListener("input", filterDocuments);
    window.addEventListener("GuidelinesAssetsSynced", refreshGuidelinesIndex);
    await refreshGuidelinesIndex();
});
