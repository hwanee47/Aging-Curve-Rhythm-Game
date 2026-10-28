export const SONG = {
  title: 'MIDNIGHT SIGNAL',
  artist: 'AGING CURVE ORIGINAL',
  bpm: 128,
  bars: 24,
  get beat() { return 60 / this.bpm; },
  get duration() { return (4 + this.bars * 4 + 2) * this.beat; },
};

export function buildChart(difficulty = 'normal') {
  const notes = [];
  const lanes = difficulty === 'easy' || difficulty === 'normal' ? 4 : 7;
  const add = (beat, lane) => notes.push({ id: notes.length, t: beat * SONG.beat, lane, hit: false, missed: false });
  for (let bar = 0; bar < SONG.bars; bar++) {
    const start = 4 + bar * 4;
    const phrase = Math.floor(bar / 4);
    for (let step = 0; step < 4; step++) {
      if (difficulty !== 'easy' || step !== 3 || bar % 2 === 0) {
        add(start + step, (bar * 2 + step * 2 + phrase) % lanes);
      }
      if (difficulty !== 'easy' && (step === 1 || step === 3 || (bar % 4 === 3 && step === 2))) {
        add(start + step + .5, (bar + step * 3 + 4 + phrase) % lanes);
      }
      if (difficulty === 'hard' || difficulty === 'superhard') {
        if (step === 0 || step === 2) add(start + step + .5, (bar + step + 2) % 7);
        if (step === 0 && bar % 2 === 1) add(start + step, (bar + phrase + 3) % 7);
      }
      if (difficulty === 'superhard') {
        if (step === 1 || step === 3) add(start + step + .25, (bar + step + phrase + 5) % 7);
        if (step === 2) add(start + step + .75, (bar * 3 + phrase + 1) % 7);
      }
    }
  }
  notes.sort((a, b) => a.t - b.t || a.lane - b.lane);
  for (let bar = 0; bar < SONG.bars; bar += 2) {
    const start = (4 + bar * 4) * SONG.beat;
    const head = notes.find(note => Math.abs(note.t - start) < .001);
    if (head) head.endT = head.t + 2 * SONG.beat;
  }
  const chart = notes.filter(note => !notes.some(hold => hold.endT && hold !== note && hold.lane === note.lane && note.t > hold.t && note.t <= hold.endT));
  return chart.map((note, id) => ({ ...note, id }));
}

export function judgeOffset(offset) {
  const distance = Math.abs(offset);
  if (distance <= .055) return 'PERFECT';
  if (distance <= .11) return 'GREAT';
  if (distance <= .18) return 'GOOD';
  return null;
}

export function findHit(notes, lane, time) {
  let best = -1, distance = .181;
  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];
    if (note.hit || note.missed || note.holding || note.lane !== lane) continue;
    const d = Math.abs(note.t - time);
    if (d < distance) { best = i; distance = d; }
    if (note.t > time + .18) break;
  }
  return best;
}

export function holdResult(note, time, isPressed) {
  if (!note.holding || note.hit || note.missed) return null;
  if (time >= note.endT) return 'complete';
  if (!isPressed) return time >= note.endT - .08 ? 'complete' : 'miss';
  return null;
}
