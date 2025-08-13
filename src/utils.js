// Utility functions for Timeline
export function secondsToMMSS(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    const mm = Math.floor(s / 60);
    const ss = s % 60;
    return `${mm.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}`;
}
