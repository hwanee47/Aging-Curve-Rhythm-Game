export function advanceParticles(particles) {
  for (const particle of particles) {
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.vy += .14;
    particle.life -= .035;
  }
  return particles.filter(particle => particle.life > 0);
}
