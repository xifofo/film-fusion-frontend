import {
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
} from 'react';

import { cn } from '@/lib/utils';

type OpticalLogoProps = {
  className?: string;
  interactive?: boolean;
};

type LogoMotion = {
  hover: number;
  pointerX: number;
  pointerY: number;
  pulse: number;
  targetHover: number;
  targetX: number;
  targetY: number;
};

const MARK_PATH_DATA =
  'M 27 27 L 77 27 L 72.5 39.5 L 44 39.5 L 41.2 48.2 L 66.5 48.2 L 62.2 60.2 L 37.3 60.2 L 31.6 77 L 17.8 77 L 31.5 35.2 Q 33.7 28.2 40.5 27 Z';
const LOGO_CORNER_RADIUS = 29;

const OPTICAL_DUST = [
  [17, 23, 0.7],
  [76, 18, 0.55],
  [84, 38, 0.42],
  [21, 72, 0.45],
  [73, 78, 0.62],
  [15, 48, 0.34],
  [88, 65, 0.38],
  [58, 13, 0.34],
] as const;

let markPath: Path2D | undefined;

const getMarkPath = () => {
  markPath ??= new Path2D(MARK_PATH_DATA);
  return markPath;
};

const roundedSquare = (
  context: CanvasRenderingContext2D,
  inset: number,
  radius: number,
) => {
  const size = 100 - inset * 2;
  context.beginPath();
  context.roundRect(inset, inset, size, size, radius);
};

const drawLensRim = (
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
  rotation: number,
  start: number,
  end: number,
  color: string,
  lineWidth: number,
) => {
  context.beginPath();
  context.ellipse(centerX, centerY, radiusX, radiusY, rotation, start, end);
  context.strokeStyle = color;
  context.lineWidth = lineWidth;
  context.stroke();
};

