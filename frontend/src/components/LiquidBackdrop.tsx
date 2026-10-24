import { useContext, useEffect, useRef } from 'react';
import { ThemeContext } from '../context/ThemeContext';

/**
 * Full-screen liquid backdrop: layered, slowly flowing folds of glossy liquid with light catching their ridges
 * (black satin in dark mode, warm beige satin in light mode). It is painted on a 0.4-resolution canvas behind
 * the glass cards at 24 frames a second (about 6 ms a frame on a 1080p screen), pauses with the tab, and holds
 * still when the device asks for reduced motion.
 */

interface Fold {
  /** Vertical position of the fold's crest, as a share of the screen height. */
  y: number;
  /** How far the fold climbs from left to right (the reference flows diagonally). */
  tilt: number;
  amplitude: number;
  waves: number;
  speed: number;
  phase: number;
  depth: number;
  /** Brightness of this fold's body relative to the base colour. */
  tone: number;
}

interface Look {
  base: [string, string];
  body: [number, number, number];
  shade: string;
  shine: string;
  shineStrength: number;
  veil: string;
}

const folds: Fold[] = [
  { y: -.1, tilt: -.42, amplitude: .1, waves: .7, speed: .16, phase: .4, depth: .36, tone: 1.15 },
  { y: .08, tilt: -.5, amplitude: .11, waves: .85, speed: .13, phase: 1.9, depth: .32, tone: .85 },
  { y: .26, tilt: -.38, amplitude: .12, waves: .62, speed: .18, phase: 3.1, depth: .34, tone: 1.3 },
  { y: .43, tilt: -.46, amplitude: .09, waves: 1, speed: .12, phase: 4.6, depth: .3, tone: .95 },
  { y: .6, tilt: -.4, amplitude: .11, waves: .75, speed: .15, phase: 5.8, depth: .33, tone: 1.2 },
  { y: .78, tilt: -.52, amplitude: .1, waves: .9, speed: .13, phase: 2.6, depth: .34, tone: .9 },
  { y: .96, tilt: -.42, amplitude: .09, waves: .7, speed: .17, phase: .9, depth: .36, tone: 1.1 },
];

const looks: Record<'dark' | 'light', Look> = {
  dark: {
    base: ['#0c0c0e', '#010101'],
    body: [17, 17, 20],
    shade: 'rgba(0,0,0,.92)',
    shine: '232,234,240',
    shineStrength: .68,
    veil: 'rgba(0,0,0,.18)',
  },
  light: {
    base: ['#ece4d8', '#d8ccba'],
    body: [222, 211, 194],
    shade: 'rgba(122,100,74,.42)',
    shine: '255,251,243',
    shineStrength: .85,
    veil: 'rgba(236,228,216,.12)',
  },
};

const RESOLUTION = .4;
/** The soft body sheen is drawn this much smaller again and upscaled, which blurs it for free. */
const SHEEN_SCALE = 1 / 12;
const FRAME_MS = 1000 / 24;
const STEPS = 48;
const TAU = Math.PI * 2;

function crest(fold: Fold, u: number, t: number) {
  return fold.y + fold.tilt * (u - .5)
    + fold.amplitude * Math.sin(u * fold.waves * TAU + t * fold.speed + fold.phase)
    + fold.amplitude * .45 * Math.sin(u * fold.waves * 1.7 * TAU - t * fold.speed * .7 + fold.phase * 1.9)
    + fold.amplitude * .2 * Math.sin(u * fold.waves * 3.1 * TAU + t * fold.speed * 1.4 + fold.phase * .6);
}

/** Smooth path through the points (quadratic curves via midpoints), shifted down by `offset`; no corners for wide strokes to catch on. */
function trace(context: CanvasRenderingContext2D, points: Array<[number, number]>, offset = 0, continuePath = false) {
  const [firstX, firstY] = points[0];
  if (continuePath) context.lineTo(firstX, firstY + offset); else context.moveTo(firstX, firstY + offset);
  for (let index = 1; index < points.length - 1; index += 1) {
    const [x, y] = points[index];
    const [nextX, nextY] = points[index + 1];
    context.quadraticCurveTo(x, y + offset, (x + nextX) / 2, (y + nextY) / 2 + offset);
  }
  const [lastX, lastY] = points[points.length - 1];
  context.lineTo(lastX, lastY + offset);
}

/** Draws the fold's broad body sheen on the tiny sheen canvas (which `context` belongs to here), ready to be scaled up. */
function sheenBand(context: CanvasRenderingContext2D, top: Array<[number, number]>, width: number, height: number, body: number, shine: CanvasGradient) {
  const { canvas } = context;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
  context.strokeStyle = shine;
  context.lineCap = 'round';
  context.lineWidth = body * .3;
  context.beginPath();
  trace(context, top, body * .3);
  context.stroke();
}

