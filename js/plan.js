/* ══════════════════════════════════════════
   PLAN / FEATURE ACCESS
   Everything is unlocked while the app is free. When billing launches,
   only this file changes: set the user's plan and the free-tier limits.
   ══════════════════════════════════════════ */

const APP_VERSION = 'v9.0';

const PLAN = {
    current: 'free',        // later: 'free' | 'trial' | 'pro' | 'founder' (from the user's account)
    billingEnabled: false   // flip to true when paid plans launch
};

// Free-tier limits that apply only once billing is enabled
const FREE_LIMITS = {
    maxRoutines: 3,
    timeScale: false
};

function isPro() {
    return !PLAN.billingEnabled || ['trial', 'pro', 'founder'].includes(PLAN.current);
}

/* canUse('timeScale'), canUse('newRoutine', currentCount) */
function canUse(feature, count) {
    if (isPro()) return true;
    if (feature === 'newRoutine') return count < FREE_LIMITS.maxRoutines;
    return !!FREE_LIMITS[feature];
}

function planLabel() {
    if (!PLAN.billingEnabled) return 'Free — all features unlocked.';
    return isPro() ? 'Pro — all features unlocked.' : `Free — up to ${FREE_LIMITS.maxRoutines} routines.`;
}
