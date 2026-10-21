/* ══════════════════════════════════════════
   BACKUP / RESTORE
   ══════════════════════════════════════════ */

function backupText() {
    return JSON.stringify({ app: 'ProFit Elite', version: DATA_VERSION, exported: new Date().toISOString(), data: appData }, null, 1);
}

async function exportBackup() {
    const text = backupText();
    const fileName = `profit-routines-${new Date().toISOString().slice(0,10)}.json`;
    const file = new File([text], fileName, { type: 'application/json' });
    // iPhone/Android: share sheet lets you save to Files, iCloud, Drive, mail, WhatsApp…
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: 'ProFit routines backup' }); return; }
        catch (e) { if (e.name === 'AbortError') return; }
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copyBackup() {
    const text = backupText();
    try { await navigator.clipboard.writeText(text); alert('Backup copied. Paste it into Notes or an email to keep it safe.'); }
    catch (e) {
        const ta = document.getElementById('restore-text');
        ta.value = text; ta.select();
        alert('Could not copy automatically. The backup text is in the box — select it and copy manually.');
    }
}

function restoreBackup() {
    const text = document.getElementById('restore-text').value.trim();
    if (text) applyBackup(text);
    else document.getElementById('restore-file').click();
}

function restoreFromFile(input) {
    const f = input.files && input.files[0];
    input.value = '';
    if (!f) return;
    f.text().then(applyBackup).catch(() => alert('Could not read that file.'));
}

/* Accepts v9 backups ({ data: {...} }) and older v8 backups ({ routines: { name: [...] } } or a plain name map). */
function applyBackup(text) {
    let parsed;
    try { parsed = JSON.parse(text); } catch (e) { alert('That is not a valid backup.'); return; }
    const incoming = normalizeData(parsed && parsed.data ? parsed.data : parsed);
    const list = incoming ? incoming.routines.filter(r => r.exercises.length || incoming.routines.length === 1) : [];
    if (!list.length) { alert('No routines found in that backup.'); return; }

    const clashes = list.filter(r => { const ex = routineByName(r.name); return ex && ex.exercises.length; }).map(r => r.name);
    if (clashes.length && !confirm(`Restore ${list.length} routine(s)?\n\nThese will be replaced: ${clashes.join(', ')}`)) return;

    // Drop the empty starter routine if it's the only thing here
    if (appData.routines.length === 1 && !appData.routines[0].exercises.length && !list.some(r => r.name === appData.routines[0].name))
        appData.routines = [];

    list.forEach(r => {
        const existing = routineByName(r.name);
        if (existing) Object.assign(existing, { exercises: r.exercises, scale: r.scale, updatedAt: new Date().toISOString() });
        else appData.routines.push(r);
    });
    if (!routineById(appData.activeId)) appData.activeId = appData.routines[0].id;
    document.getElementById('restore-text').value = '';
    if (persistData()) alert(`Restored ${list.length} routine(s).`);
    renderSettings();
}
