/* ══════════════════════════════════════════
   STORAGE — the only place that touches localStorage.
   Later this is where Android storage / cloud sync plugs in.
   ══════════════════════════════════════════ */

const DATA_KEY = 'profit_v9_data';
const DATA_VERSION = 2;
// v8 keys: read once to migrate, never written or deleted (kept as a safety copy)
const LEGACY_SAVE_KEY = 'profit_v8_save', LEGACY_ACTIVE_KEY = 'profit_v8_active';

function storeGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
function storeSet(key, val) { try { localStorage.setItem(key, val); return true; } catch (e) { return false; } }
function storeRemove(key) { try { localStorage.removeItem(key); } catch (e) {} }

function storageWorks() {
    const k = '__profit_test__';
    if (!storeSet(k, '1')) return false;
    const ok = storeGet(k) === '1';
    storeRemove(k);
    return ok;
}

const STORAGE_OK = storageWorks();
// Ask the browser not to auto-evict our data (Chrome/Android honour this; Safari mostly ignores it).
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

function newId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

function cleanExercise(x) {
    return {
        n:  String((x && x.n) || 'Exercise'),
        w:  parseInt(x && x.w)  || 30,
        r:  parseInt(x && x.r)  || 15,
        rd: parseInt(x && x.rd) || 1
    };
}

function makeRoutine(name, exercises, extra = {}) {
    const now = new Date().toISOString();
    return {
        id: extra.id || newId(),
        name: String(name),
        exercises: (exercises || []).filter(x => x && typeof x === 'object').map(cleanExercise),
        scale: clampScale(extra.scale),
        createdAt: extra.createdAt || now,
        updatedAt: extra.updatedAt || now
    };
}

function clampScale(v) {
    const n = parseInt(v);
    return (n >= 10 && n <= 200) ? n : 100;
}

/* Accepts any known shape and returns a clean v2 data object (or null):
   - v2: { version, routines: [ {id,name,exercises,...} ], activeId }
   - v8 / old backups: { "Routine name": [ {n,w,r,rd} ] }  (optionally wrapped in { routines: {...} }) */
function normalizeData(raw, legacyActiveName) {
    if (!raw || typeof raw !== 'object') return null;
    if (Array.isArray(raw.routines)) {
        const routines = raw.routines.filter(r => r && typeof r === 'object' && r.name)
            .map(r => makeRoutine(r.name, r.exercises, r));
        return { version: DATA_VERSION, routines, activeId: raw.activeId || null, updatedAt: raw.updatedAt || new Date().toISOString() };
    }
    const map = (raw.routines && typeof raw.routines === 'object') ? raw.routines : raw;
    const routines = Object.entries(map).filter(([, list]) => Array.isArray(list)).map(([name, list]) => makeRoutine(name, list));
    if (!routines.length) return null;
    const active = routines.find(r => r.name === legacyActiveName);
    return { version: DATA_VERSION, routines, activeId: active ? active.id : null, updatedAt: new Date().toISOString() };
}

function loadData() {
    let data = null;
    try { data = normalizeData(JSON.parse(storeGet(DATA_KEY) || 'null')); } catch (e) {}
    if (!data) {
        // First run of v9: migrate v8 routines
        try { data = normalizeData(JSON.parse(storeGet(LEGACY_SAVE_KEY) || 'null'), storeGet(LEGACY_ACTIVE_KEY)); } catch (e) {}
        if (data) { appData = data; persistData(true); }
    }
    if (!data) data = { version: DATA_VERSION, routines: [], activeId: null, updatedAt: new Date().toISOString() };
    if (!data.routines.length) data.routines.push(makeRoutine('My Routine', []));
    if (!data.routines.some(r => r.id === data.activeId)) data.activeId = data.routines[0].id;
    return data;
}

/* Writes appData. Returns true on success; warns the user (unless quiet) on failure. */
function persistData(quiet) {
    appData.updatedAt = new Date().toISOString();
    const json = JSON.stringify(appData);
    const ok = storeSet(DATA_KEY, json) && storeGet(DATA_KEY) === json;
    if (!ok && !quiet) alert('⚠ Could not save on this device.\n\nPrivate Browsing or "Block All Cookies" may be on, or storage is full. ' +
        'Your changes will be lost when you close the page — use Settings → Backup → Export to keep a copy.');
    return ok;
}

function clearAllData() {
    [DATA_KEY, LEGACY_SAVE_KEY, LEGACY_ACTIVE_KEY].forEach(storeRemove);
}

let appData = null;
appData = loadData();
