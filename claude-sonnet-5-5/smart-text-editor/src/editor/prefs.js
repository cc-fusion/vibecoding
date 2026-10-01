// Persisted preferences (radians vs degrees for trig suggestions).
const KEY = 'calc-notes-angle-v1';
let angle = null;

export function getAnglePref() {
  if (angle === null) {
    angle = 'rad';
    try {
      const v = localStorage.getItem(KEY);
      if (v === 'deg' || v === 'rad') angle = v;
    } catch (e) { /* storage unavailable */ }
  }
  return angle;
}

export function setAnglePref(v) {
  if (v !== 'rad' && v !== 'deg') return;
  angle = v;
  try { localStorage.setItem(KEY, v); } catch (e) { /* storage unavailable */ }
}
