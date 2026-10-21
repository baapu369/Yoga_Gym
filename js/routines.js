/* ══════════════════════════════════════════
   ROUTINES — list, create, edit, duration scaling
   ══════════════════════════════════════════ */

function activeRoutine() { return appData.routines.find(r => r.id === appData.activeId) || appData.routines[0]; }
function routineById(id) { return appData.routines.find(r => r.id === id); }
function routineByName(name) { return appData.routines.find(r => r.name === name); }
function setActive(id) { appData.activeId = id; persistData(true); }

function htmlEsc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

/* ── Builder: landing vs edit ── */
function showLanding() {
    const warn = document.getElementById('storage-warn');
    if (!STORAGE_OK) {
        warn.innerHTML = '<strong>⚠ This browser is not saving data.</strong><br>Routines will be lost when you close the page. ' +
            'Turn off Private Browsing, or in iPhone Settings → Safari turn off "Block All Cookies". Use Settings → Backup → Export to keep a copy.';
        warn.classList.remove('hidden');
    } else warn.classList.add('hidden');
    document.getElementById('builder-landing').classList.remove('hidden');
    document.getElementById('builder-edit').classList.add('hidden');
    renderSavedRoutines();
}

function showEdit() {
    document.getElementById('builder-landing').classList.add('hidden');
    document.getElementById('builder-edit').classList.remove('hidden');
    populateRoutineSelect();
    loadBuilderList();
}

function showCreatePanel() {
    if (!canUse('newRoutine', appData.routines.length)) { alert(`The free plan allows ${FREE_LIMITS.maxRoutines} routines.`); return; }
    document.getElementById('create-panel').classList.toggle('hidden');
}

function renderSavedRoutines() {
    const el = document.getElementById('saved-routines-list');
    el.innerHTML = appData.routines.map(r => {
        const count = r.exercises.length;
        let meta = 'Empty — edit to add exercises';
        if (count) {
            meta = `${count} exercise${count !== 1 ? 's' : ''} · ${formatDuration(routineSeconds(r.exercises))}`;
            if (r.scale !== 100) meta += ` → ${formatDuration(routineSeconds(scaleExercises(r.exercises, r.scale)))} at ${r.scale}%`;
        }
        return `<div class="saved-routine-card">
            <div class="rname">${htmlEsc(r.name)}</div>
            <div class="rmeta">${meta}</div>
            <div class="rbtns">
                ${count ? `<button class="btn-start-r" onclick="loadAndStart('${r.id}')">&#9654; START</button>` : ''}
                <button class="btn-edit-r" onclick="openEdit('${r.id}')">${count ? 'EDIT LIST' : 'ADD EXERCISES'}</button>
            </div>
        </div>`;
    }).join('');
}

function loadAndStart(id) {
    const r = routineById(id);
    if (!r) return;
    setActive(id);
    if (!r.exercises.length) { alert('This routine is empty. Add exercises first.'); return; }
    buildBuilderQueue(scaleExercises(r.exercises, r.scale));
    runEngine();
}

function openEdit(id) {
    setActive(id);
    showEdit();
}

/* ── Format note toggle ── */
function toggleNote(id) {
    document.getElementById(id).classList.toggle('hidden');
}

/* ── CSV parser ── */
function parseCSVRows(text) {
    const lines = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n').map(l=>l.trim()).filter(l=>l);
    const result = [];
    for (const line of lines) {
        let parts;
        if (line.includes('\t')) parts = line.split('\t').map(p=>p.trim().replace(/^["']|["']$/g,''));
        else parts = line.split(',').map(p=>p.trim().replace(/^["']|["']$/g,''));
        if (parts.length < 2) continue;
        if (['exercise_name','exercise','name'].includes(parts[0].toLowerCase())) continue;
        result.push({
            n:  parts[0] || 'Exercise',
            w:  isNaN(parseInt(parts[1])) ? 30 : parseInt(parts[1]),
            r:  isNaN(parseInt(parts[2])) ? 15 : parseInt(parts[2]),
            rd: isNaN(parseInt(parts[3])) ?  1 : parseInt(parts[3])
        });
    }
    return result;
}

/* ── Create panel tabs ── */
function switchCreateTab(tab) {
    const isPaste = tab === 'paste';
    document.getElementById('tab-paste').classList.toggle('hidden', !isPaste);
    document.getElementById('tab-manual').classList.toggle('hidden', isPaste);
    document.getElementById('tab-paste-btn').style.cssText = isPaste
        ? 'flex:1;padding:11px;border-radius:12px;font-weight:800;font-size:13px;cursor:pointer;text-transform:uppercase;letter-spacing:0.5px;background:#38bdf8;color:#000;border:none;'
        : 'flex:1;padding:11px;border-radius:12px;font-weight:800;font-size:13px;cursor:pointer;text-transform:uppercase;letter-spacing:0.5px;background:#252525;color:#888;border:1px solid #333;';
    document.getElementById('tab-manual-btn').style.cssText = !isPaste
        ? 'flex:1;padding:11px;border-radius:12px;font-weight:800;font-size:13px;cursor:pointer;text-transform:uppercase;letter-spacing:0.5px;background:#38bdf8;color:#000;border:none;'
        : 'flex:1;padding:11px;border-radius:12px;font-weight:800;font-size:13px;cursor:pointer;text-transform:uppercase;letter-spacing:0.5px;background:#252525;color:#888;border:1px solid #333;';
    // Seed one blank row when switching to manual if empty
    if (!isPaste && !document.getElementById('new-routine-list').children.length) addNewExRow();
}

function exCardHtml(data) {
    return `<div class="drag-handle">⠿</div>
        <span onclick="this.parentElement.remove(); updateDurationPanel();" style="position:absolute;right:15px;top:15px;color:#ef4444;cursor:pointer;font-size:20px;">✕</span>
        <input type="text" class="name-in" placeholder="Exercise Name" value="${data ? htmlEsc(data.n) : ''}"
            style="background:transparent;border:none;border-bottom:1px solid #333;color:white;font-size:16px;width:80%;margin-left:22px;">
        <div class="card-grid" style="margin-left:22px;">
            <div class="grid-item"><label>Work(s)</label><input type="number" class="w-in" value="${data?data.w:30}"></div>
            <div class="grid-item"><label>Rest(s)</label><input type="number" class="r-in" value="${data?data.r:15}"></div>
            <div class="grid-item"><label>Round</label><input type="number" class="rd-in" value="${data?data.rd:1}"></div>
        </div>`;
}

function readCards(listId) {
    return [...document.querySelectorAll(`#${listId} .ex-card`)].map(c => cleanExercise({
        n:  c.querySelector('.name-in').value.trim() || 'Exercise',
        w:  c.querySelector('.w-in').value,
        r:  c.querySelector('.r-in').value,
        rd: c.querySelector('.rd-in').value
    }));
}

