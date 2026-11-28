const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

async function getTablesDirectory() {
    const root = await navigator.storage.getDirectory();
    const powerAppData = await root.getDirectoryHandle("powerAppData");
    const visitType = await powerAppData.getDirectoryHandle("Visit type");
    return await visitType.getDirectoryHandle("tables");
}

function getFirstElementNS(parent, localName) {
    return parent?.getElementsByTagNameNS(W_NS, localName)[0] || null;
}

function getDirectChildrenNS(parent, localName) {
    return Array.from(parent?.childNodes || []).filter(
        (node) => node.nodeType === Node.ELEMENT_NODE &&
            node.namespaceURI === W_NS &&
            node.localName === localName
    );
}

function isToggleEnabled(el) {
    if (!el) return false;
    const val = el.getAttribute("w:val");
    if (val === null) return true;
    return !["0", "false", "off"].includes(val.toLowerCase());
}

function getEffectiveStyle(runEl, pEl) {
    const pRunPr = getFirstElementNS(getFirstElementNS(pEl, "pPr"), "rPr");
    const rPr = getFirstElementNS(runEl, "rPr");

    const color = getFirstElementNS(rPr, "color")?.getAttribute("w:val")
        || getFirstElementNS(pRunPr, "color")?.getAttribute("w:val");

    const rBold = getFirstElementNS(rPr, "b");
    const pBold = getFirstElementNS(pRunPr, "b");
    const bold = rBold ? isToggleEnabled(rBold) : isToggleEnabled(pBold);

    const rItalic = getFirstElementNS(rPr, "i");
    const pItalic = getFirstElementNS(pRunPr, "i");
    const italic = rItalic ? isToggleEnabled(rItalic) : isToggleEnabled(pItalic);

    const rUnderline = getFirstElementNS(rPr, "u");
    const pUnderline = getFirstElementNS(pRunPr, "u");
    const underline = rUnderline ? isToggleEnabled(rUnderline) : isToggleEnabled(pUnderline);

    return { color, bold, italic, underline };
}

function renderRun(runEl, pEl) {
    const { color, bold, italic, underline } = getEffectiveStyle(runEl, pEl);
    const frag = document.createDocumentFragment();

    for (const child of Array.from(runEl.childNodes)) {
        if (child.namespaceURI !== W_NS) continue;
        if (child.localName === "t") {
            frag.appendChild(document.createTextNode(child.textContent || ""));
        } else if (child.localName === "br" || child.localName === "cr") {
            frag.appendChild(document.createElement("br"));
        } else if (child.localName === "tab") {
            frag.appendChild(document.createTextNode("\u00A0\u00A0\u00A0\u00A0"));
        }
    }

    const hasStyle = (color && color.toLowerCase() !== "auto") || bold || italic || underline;
    if (!hasStyle) return frag;

    const span = document.createElement("span");
    if (color && color.toLowerCase() !== "auto") span.style.color = `#${color}`;
    if (bold) span.style.fontWeight = "700";
    if (italic) span.style.fontStyle = "italic";
    if (underline) span.style.textDecoration = "underline";
    span.appendChild(frag);
    return span;
}

function renderParagraph(pEl) {
    const p = document.createElement("p");
    p.className = "vt-cell-paragraph";

    const align = getFirstElementNS(getFirstElementNS(pEl, "pPr"), "jc")?.getAttribute("w:val");
    if (align === "center" || align === "right") {
        p.style.textAlign = align;
    }

    getDirectChildrenNS(pEl, "r").forEach((runEl) => {
        p.appendChild(renderRun(runEl, pEl));
    });

    if (!p.textContent && p.children.length === 0) {
        p.appendChild(document.createElement("br"));
    }
    return p;
}

function extractFirstRowTitle(tblEl, fallbackTitle) {
    const firstRow = getDirectChildrenNS(tblEl, "tr")[0];
    if (!firstRow) return fallbackTitle;

    const cellTexts = getDirectChildrenNS(firstRow, "tc").map((tcEl) => {
        const paraTexts = getDirectChildrenNS(tcEl, "p").map((pEl) =>
            getDirectChildrenNS(pEl, "r")
                .flatMap((rEl) =>
                    Array.from(rEl.childNodes)
                        .filter((n) => n.namespaceURI === W_NS && (n.localName === "t" || n.localName === "tab"))
                        .map((n) => (n.localName === "tab" ? " " : (n.textContent || "")))
                )
                .join("")
                .trim()
        ).filter(Boolean);
        return paraTexts.join(" ").trim();
    }).filter(Boolean);

    const combined = cellTexts.join(" ").replace(/\s+/g, " ").trim();
    return combined || fallbackTitle;
}

function parseTableDocument(xmlText, fileName) {
    const doc = new DOMParser().parseFromString(xmlText, "application/xml");
    if (doc.getElementsByTagName("parsererror")[0]) {
        throw new Error(`Invalid XML in ${fileName}`);
    }

    const tblEl = getFirstElementNS(doc, "tbl");
    if (!tblEl) {
        throw new Error(`Missing <w:tbl> in ${fileName}`);
    }

    const fallbackTitle = fileName.replace(/\.txt$/i, "");
    const title = extractFirstRowTitle(tblEl, fallbackTitle);

    const table = document.createElement("table");
    table.className = "epic-guide-table vt-table";
    table.dataset.sourceFile = fileName;

    const tbody = document.createElement("tbody");
    getDirectChildrenNS(tblEl, "tr").forEach((trEl) => {
        const tr = document.createElement("tr");
        const cells = getDirectChildrenNS(trEl, "tc");

        cells.forEach((tcEl) => {
            const tcPr = getFirstElementNS(tcEl, "tcPr");
            const spanVal = getFirstElementNS(tcPr, "gridSpan")?.getAttribute("w:val");
            const fillHex = getFirstElementNS(tcPr, "shd")?.getAttribute("w:fill");

            const td = document.createElement("td");
            if (spanVal && parseInt(spanVal, 10) > 1) {
                td.colSpan = parseInt(spanVal, 10);
            }
            if (fillHex && fillHex.toLowerCase() !== "auto") {
                td.style.backgroundColor = `#${fillHex}`;
            }

            getDirectChildrenNS(tcEl, "p").forEach((pEl) => {
                td.appendChild(renderParagraph(pEl));
            });

            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    return { title, table };
}

export async function renderOpfsVisitTypeSections(containerId = "content-area") {
    const container = document.getElementById(containerId);
    if (!container) return;

    const tablesDir = await getTablesDirectory();
    const entries = [];
    for await (const [name, handle] of tablesDir.entries()) {
        if (handle.kind === "file" && /^tableXml\d+\.txt$/i.test(name)) {
            entries.push({ name, handle, order: parseInt(name.match(/\d+/)[0], 10) });
        }
    }
    entries.sort((a, b) => a.order - b.order);

    container.className = "";
    container.replaceChildren();

    for (const item of entries) {
        const xmlText = await (await item.handle.getFile()).text();
        const { title, table } = parseTableDocument(xmlText, item.name);

        const sectionDiv = document.createElement("div");
        sectionDiv.className = "section-container collapsed";

        const headerDiv = document.createElement("div");
        headerDiv.className = "section-header";
        headerDiv.textContent = title;
        headerDiv.onclick = () => sectionDiv.classList.toggle("collapsed");

        const tableWrap = document.createElement("div");
        tableWrap.className = "epic-guide-table-wrap";
        tableWrap.appendChild(table);

        sectionDiv.appendChild(headerDiv);
        sectionDiv.appendChild(tableWrap);
        container.appendChild(sectionDiv);
    }
}
