/* ══════════════════════════════════════════
   APP — navigation, settings, startup
   ══════════════════════════════════════════ */

function showScreen(id) {
    document.querySelectorAll('.container').forEach(c => c.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    if (id === 'builder-screen') showLanding();
    if (id === 'settings-screen') renderSettings();
    window.scrollTo(0, 0);
}

function renderSettings() {
    document.getElementById('plan-status').innerText = planLabel();
    document.getElementById('app-version').innerText = APP_VERSION;
    const total = appData.routines.length;
    document.getElementById('storage-status').innerText = STORAGE_OK
        ? `${total} routine${total !== 1 ? 's' : ''} saved on this device. Nothing is sent to any server.`
        : '⚠ This browser is blocking storage — routines will not be kept. Turn off Private Browsing or "Block All Cookies".';
}

function deleteAllData() {
    if (!confirm('Delete ALL routines and settings from this device?\n\nThis cannot be undone. Export a backup first if you might need them.')) return;
    if (!confirm('Are you sure? Everything will be erased.')) return;
    clearAllData();
    location.reload();
}

/* ── Startup ── */
if (window.Sortable) {
    Sortable.create(document.getElementById('builder-list'), { animation: 150, handle: '.drag-handle' });
    Sortable.create(document.getElementById('new-routine-list'), { animation: 150, handle: '.drag-handle' });
}

// Live total time while editing work/rest/round values
document.getElementById('builder-list').addEventListener('input', updateDurationPanel);

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
}