function addNewExRow(data = null) {
    const div = document.createElement('div');
    div.className = 'ex-card';
    div.innerHTML = exCardHtml(data);
    document.getElementById('new-routine-list').appendChild(div);
}

/* Creates a routine, or replaces the exercises of an existing one with the same name. */
function saveNewRoutine(exercises) {
    let name = prompt('Name this routine:', 'My Routine');
    if (!name || !name.trim()) return false;
    name = name.trim();
    let r = routineByName(name);
    if (r) {
        if (!confirm(`"${name}" already exists. Replace its content?`)) return false;
        r.exercises = exercises.map(cleanExercise);
        r.updatedAt = new Date().toISOString();
    } else {
        // Drop the empty starter routine once the user makes a real one
        const starter = appData.routines.length === 1 && !appData.routines[0].exercises.length ? appData.routines[0] : null;
        r = makeRoutine(name, exercises);
        appData.routines.push(r);
        if (starter) appData.routines = appData.routines.filter(x => x !== starter);
    }
    appData.activeId = r.id;
    persistData();
    return true;
}

function createFromManual() {
    const exercises = readCards('new-routine-list');
    if (!exercises.length) { alert('Add at least one exercise.'); return; }
    if (!saveNewRoutine(exercises)) return;
    document.getElementById('new-routine-list').innerHTML = '';
    document.getElementById('create-panel').classList.add('hidden');
    showEdit();
}

/* ── Create new routine from paste (landing) ── */
function createFromPaste() {
    const text = document.getElementById('paste-landing').value.trim();
    if (!text) { alert('Please paste exercise data first.'); return; }
    const exercises = parseCSVRows(text);
    if (!exercises.length) { alert('No valid exercises found. Check the format.'); return; }
    if (!saveNewRoutine(exercises)) return;
    document.getElementById('paste-landing').value = '';
    document.getElementById('create-panel').classList.add('hidden');
    showEdit();
}

