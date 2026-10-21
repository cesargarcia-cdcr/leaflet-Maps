document.addEventListener("DOMContentLoaded", async function() {
    const infoSectionBody = document.querySelector('#info-section .card-body');
    if (!infoSectionBody) return;

    infoSectionBody.innerHTML = '<span class="guidelines-status guidelines-loading">Scanning clinic directories in OPFS...</span>';

    // Extract the numeric sort order, apply the Critical rule, and clean up the display name.
    function parseSortingName(rawName) {
        let order = Infinity;
        let remainder = rawName;

        const numMatch = rawName.match(/^(\d+)_(.+)$/);
        if (numMatch) {
            order = parseInt(numMatch[1], 10);
            remainder = numMatch[2];
        }

        // Handle the "Critical" prefix.
        const criticalRegex = /^critical_(.+)$/i;
        const critMatch = remainder.match(criticalRegex);

        let isCritical = false;
        let displayName = remainder.replace(/_/g, ' ');

        // Mark names that are "Critical" or begin with "Critical_".
        if (remainder.toLowerCase() === 'critical' || remainder.toLowerCase().startsWith('critical_')) {
            isCritical = true;
            if (critMatch) {
                // For names such as "01_Critical_text", hide the number and "Critical" prefix.
                displayName = critMatch[1].replace(/_/g, ' ');
            }
        }

        return {
            order: order,
            cleanName: remainder.replace(/_/g, ' '),
            displayName: displayName,
            isCritical: isCritical
        };
    }

    // Compare names by numeric order, then alphabetically.
    function sortItems(a, b) {
        const itemA = parseSortingName(a);
        const itemB = parseSortingName(b);

        if (itemA.order !== itemB.order) {
            return itemA.order - itemB.order;
        }
        return itemA.cleanName.localeCompare(itemB.cleanName);
    }

    // Read the directory structure and HTML files from OPFS.
    async function loadGuidelinesFromOPFS() {
        try {
            const rootDir = await navigator.storage.getDirectory();
            const guidelinesDir = await rootDir.getDirectoryHandle("Guidelines_Info", { create: false });
            
            const guidelinesData = {};

            // Iterate through folders in Guidelines_Info.
            for await (const [folderName, folderHandle] of guidelinesDir.entries()) {
                if (folderHandle.kind === 'directory') {
                    const htmlFiles = [];
                    
                    // Collect HTML files from each subfolder.
                    for await (const [fileName, fileHandle] of folderHandle.entries()) {
                        if (fileHandle.kind === 'file' && fileName.toLowerCase().endsWith('.html')) {
                            htmlFiles.push(fileName);
                        }
                    }

                    guidelinesData[folderName] = htmlFiles;
                }
            }

            return guidelinesData;
        } catch (err) {
            console.warn("⚠️ Guidelines_Info was not found in OPFS or is empty:", err);
            return null;
        }
    }

    // Read a specific HTML file from OPFS.
    async function fetchHtmlFromOPFS(folderName, fileName) {
        try {
            const rootDir = await navigator.storage.getDirectory();
            const guidelinesDir = await rootDir.getDirectoryHandle("Guidelines_Info");
            const folderHandle = await guidelinesDir.getDirectoryHandle(folderName);
            const fileHandle = await folderHandle.getFileHandle(fileName);
            const file = await fileHandle.getFile();
            return await file.text();
        } catch (err) {
            throw new Error(`Could not read the local file: ${err.message}`);
        }
    }

    // 1. Load the directory structure from OPFS.
    const guidelines = await loadGuidelinesFromOPFS();

    if (!guidelines || Object.keys(guidelines).length === 0) {
        infoSectionBody.innerHTML = '<div class="guidelines-status guidelines-empty">No folders or HTML files were found in Guidelines_Info on OPFS.</div>';
        return;
    }

    infoSectionBody.innerHTML = '';

    // 2. Sort the folders.
    const sortedFolders = Object.keys(guidelines).sort(sortItems);

    // 3. Iterate through the sorted folders.
    sortedFolders.forEach(folderName => {
        const folderInfo = parseSortingName(folderName);
        
        const infoGroup = document.createElement('div');
        infoGroup.className = 'info-group';
        
        // Use the critical flag returned by parseSortingName.
        const isCritical = folderInfo.isCritical;
        
        infoGroup.classList.toggle('is-critical', isCritical);
        
        infoGroup.innerHTML = `
            <div class="guidelines-group-header">
                📁 ${folderInfo.displayName}
            </div>
            <div class="group-content"></div>
        `;
        
        const groupContent = infoGroup.querySelector('.group-content');
        const rawFiles = guidelines[folderName];

        if (rawFiles.length === 0) {
            groupContent.innerHTML = '<div class="guidelines-file-empty">No HTML documents in this folder.</div>';
        }

        // 4. Sort the HTML files.
        const sortedFiles = rawFiles.sort(sortItems);

        // 5. Iterate through the sorted HTML files.
        sortedFiles.forEach(fileName => {
            const nameWithoutExt = fileName.replace('.html', '');
            const fileInfo = parseSortingName(nameWithoutExt);
            
            const details = document.createElement('details');
            // Use native exclusive accordion behavior within each folder.
            details.setAttribute('name', `accordion-${folderName}`);
            details.className = 'guidelines-file-details';
            
            const lowerName = fileInfo.cleanName.toLowerCase();
            const isHighRisk = lowerName.includes('dea') || lowerName.includes('fraud') || lowerName.includes('compliance');
            
            const fileIcon = isHighRisk ? '🛡️' : '📄';
            
            const targetId = `dynamic-${folderName}-${nameWithoutExt}`.replace(/\s+/g, '-');
            
            details.innerHTML = `
                <summary class="guidelines-file-summary${isHighRisk ? ' is-high-risk' : ''}">
                    ${fileIcon} ${fileInfo.displayName}
                </summary>
                <div id="${targetId}" class="guidelines-file-content">
                    <span class="guidelines-loading">Loading local content...</span>
                </div>
            `;
            
            groupContent.appendChild(details);

            // 6. Read the HTML file asynchronously from OPFS.
            fetchHtmlFromOPFS(folderName, fileName)
                .then(htmlContent => {
                    const container = document.getElementById(targetId);
                    if (!container) return;
                    container.innerHTML = htmlContent;

                    // Re-create script elements included in the injected HTML so they execute.
                    const scripts = container.querySelectorAll('script');
                    scripts.forEach(oldScript => {
                        const newScript = document.createElement('script');
                        Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
                        newScript.appendChild(document.createTextNode(oldScript.innerHTML));
                        oldScript.parentNode.replaceChild(newScript, oldScript);
                    });
                })
                .catch(err => {
                    const container = document.getElementById(targetId);
                    if (container) {
                        container.innerHTML = `<span class="guidelines-error">⚠️ Error loading from OPFS: ${err.message}</span>`;
                    }
                });
        });
        
        infoSectionBody.appendChild(infoGroup);
    });
});