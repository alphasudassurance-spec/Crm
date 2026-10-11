// Confettis légers sans dépendance
const canvas = document.getElementById('confetti');
const ctx = canvas.getContext('2d');
let parts = [], raf = null;
function resize() { canvas.width = innerWidth; canvas.height = innerHeight; }
addEventListener('resize', resize); resize();
const COLORS = ['#ffb020', '#ff7a1a', '#4f8cff', '#8b6cff', '#2dd4a0', '#ff6bd6', '#38d6f5', '#ffffff'];
export function confetti({ count = 160, origin = { x: 0.5, y: 0.4 }, spread = 70, power = 14 } = {}) {
  for (let i = 0; i < count; i++) {
    const angle = (-90 + (Math.random() - 0.5) * spread) * Math.PI / 180;
    const v = power * (0.5 + Math.random());
    parts.push({ x: origin.x * canvas.width, y: origin.y * canvas.height, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v, g: 0.35, w: 6 + Math.random() * 6, h: 4 + Math.random() * 6, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3, c: COLORS[i % COLORS.length], life: 90 + Math.random() * 60 });
  }
  if (!raf) tick();
}
function tick() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  parts = parts.filter((p) => p.life > 0 && p.y < canvas.height + 20);
  for (const p of parts) {
    p.vy += p.g; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life--;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.globalAlpha = Math.min(1, p.life / 30); ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
  }
  raf = parts.length ? requestAnimationFrame(tick) : (ctx.clearRect(0, 0, canvas.width, canvas.height), null);
}
