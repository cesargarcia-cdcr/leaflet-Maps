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

function getEffectiveRunStyle(runEl, pEl) {
    const pRunPr = getFirstElementNS(getFirstElementNS(pEl, "pPr"), "rPr");
    const rPr = getFirstElementNS(runEl, "rPr");

    const pColor = getFirstElementNS(pRunPr, "color")?.getAttribute("w:val");
    const rColor = getFirstElementNS(rPr, "color")?.getAttribute("w:val");
    const color = rColor || pColor;

    const rBoldEl = getFirstElementNS(rPr, "b");
    const pBoldEl = getFirstElementNS(pRunPr, "b");
    const bold = rBoldEl ? isToggleEnabled(rBoldEl) : isToggleEnabled(pBoldEl);

    const rItalicEl = getFirstElementNS(rPr, "i");
    const pItalicEl = getFirstElementNS(pRunPr, "i");
    const italic = rItalicEl ? isToggleEnabled(rItalicEl) : isToggleEnabled(pItalicEl);

    const rUnderlineEl = getFirstElementNS(rPr, "u");
    const pUnderlineEl = getFirstElementNS(pRunPr, "u");
    const underline = rUnderlineEl ? isToggleEnabled(rUnderlineEl) : isToggleEnabled(pUnderlineEl);

    return { color, bold, italic, underline };
}

function buildRunNode(runEl, pEl) {
    const { color, bold, italic, underline } = getEffectiveRunStyle(runEl, pEl);

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

    const hasStyling = (color && color.toLowerCase() !== "auto") || bold || italic || underline;
    if (!hasStyling) {
        return frag;
    }

    const span = document.createElement("span");
    if (color && color.toLowerCase() !== "auto") {
        span.style.color = `#${color}`;
    }
    if (bold) span.style.fontWeight = "700";
    if (italic) span.style.fontStyle = "italic";
    if (underline) span.style.textDecoration = "underline";
    span.appendChild(frag);
    return span;
}

function buildParagraphNode(pEl) {
    const p = document.createElement("p");
    p.className = "vt-cell-paragraph";

    const pPr = getFirstElementNS(pEl, "pPr");
    const alignVal = getFirstElementNS(pPr, "jc")?.getAttribute("w:val");
    if (alignVal === "center" || alignVal === "right") {
        p.style.textAlign = alignVal;
    }

    const runs = getDirectChildrenNS(pEl, "r");
    runs.forEach((runEl) => {
        p.appendChild(buildRunNode(runEl, pEl));
    });

    if (!p.textContent && p.children.length === 0) {
        p.appendChild(document.createElement("br"));
    }

    return p;
}

export function convertWordXmlToTable(xmlString, fileName) {
    const doc = new DOMParser().parseFromString(xmlString, "application/xml");
    const parseError = doc.getElementsByTagName("parsererror")[0];
    if (parseError) {
        throw new Error(`XML parse error in ${fileName}: ${parseError.textContent}`);
    }

    const tblEl = getFirstElementNS(doc, "tbl");
    if (!tblEl) {
        throw new Error(`No <w:tbl> element found in ${fileName}`);
    }

    const table = document.createElement("table");
    table.className = "vt-table";
    table.dataset.sourceFile = fileName;

    const rows = getDirectChildrenNS(tblEl, "tr");
    rows.forEach((trEl, rowIndex) => {
        const tr = document.createElement("tr");
        const trPr = getFirstElementNS(trEl, "trPr");
        const isHeaderRow = rowIndex === 0 || Boolean(getFirstElementNS(trPr, "tblHeader"));

        const cells = getDirectChildrenNS(trEl, "tc");
        cells.forEach((tcEl) => {
            const tcPr = getFirstElementNS(tcEl, "tcPr");
            const gridSpan = getFirstElementNS(tcPr, "gridSpan")?.getAttribute("w:val");
            const fillHex = getFirstElementNS(tcPr, "shd")?.getAttribute("w:fill");

            const cell = document.createElement(isHeaderRow ? "th" : "td");
            if (gridSpan && parseInt(gridSpan, 10) > 1) {
                cell.colSpan = parseInt(gridSpan, 10);
            }
            if (fillHex && fillHex.toLowerCase() !== "auto") {
                cell.style.backgroundColor = `#${fillHex}`;
            }

            const paragraphs = getDirectChildrenNS(tcEl, "p");
            paragraphs.forEach((pEl) => {
                cell.appendChild(buildParagraphNode(pEl));
            });

            tr.appendChild(cell);
        });

        table.appendChild(tr);
    });

    return table;
}

export async function loadAndRenderAllVisitTypeTables(containerSelector) {
    const container = document.querySelector(containerSelector);
    if (!container) return;

    const tablesDir = await getTablesDirectory();
    const files = [];

    for await (const [name, handle] of tablesDir.entries()) {
        if (handle.kind === "file" && /^tableXml\d+\.txt$/i.test(name)) {
            const order = parseInt(name.match(/\d+/)[0], 10);
            files.push({ name, handle, order });
        }
    }

    files.sort((a, b) => a.order - b.order);
    container.replaceChildren();

    for (const item of files) {
        const file = await item.handle.getFile();
        const xmlText = await file.text();

        const wrapper = document.createElement("div");
        wrapper.className = "vt-table-card";
        wrapper.appendChild(convertWordXmlToTable(xmlText, item.name));
        container.appendChild(wrapper);
    }
}