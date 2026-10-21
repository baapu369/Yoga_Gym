/* ══════════════════════════════════════════
   TIME SCALING — finish a routine in X% of its full time.
   Work and rest are scaled by the same factor; the "get ready" stays fixed.
   ══════════════════════════════════════════ */

const PREPARE_SECONDS = 5;
const SCALE_PRESETS = [100, 90, 80, 75, 70, 60, 50];

function routineSeconds(exercises) {
    if (!exercises.length) return 0;
    return PREPARE_SECONDS + exercises.reduce((sum, ex) => sum + ex.rd * (ex.w + ex.r), 0);
}

/* Returns a new exercise list whose total time is as close as possible to pct% of the original. */
function scaleExercises(exercises, pct) {
    const list = exercises.map(cleanExercise);
    if (!list.length || pct === 100) return list;

    const full = routineSeconds(list);
    const scalable = full - PREPARE_SECONDS;
    if (scalable <= 0) return list;
    const target = Math.round(full * pct / 100);
    const factor = Math.max(0, target - PREPARE_SECONDS) / scalable;

    const scaled = list.map(ex => ({
        n:  ex.n,
        w:  Math.max(1, Math.round(ex.w * factor)),
        r:  ex.r > 0 ? Math.max(1, Math.round(ex.r * factor)) : 0,
        rd: ex.rd
    }));

    // Rounding each time leaves a few seconds of drift; nudge work times to land on the target.
    // Changing one exercise's work time by 1s changes the total by its round count.
    let diff = target - routineSeconds(scaled);
    const order = scaled.map((ex, i) => i).sort((a, b) => scaled[a].rd - scaled[b].rd);
    for (let guard = 0; diff !== 0 && guard < 10000; guard++) {
        const sign = Math.sign(diff);
        const i = order.find(i => scaled[i].rd <= Math.abs(diff) && scaled[i].w + sign >= 1);
        if (i === undefined) break;
        scaled[i].w += sign;
        diff -= sign * scaled[i].rd;
    }
    return scaled;
}

function formatDuration(totalSec) {
    totalSec = Math.max(0, Math.round(totalSec));
    const h = Math.floor(totalSec / 3600), m = Math.floor((totalSec % 3600) / 60), s = totalSec % 60;
    const mm = String(m).padStart(2, '0'), ss = String(s).padStart(2, '0');
    return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
