/* ══════════════════════════════════════════
   WORKOUT ENGINE — queue builder, timer, voice
   ══════════════════════════════════════════ */

// Not every browser (e.g. Android app WebViews) has speech; the app must still work without it.
const synth = window.speechSynthesis || null;
const SKIP_WAIT_SECONDS = 5;
let queue = [], qIdx = 0, timeLeft = 0, totalTimeSec = 0, timer = null, paused = false;

/* ── Speech ── */
function speak(t) {
    if (!synth || typeof SpeechSynthesisUtterance === 'undefined') return;
    try { synth.cancel(); const u = new SpeechSynthesisUtterance(t); u.lang='en-IN'; u.rate=0.95; synth.speak(u); } catch (e) {}
}
function stopSpeech() { try { if (synth) synth.cancel(); } catch (e) {} }

/* ── Queue builders ── */
function buildBuilderQueue(exList) {
    queue = []; totalTimeSec = 0;
    exList.forEach((ex, idx) => {
        const n  = ex.n  || `Exercise ${idx+1}`;
        const w  = parseInt(ex.w)  || 30;
        const r  = parseInt(ex.r)  || 0;
        const rd = parseInt(ex.rd) || 1;

        for (let i = 1; i <= rd; i++) {
            // Prepare only before first ever exercise
            if (idx === 0 && i === 1) {
                queue.push({ d: n, s: 'PREPARE', v: `Next we will do ${n}. Get ready.`, t: PREPARE_SECONDS });
                totalTimeSec += PREPARE_SECONDS;
            }

            // Work phase: say "Now start" instead of "Go"
            queue.push({ d: n, s: `SET ${i}`, v: `Now start`, t: w });
            totalTimeSec += w;

            // Figure out what comes after this rest
            let nextName = null, nextSet = null;
            if (i < rd) { nextName = n; nextSet = i + 1; }
            else if (exList[idx + 1]) { nextName = exList[idx + 1].n || `Exercise ${idx+2}`; nextSet = 1; }

            // Rest voice: "Ok. Next we will do X set N. We'll start in R seconds."
            const restVoice = nextName
                ? `Ok. Next we will do ${nextName} set ${nextSet}. We'll start in ${r} seconds.`
                : `Ok. All done. Great work.`;

            queue.push({ d: 'REST', s: 'REST', v: restVoice, t: r });
            totalTimeSec += r;
        }
    });
}

function startWorkout(mode) {
    queue = []; totalTimeSec = 0;

    if (mode === 'builder') {
        const exList = readCards('builder-list');
        if (!exList.length) { alert('No exercises in the list.'); return; }
        buildBuilderQueue(scaleExercises(exList, activeRoutine().scale));

    } else if (mode === 'hiit') {
        const w=parseInt(document.getElementById('h-work').value), r=parseInt(document.getElementById('h-rest').value);
        const ex=parseInt(document.getElementById('h-ex').value), rds=parseInt(document.getElementById('h-rounds').value);
        for (let j=1; j<=rds; j++) {
            for (let i=1; i<=ex; i++) {
                if (j===1&&i===1) { queue.push({d:`Exercise 1`,s:'PREPARE',v:`Starting HIIT. Get ready.`,t:5}); totalTimeSec+=5; }
                queue.push({d:`Exercise ${i}`,s:`ROUND ${j}`,v:`Now start`,t:w}); totalTimeSec+=w;
                let rv = (i<ex) ? `Ok. Next is Exercise ${i+1}. We'll start in ${r} seconds.`
                       : (j<rds) ? `Ok. Round ${j+1} coming up. We'll start in ${r} seconds.`
                       : `Ok. Workout complete.`;
                queue.push({d:'REST',s:'REST',v:rv,t:r}); totalTimeSec+=r;
            }
        }

    } else if (mode === 'muscle') {
        const sets=parseInt(document.getElementById('m-sets').value), m=document.getElementById('m-muscle').value;
        for (let i=1; i<=sets; i++) {
            if (i===1) { queue.push({d:m,s:'PREPARE',v:`Next we will do ${m}. Get ready.`,t:5}); totalTimeSec+=5; }
            queue.push({d:m,s:`SET ${i}`,v:`Now start`,t:0});
            const rv = (i<sets) ? `Ok. Set ${i+1} coming up. We'll start in 90 seconds.` : `Ok. All sets done.`;
            queue.push({d:'REST',s:'REST',v:rv,t:90}); totalTimeSec+=90;
        }
    }

    if (!queue.length) { alert('Nothing to run — check the numbers.'); return; }
    runEngine();
}