const drawOpticalLogo = (
  context: CanvasRenderingContext2D,
  time: number,
  motion: LogoMotion,
  reducedMotion: boolean,
) => {
  context.clearRect(0, 0, 100, 100);

  const autoMotionWeight = reducedMotion ? 0 : 1;
  const autoX = Math.sin(time * 0.00076) * 0.48 * autoMotionWeight;
  const autoY = Math.cos(time * 0.00061) * 0.38 * autoMotionWeight;
  const tiltX = motion.pointerX * (0.78 + motion.hover * 0.28) + autoX;
  const tiltY = motion.pointerY * (0.78 + motion.hover * 0.28) + autoY;
  const centerX = 50 + tiltX * 4.15;
  const centerY = 50 + tiltY * 3.65;
  const shimmer = reducedMotion ? 0.5 : (Math.sin(time * 0.0014) + 1) / 2;

  context.save();
  roundedSquare(context, 0.75, LOGO_CORNER_RADIUS);
  context.clip();
  context.lineCap = 'round';
  context.lineJoin = 'round';

  const shell = context.createLinearGradient(8, 4, 92, 96);
  shell.addColorStop(0, '#202329');
  shell.addColorStop(0.38, '#090a0d');
  shell.addColorStop(1, '#020305');
  context.fillStyle = shell;
  context.fillRect(0, 0, 100, 100);

  const ambient = context.createRadialGradient(
    25 + tiltX * 12,
    18 + tiltY * 10,
    1,
    48,
    48,
    74,
  );
  ambient.addColorStop(0, `rgba(242, 252, 255, ${0.2 + motion.hover * 0.08})`);
  ambient.addColorStop(0.3, 'rgba(79, 226, 255, 0.055)');
  ambient.addColorStop(0.62, 'rgba(116, 81, 255, 0.035)');
  ambient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  context.fillStyle = ambient;
  context.fillRect(0, 0, 100, 100);

  const lowerGlow = context.createRadialGradient(78, 83, 1, 72, 76, 45);
  lowerGlow.addColorStop(0, 'rgba(255, 57, 141, 0.09)');
  lowerGlow.addColorStop(0.5, 'rgba(75, 89, 255, 0.035)');
  lowerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  context.fillStyle = lowerGlow;
  context.fillRect(0, 0, 100, 100);

  context.globalCompositeOperation = 'screen';
  for (const [x, y, opacity] of OPTICAL_DUST) {
    context.beginPath();
    context.arc(
      x - tiltX * 1.2,
      y - tiltY * 1.2,
      0.45 + opacity * 0.32,
      0,
      Math.PI * 2,
    );
    context.fillStyle = `rgba(255, 255, 255, ${opacity * (0.15 + shimmer * 0.1)})`;
    context.fill();
  }
  context.globalCompositeOperation = 'source-over';

  context.save();
  context.translate(centerX, centerY + 5.5);
  context.rotate(tiltX * 0.055);
  context.scale(1 - Math.abs(tiltX) * 0.025, 0.34);
  const shadow = context.createRadialGradient(0, 0, 2, 0, 0, 42);
  shadow.addColorStop(0, 'rgba(0, 0, 0, 0.68)');
  shadow.addColorStop(0.52, 'rgba(0, 0, 0, 0.3)');
  shadow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  context.fillStyle = shadow;
  context.beginPath();
  context.arc(0, 0, 42, 0, Math.PI * 2);
  context.fill();
  context.restore();

  const lensRadiusX = 33.2 - Math.abs(tiltX) * 1.7;
  const lensRadiusY = 33.2 - Math.abs(tiltY) * 1.3;
  context.save();
  context.translate(centerX, centerY);
  context.rotate(tiltX * 0.065);
  context.beginPath();
  context.ellipse(0, 0, lensRadiusX, lensRadiusY, 0, 0, Math.PI * 2);
  context.shadowBlur = 21 + motion.hover * 8;
  context.shadowColor = `rgba(76, 222, 255, ${0.12 + motion.hover * 0.12})`;
  const lens = context.createRadialGradient(
    -14 + tiltX * 7,
    -17 + tiltY * 6,
    1,
    0,
    0,
    38,
  );
  lens.addColorStop(0, 'rgba(255, 255, 255, 0.32)');
  lens.addColorStop(0.19, 'rgba(175, 230, 240, 0.105)');
  lens.addColorStop(0.5, 'rgba(28, 34, 42, 0.14)');
  lens.addColorStop(0.79, 'rgba(4, 6, 9, 0.52)');
  lens.addColorStop(1, 'rgba(0, 0, 0, 0.78)');
  context.fillStyle = lens;
  context.fill();
  context.restore();

  context.save();
  context.globalCompositeOperation = 'screen';
  drawLensRim(
    context,
    centerX,
    centerY,
    lensRadiusX + 0.7,
    lensRadiusY + 0.7,
    tiltX * 0.055,
    Math.PI * 0.93,
    Math.PI * 1.74,
    `rgba(92, 235, 255, ${0.48 + motion.hover * 0.16})`,
    1.45,
  );
  drawLensRim(
    context,
    centerX,
    centerY,
    lensRadiusX + 0.9,
    lensRadiusY + 0.9,
    tiltX * 0.055,
    -0.1,
    Math.PI * 0.73,
    `rgba(255, 77, 174, ${0.42 + motion.hover * 0.17})`,
    1.35,
  );
  drawLensRim(
    context,
    centerX,
    centerY,
    lensRadiusX - 3.4,
    lensRadiusY - 3.4,
    tiltX * 0.055,
    Math.PI * 1.12,
    Math.PI * 1.68,
    'rgba(255, 255, 255, 0.16)',
    0.55,
  );
  context.restore();

  const mark = getMarkPath();
  context.save();
  context.translate(tiltX * 4.8, tiltY * 4.15);
  context.translate(50, 50);
  context.rotate(tiltX * 0.06 - tiltY * 0.022);
  context.translate(-50, -50);

  context.save();
  context.translate(-tiltX * 1.8 + 1.9, -tiltY * 1.5 + 3.1);
  context.fillStyle = 'rgba(0, 0, 0, 0.72)';
  context.shadowBlur = 9;
  context.shadowColor = 'rgba(0, 0, 0, 0.68)';
  context.fill(mark);
  context.restore();

  context.save();
  context.globalCompositeOperation = 'screen';
  context.translate(-1.3 - tiltX * 0.75, 0.2 - tiltY * 0.35);
  context.fillStyle = `rgba(54, 231, 255, ${0.36 + motion.hover * 0.19})`;
  context.fill(mark);
  context.restore();

  context.save();
  context.globalCompositeOperation = 'screen';
  context.translate(1.35 + tiltX * 0.75, -0.1 + tiltY * 0.35);
  context.fillStyle = `rgba(255, 62, 162, ${0.31 + motion.hover * 0.17})`;
  context.fill(mark);
  context.restore();

  const markGradient = context.createLinearGradient(
    25 + tiltX * 8,
    24 + tiltY * 8,
    69,
    78,
  );
  markGradient.addColorStop(0, '#ffffff');
  markGradient.addColorStop(0.35, '#eaf8fb');
  markGradient.addColorStop(0.7, '#a9b8c1');
  markGradient.addColorStop(1, '#f8fbff');
  context.fillStyle = markGradient;
  context.shadowBlur = 4 + motion.hover * 2;
  context.shadowColor = 'rgba(67, 219, 255, 0.18)';
  context.fill(mark);

  context.save();
  context.clip(mark);
  const markHighlight = context.createLinearGradient(18, 23, 68, 62);
  markHighlight.addColorStop(0, 'rgba(255, 255, 255, 0.78)');
  markHighlight.addColorStop(0.28, 'rgba(255, 255, 255, 0)');
  markHighlight.addColorStop(0.66, 'rgba(255, 255, 255, 0.16)');
  markHighlight.addColorStop(1, 'rgba(255, 255, 255, 0)');
  context.fillStyle = markHighlight;
  context.fillRect(14, 20, 68, 61);
  context.restore();
  context.restore();

  context.save();
  context.globalCompositeOperation = 'screen';
  context.beginPath();
  context.ellipse(
    centerX - 9 + tiltX * 3,
    centerY - 13 + tiltY * 3,
    14,
    6.2,
    -0.62 + tiltX * 0.08,
    Math.PI * 1.06,
    Math.PI * 1.82,
  );
  context.strokeStyle = `rgba(255, 255, 255, ${0.17 + motion.hover * 0.12})`;
  context.lineWidth = 0.9;
  context.stroke();
  context.restore();

  if (motion.pulse > 0.01) {
    const pulseRadius = 34 + (1 - motion.pulse) * 22;
    context.save();
    context.globalCompositeOperation = 'screen';
    context.beginPath();
    context.arc(centerX, centerY, pulseRadius, 0, Math.PI * 2);
    context.strokeStyle = `rgba(172, 242, 255, ${motion.pulse * 0.5})`;
    context.lineWidth = 0.8 + motion.pulse * 1.4;
    context.stroke();
    context.restore();
  }

  const edge = context.createLinearGradient(8, 5, 94, 98);
  edge.addColorStop(0, 'rgba(255, 255, 255, 0.16)');
  edge.addColorStop(0.22, 'rgba(255, 255, 255, 0.055)');
  edge.addColorStop(0.7, 'rgba(255, 255, 255, 0.025)');
  edge.addColorStop(1, 'rgba(255, 255, 255, 0.1)');
  roundedSquare(context, 1.2, LOGO_CORNER_RADIUS - 0.45);
  context.strokeStyle = edge;
  context.lineWidth = 0.7;
  context.stroke();

  context.restore();
};

