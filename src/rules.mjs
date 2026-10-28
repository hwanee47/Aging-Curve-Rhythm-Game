export const KEY_LABELS = ['S', 'D', 'F', 'SPACE', 'H', 'J', 'K'];
export const KEY_CODES = ['KeyS', 'KeyD', 'KeyF', 'Space', 'KeyH', 'KeyJ', 'KeyK'];
const FOUR_KEY_LABELS = ['S', 'D', 'J', 'K'];
const FOUR_KEY_CODES = ['KeyS', 'KeyD', 'KeyJ', 'KeyK'];

export function keyLabelsForDifficulty(level) { return level === 'easy' || level === 'normal' ? FOUR_KEY_LABELS : KEY_LABELS; }
export function laneForCode(code, level = 'hard') { return (level === 'easy' || level === 'normal' ? FOUR_KEY_CODES : KEY_CODES).indexOf(code); }
export function isPauseCode(code) { return code === 'KeyP'; }
export function normalizeName(value) { return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, 12); }

export function insertRanking(rows, entry) {
  return [...rows, entry]
    .filter(row => row && typeof row.name === 'string' && Number.isFinite(row.score))
    .sort((a, b) => b.score - a.score || (b.accuracy || 0) - (a.accuracy || 0) || (a.at || 0) - (b.at || 0))
    .slice(0, 10);
}
