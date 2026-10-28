const { test } = require('node:test');
const assert = require('node:assert/strict');

test('타격 효과 입자는 수명이 끝나면 그리기 전에 제거된다', async () => {
  const { advanceParticles } = await import('../src/particles.mjs');
  let particles = [{ x: 0, y: 0, vx: 1, vy: -1, life: 1, color: '#fff' }];
  for (let frame = 0; frame < 35; frame++) {
    particles = advanceParticles(particles);
    assert.ok(particles.every(particle => particle.life > 0));
  }
  assert.equal(particles.length, 0);
});