export function OpticalLogo({
  className,
  interactive = true,
}: OpticalLogoProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const redrawRef = useRef<() => void>(() => undefined);
  const motionRef = useRef<LogoMotion>({
    hover: 0,
    pointerX: 0,
    pointerY: 0,
    pulse: 0,
    targetHover: 0,
    targetX: 0,
    targetY: 0,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    const motionPreference = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    );
    let reducedMotion = motionPreference.matches;
    let animationFrame = 0;
    let visible = true;
    let stopped = false;

    const paint = (time: number) => {
      const motion = motionRef.current;
      const response = reducedMotion ? 1 : 0.11;
      motion.pointerX += (motion.targetX - motion.pointerX) * response;
      motion.pointerY += (motion.targetY - motion.pointerY) * response;
      motion.hover += (motion.targetHover - motion.hover) * response;
      motion.pulse = Math.max(0, motion.pulse - (reducedMotion ? 1 : 0.026));

      context.setTransform(canvas.width / 100, 0, 0, canvas.height / 100, 0, 0);
      drawOpticalLogo(context, time, motion, reducedMotion);
    };

    redrawRef.current = () => paint(performance.now());

    const tick = (time: number) => {
      if (stopped || !visible || document.hidden) {
        return;
      }
      paint(time);
      if (!reducedMotion) {
        animationFrame = window.requestAnimationFrame(tick);
      }
    };

    const start = () => {
      window.cancelAnimationFrame(animationFrame);
      if (visible && !document.hidden) {
        animationFrame = window.requestAnimationFrame(tick);
      }
    };

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const displaySize = Math.max(1, Math.min(bounds.width, bounds.height));
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2.5);
      const nextSize = Math.max(1, Math.round(displaySize * pixelRatio));
      if (canvas.width !== nextSize || canvas.height !== nextSize) {
        canvas.width = nextSize;
        canvas.height = nextSize;
      }
      paint(performance.now());
    };

    const handleMotionPreference = () => {
      reducedMotion = motionPreference.matches;
      motionRef.current.targetX = 0;
      motionRef.current.targetY = 0;
      motionRef.current.targetHover = 0;
      paint(performance.now());
      start();
    };

    const handleVisibility = () => {
      if (!document.hidden) {
        start();
      }
    };

    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(resize);
    const visibilityObserver =
      typeof IntersectionObserver === 'undefined'
        ? undefined
        : new IntersectionObserver(([entry]) => {
            visible = entry?.isIntersecting ?? true;
            if (visible) {
              start();
            } else {
              window.cancelAnimationFrame(animationFrame);
            }
          });

    resizeObserver?.observe(canvas);
    visibilityObserver?.observe(canvas);
    motionPreference.addEventListener('change', handleMotionPreference);
    document.addEventListener('visibilitychange', handleVisibility);
    resize();
    start();

    return () => {
      stopped = true;
      redrawRef.current = () => undefined;
      window.cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      visibilityObserver?.disconnect();
      motionPreference.removeEventListener('change', handleMotionPreference);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const updatePointer = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!interactive) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    motionRef.current.targetX = Math.max(
      -1,
      Math.min(1, ((event.clientX - bounds.left) / bounds.width - 0.5) * 2),
    );
    motionRef.current.targetY = Math.max(
      -1,
      Math.min(1, ((event.clientY - bounds.top) / bounds.height - 0.5) * 2),
    );
    motionRef.current.targetHover = 1;
    redrawRef.current();
  };

  const releasePointer = () => {
    motionRef.current.targetX = 0;
    motionRef.current.targetY = 0;
    motionRef.current.targetHover = 0;
    redrawRef.current();
  };

  const pulse = () => {
    if (interactive) {
      motionRef.current.pulse = 1;
      motionRef.current.targetHover = 1;
      redrawRef.current();
    }
  };

  return (
    <canvas
      aria-label="Film Fusion 交互式光学标志"
      className={cn(
        'block aspect-square shrink-0 select-none rounded-[29%]',
        interactive && 'touch-manipulation',
        className,
      )}
      data-optical-logo=""
      height={100}
      onPointerCancel={releasePointer}
      onPointerDown={pulse}
      onPointerEnter={updatePointer}
      onPointerLeave={releasePointer}
      onPointerMove={updatePointer}
      onPointerUp={updatePointer}
      ref={canvasRef}
      role="img"
      width={100}
    />
  );
}