/* ── Timer engine ── */
function updateTotalClock() {
    const el = document.getElementById('total-clock');
    el.classList.remove('done');
    el.querySelector('.tl-value').innerText = formatDuration(totalTimeSec);
}

function finishWorkout() {
    clearInterval(timer);
    const el = document.getElementById('total-clock');
    el.classList.add('done');
    el.querySelector('.tl-value').innerText = 'WORKOUT COMPLETE';
    speak('Workout complete. Well done!');
    setTimeout(() => location.reload(), 2000);
}

function advanceQueue() {
    qIdx++;
    if (qIdx < queue.length) {
        const cur = queue[qIdx];
        document.getElementById('set-num').innerText = cur.s;
        document.getElementById('ex-display').innerText = cur.d;
        speak(cur.v);
        if (cur.t === 0) {
            document.getElementById('display').innerText = 'GO';
            document.getElementById('manual-trigger').onclick = () => { timeLeft = 0; };
        } else { timeLeft = cur.t; }
        updateTotalClock();
    } else finishWorkout();
}

function timerTick() {
    if (timeLeft > 0) {
        document.getElementById('display').innerText = timeLeft;
        if (timeLeft <= 3) speak(String(timeLeft));
        timeLeft--;
        if (totalTimeSec > 0) totalTimeSec--;
        updateTotalClock();
    } else { advanceQueue(); }
}

function runEngine() {
    showScreen('timer-active');
    qIdx = 0; timeLeft = queue[0].t; paused = false;
    document.getElementById('set-num').innerText = queue[0].s;
    document.getElementById('ex-display').innerText = queue[0].d;
    document.getElementById('pause-btn').innerText = 'PAUSE';
    updateTotalClock();
    speak(queue[0].v);
    if (timer) clearInterval(timer);
    timer = setInterval(timerTick, 1000);
}

function togglePause() {
    if (paused) {
        paused = false; timer = setInterval(timerTick, 1000);
        document.getElementById('pause-btn').innerText = 'PAUSE';
    } else {
        paused = true; clearInterval(timer); timer = null;
        document.getElementById('pause-btn').innerText = 'RESUME';
        stopSpeech();
    }
}

function skipExercise() {
    let currentExName = '';
    for (let i=qIdx; i>=0; i--) { if (queue[i].d !== 'REST') { currentExName = queue[i].d; break; } }
    totalTimeSec -= timeLeft;
    let nextIdx = qIdx + 1;
    while (nextIdx < queue.length) {
        if (queue[nextIdx].d !== 'REST' && queue[nextIdx].d !== currentExName) break;
        totalTimeSec -= queue[nextIdx].t;
        nextIdx++;
    }
    if (totalTimeSec < 0) totalTimeSec = 0;
    if (nextIdx < queue.length) {
        const nextExName = queue[nextIdx].d;
        const prepItem = { d:nextExName, s:'PREPARE', v:`Next we will do ${nextExName} set 1. We'll start in ${SKIP_WAIT_SECONDS} seconds.`, t:SKIP_WAIT_SECONDS };
        queue.splice(nextIdx, 0, prepItem);
        totalTimeSec += SKIP_WAIT_SECONDS;
        qIdx = nextIdx;
        const cur = queue[qIdx];
        timeLeft = cur.t;
        document.getElementById('set-num').innerText = cur.s;
        document.getElementById('ex-display').innerText = cur.d;
        document.getElementById('display').innerText = cur.t;
        speak(cur.v);
        updateTotalClock();
        if (paused) { paused=false; timer=setInterval(timerTick,1000); document.getElementById('pause-btn').innerText='PAUSE'; }
    } else finishWorkout();
}