/* ── Import more inside edit ── */
function importIntoEdit() {
    const text = document.getElementById('paste-edit').value.trim();
    if (!text) { alert('Please paste exercise data first.'); return; }
    const exercises = parseCSVRows(text);
    if (!exercises.length) { alert('No valid exercises found.'); return; }
    exercises.forEach(ex => addExRow(ex));
    document.getElementById('paste-edit').value = '';
    updateDurationPanel();
}

/* ── Routine management ── */
function populateRoutineSelect() {
    const sel = document.getElementById('routine-select');
    sel.innerHTML = '';
    appData.routines.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.id; opt.textContent = r.name;
        if (r.id === appData.activeId) opt.selected = true;
        sel.appendChild(opt);
    });
}

function switchRoutine() {
    setActive(document.getElementById('routine-select').value);
    loadBuilderList();
}

function renameRoutinePrompt() {
    const r = activeRoutine();
    const newName = prompt('Rename to:', r.name);
    if (!newName || !newName.trim() || newName.trim() === r.name) return;
    const trimmed = newName.trim();
    if (routineByName(trimmed)) { alert('A routine with that name already exists.'); return; }
    r.name = trimmed;
    r.updatedAt = new Date().toISOString();
    persistData();
    populateRoutineSelect();
}

function deleteRoutinePrompt() {
    if (appData.routines.length <= 1) { alert('Cannot delete the only routine.'); return; }
    const r = activeRoutine();
    if (!confirm(`Delete "${r.name}"?`)) return;
    appData.routines = appData.routines.filter(x => x.id !== r.id);
    appData.activeId = appData.routines[0].id;
    persistData();
    showLanding();
}

/* ── Builder list ── */
function addExRow(data = null) {
    const div = document.createElement('div');
    div.className = 'ex-card';
    div.innerHTML = exCardHtml(data);
    document.getElementById('builder-list').appendChild(div);
}

function loadBuilderList() {
    const list = document.getElementById('builder-list');
    list.innerHTML = '';
    activeRoutine().exercises.forEach(d => addExRow(d));
    if (!list.children.length) addExRow();
    renderScaleChips();
    updateDurationPanel();
}

function saveCurrentRoutine() {
    const r = activeRoutine();
    r.exercises = readCards('builder-list');
    r.updatedAt = new Date().toISOString();
    if (persistData()) alert('Routine Saved!');
}

/* ── Workout duration (time scaling) ── */
function renderScaleChips() {
    const scale = activeRoutine().scale;
    document.getElementById('scale-chips').innerHTML = SCALE_PRESETS.map(p =>
        `<button class="${p === scale ? 'active' : ''}" onclick="setScale(${p})">${p}%</button>`).join('');
    document.getElementById('scale-custom').value = SCALE_PRESETS.includes(scale) ? '' : scale;
}

function setScale(value) {
    if (!canUse('timeScale')) { alert('Workout duration scaling is a Pro feature.'); return; }
    const r = activeRoutine();
    if (String(value).trim() === '') { renderScaleChips(); return; }
    const n = parseInt(value);
    if (!(n >= 10 && n <= 200)) { alert('Enter a percentage between 10 and 200.'); renderScaleChips(); return; }
    // The custom box fires "change" on blur; re-rendering then would swallow a tap on a preset chip
    if (n === r.scale) return;
    r.scale = n;
    r.updatedAt = new Date().toISOString();
    persistData();
    renderScaleChips();
    updateDurationPanel();
}

function updateDurationPanel() {
    if (document.getElementById('builder-edit').classList.contains('hidden')) return;
    const scale = activeRoutine().scale;
    const exercises = readCards('builder-list');
    const full = routineSeconds(exercises);
    const scaledList = scaleExercises(exercises, scale);
    const scaled = routineSeconds(scaledList);
    document.getElementById('dur-full').innerText = formatDuration(full);
    document.getElementById('dur-scaled').innerText = formatDuration(scaled) + (scale !== 100 ? ` (${scale}%)` : '');
    document.getElementById('dur-note').innerText = (scale !== 100 && scaledList.length)
        ? `e.g. ${scaledList[0].n}: work ${exercises[0].w}s → ${scaledList[0].w}s, rest ${exercises[0].r}s → ${scaledList[0].r}s`
        : '';
}