function paint(context: CanvasRenderingContext2D, sheen: CanvasRenderingContext2D, width: number, height: number, t: number, look: Look) {
  const backdrop = context.createLinearGradient(0, 0, width, height);
  backdrop.addColorStop(0, look.base[0]);
  backdrop.addColorStop(1, look.base[1]);
  context.fillStyle = backdrop;
  context.fillRect(0, 0, width, height);

  folds.forEach(fold => {
    const top: Array<[number, number]> = [];
    const bottom: Array<[number, number]> = [];
    let highest = Infinity;
    for (let step = 0; step <= STEPS; step += 1) {
      const u = step / STEPS;
      const x = u * width;
      const y = crest(fold, u, t) * height;
      // The fold thickens and thins along its length, like liquid pooling.
      const depth = fold.depth * height * (1 + .3 * Math.sin(u * 2.4 * TAU + t * fold.speed * 1.3 + fold.phase));
      top.push([x, y]);
      bottom.push([x, y + depth]);
      highest = Math.min(highest, y);
    }

    // Body: lit just under the crest, falling into shadow toward the next fold.
    const [r, g, b] = look.body.map(channel => Math.min(255, Math.round(channel * fold.tone)));
    const shading = context.createLinearGradient(0, highest, 0, highest + fold.depth * height * 1.3);
    shading.addColorStop(0, `rgb(${Math.min(255, r + 38)},${Math.min(255, g + 38)},${Math.min(255, b + 42)})`);
    shading.addColorStop(.3, `rgb(${r},${g},${b})`);
    shading.addColorStop(1, look.shade);
    context.beginPath();
    trace(context, top);
    trace(context, bottom.slice().reverse(), 0, true);
    context.closePath();
    context.fillStyle = shading;
    context.fill();

    // Specular highlight along the crest; it brightens in patches that travel along the fold.
    const shine = context.createLinearGradient(0, 0, width, 0);
    for (let stop = 0; stop <= 10; stop += 1) {
      const wave = Math.max(0, Math.sin((stop / 10) * 1.6 * TAU + t * .35 + fold.phase));
      shine.addColorStop(stop / 10, `rgba(${look.shine},${(wave ** 3 * look.shineStrength).toFixed(3)})`);
    }
    context.strokeStyle = shine;
    context.lineJoin = 'round';
    context.lineCap = 'round';
    // A broad, faint band across the body gives the fold its rounded, glossy volume. It is drawn on the tiny
    // sheen canvas and scaled up straight away, so it stays under the next fold.
    sheenBand(sheen, top, width, height, fold.depth * height, shine);
    context.globalAlpha = .26;
    context.drawImage(sheen.canvas, 0, 0, width, height);
    // Then the crisp specular line on the crest with its glow.
    ([[16, .07], [6, .2], [2.4, .6], [1, 1]] as const).forEach(([lineWidth, alpha]) => {
      context.globalAlpha = alpha;
      context.lineWidth = lineWidth;
      context.beginPath();
      trace(context, top, 1.5);
      context.stroke();
    });
    context.globalAlpha = 1;
  });

  // Soft edge falloff, as in a photographed surface.
  const vignette = context.createRadialGradient(width / 2, height / 2, Math.min(width, height) * .2, width / 2, height / 2, Math.max(width, height) * .75);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, look.veil);
  context.fillStyle = vignette;
  context.fillRect(0, 0, width, height);
}

export default function LiquidBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const theme = useContext(ThemeContext)?.theme ?? 'dark';

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    const sheen = document.createElement('canvas').getContext('2d');
    if (!canvas || !context || !sheen) return undefined;
    const look = looks[theme];
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const start = performance.now();
    let frame = 0;
    let last = 0;
    const draw = (now: number) => paint(context, sheen, canvas.width, canvas.height, (now - start) / 1000 + 30, look);

    const resize = () => {
      canvas.width = Math.max(64, Math.round(window.innerWidth * RESOLUTION));
      canvas.height = Math.max(64, Math.round(window.innerHeight * RESOLUTION));
      sheen.canvas.width = Math.max(8, Math.round(canvas.width * SHEEN_SCALE));
      sheen.canvas.height = Math.max(8, Math.round(canvas.height * SHEEN_SCALE));
      draw(performance.now());
    };
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (now - last < FRAME_MS) return;
      last = now;
      draw(now);
    };

    resize();
    window.addEventListener('resize', resize);
    if (!still) frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', resize); };
  }, [theme]);

  return <canvas ref={canvasRef} className="liquid-backdrop" aria-hidden="true" />;
}
