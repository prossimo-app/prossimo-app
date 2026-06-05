"use client";

import { useCallback, useEffect, useRef } from "react";

// ── SVG Shape ────────────────────────────────────────────
const SVG_PATH = `M162 40L126 5H198L162 40Z M86 5H238 M162 70V170 M232 40C254.091 40 272 57.9086 272 80V260C272 282.091 254.091 300 232 300H92C69.9086 300 52 282.091 52 260V80C52 57.9086 69.9086 40 92 40H232ZM102 204C93.1634 204 86 211.163 86 220C86 228.837 93.1634 236 102 236C110.837 236 118 228.837 118 220C118 211.163 110.837 204 102 204ZM222 204C213.163 204 206 211.163 206 220C206 228.837 213.163 236 222 236C230.837 236 238 228.837 238 220C238 211.163 230.837 204 222 204ZM82 70C76.6957 70 71.6082 72.1067 67.8574 75.8574C64.1067 79.6082 62 84.6957 62 90V160C62 162.652 63.0533 165.196 64.9287 167.071C66.8041 168.947 69.3478 170 72 170H252C254.652 170 257.196 168.947 259.071 167.071C260.947 165.196 262 162.652 262 160V90C262 84.6957 259.893 79.6082 256.143 75.8574C252.392 72.1067 247.304 70 242 70H82Z M6 310H318`;
const SVG_WIDTH = 324;
const SVG_HEIGHT = 316;

// ── Config ──────────────────────────────────────────────
interface PrismaticConfig {
  roughness: number;
  specular: number;
  fresnel: number;
  flowSpeed: number;
  distortion: number;
  dispersion: number;
  iridescence: number;
  brushAngle: number;
  tonemap: number;
}

const DEFAULT_CONFIG: PrismaticConfig = {
  roughness: 0.15,
  specular: 2.7,
  fresnel: 0.55,
  flowSpeed: 0.5,
  distortion: 0.6,
  dispersion: 0.1,
  iridescence: 0.8,
  brushAngle: 2.2,
  tonemap: 0.4,
};

// ── SVG Utilities ───────────────────────────────────────

// ── Chrome Shader ──────────────────────────────────────
export default function ChromeShader({
  config = DEFAULT_CONFIG,
  svgScale = 1,
  theme = "dark",
  svgPath = SVG_PATH,
  svgWidth = SVG_WIDTH,
  svgHeight = SVG_HEIGHT,
  colorFn: _colorFn,
}: {
  config?: PrismaticConfig;
  svgScale?: number;
  theme?: "light" | "dark";
  svgPath?: string;
  svgWidth?: number;
  svgHeight?: number;
  colorFn?: ((x: number, y: number, w: number, h: number) => string) | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const configRef = useRef(config);
  const svgScaleRef = useRef(svgScale);
  const mouseRef = useRef({ x: 0, y: 0 });
  const shadeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const envRRef = useRef<Uint8ClampedArray | null>(null);
  const envGRef = useRef<Uint8ClampedArray | null>(null);
  const envBRef = useRef<Uint8ClampedArray | null>(null);
  const maskPixelsRef = useRef<Uint8ClampedArray | null>(null);
  const blurPixelsRef = useRef<Uint8ClampedArray | null>(null);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1, renderScale: 1 });
  const needsRebuildRef = useRef(true);
  const themeRef = useRef(theme);
  const svgPathRef = useRef(svgPath);
  const svgWidthRef = useRef(svgWidth);
  const svgHeightRef = useRef(svgHeight);
  const startTimeRef = useRef<number | null>(null);

  configRef.current = config;
  svgScaleRef.current = svgScale;
  themeRef.current = theme;
  svgPathRef.current = svgPath;
  svgWidthRef.current = svgWidth;
  svgHeightRef.current = svgHeight;

  /* Build separate R, G, B environment maps with chromatic offset */
  const buildEnvMaps = useCallback(() => {
    const size = 1024;
    const r = new Uint8ClampedArray(size);
    const g = new Uint8ClampedArray(size);
    const b = new Uint8ClampedArray(size);

    for (let i = 0; i < size; i++) {
      const t = i / size;

      // Base luminance peaks (bright caustic spots)
      let base = 18;
      base += 255 * Math.exp(-((t - 0.46) ** 2) / 0.002); // primary bright peak
      base += 180 * Math.exp(-((t - 0.22) ** 2) / 0.004); // secondary peak
      base += 200 * Math.exp(-((t - 0.74) ** 2) / 0.005); // tertiary peak
      base += 50 * Math.exp(-((t - 0.35) ** 2) / 0.02);
      base += 45 * Math.exp(-((t - 0.62) ** 2) / 0.015);
      base += 70 * Math.exp(-((t - 0.06) ** 2) / 0.003);
      base += 65 * Math.exp(-((t - 0.92) ** 2) / 0.004);

      // Chromatic dispersion: shift each channel slightly
      const rShift = 0.012;
      const bShift = -0.012;
      const tR = (((t + rShift) % 1) + 1) % 1;
      const tB = (((t + bShift) % 1) + 1) % 1;

      let rVal = 18;
      rVal += 255 * Math.exp(-((tR - 0.46) ** 2) / 0.002);
      rVal += 180 * Math.exp(-((tR - 0.22) ** 2) / 0.004);
      rVal += 200 * Math.exp(-((tR - 0.74) ** 2) / 0.005);
      rVal += 50 * Math.exp(-((tR - 0.35) ** 2) / 0.02);
      rVal += 45 * Math.exp(-((tR - 0.62) ** 2) / 0.015);
      rVal += 70 * Math.exp(-((tR - 0.06) ** 2) / 0.003);
      rVal += 65 * Math.exp(-((tR - 0.92) ** 2) / 0.004);
      // Warm tint to reds
      rVal *= 1.05;

      let bVal = 18;
      bVal += 255 * Math.exp(-((tB - 0.46) ** 2) / 0.002);
      bVal += 180 * Math.exp(-((tB - 0.22) ** 2) / 0.004);
      bVal += 200 * Math.exp(-((tB - 0.74) ** 2) / 0.005);
      bVal += 50 * Math.exp(-((tB - 0.35) ** 2) / 0.02);
      bVal += 45 * Math.exp(-((tB - 0.62) ** 2) / 0.015);
      bVal += 70 * Math.exp(-((tB - 0.06) ** 2) / 0.003);
      bVal += 65 * Math.exp(-((tB - 0.92) ** 2) / 0.004);
      // Cool tint to blues
      bVal *= 1.08;

      r[i] = Math.min(255, rVal | 0);
      g[i] = Math.min(255, base | 0);
      b[i] = Math.min(255, bVal | 0);
    }

    envRRef.current = r;
    envGRef.current = g;
    envBRef.current = b;
  }, []);

  const buildMask = useCallback(() => {
    const w = sizeRef.current.w;
    const h = sizeRef.current.h;
    const renderScale = sizeRef.current.renderScale;
    const sw = Math.round(w * renderScale);
    const sh = Math.round(h * renderScale);
    if (w === 0 || h === 0) return;

    if (!maskCanvasRef.current)
      maskCanvasRef.current = document.createElement("canvas");
    const mc = maskCanvasRef.current;
    mc.width = sw;
    mc.height = sh;

    const { scale, offsetX, offsetY } = getLogoTransform(
      w,
      h,
      svgScaleRef.current,
      svgWidthRef.current,
      svgHeightRef.current,
    );
    const path2d = new Path2D(svgPathRef.current);

    const mctx = mc.getContext("2d")!;
    mctx.fillStyle = "#000";
    mctx.fillRect(0, 0, sw, sh);
    mctx.save();
    mctx.translate(offsetX * renderScale, offsetY * renderScale);
    mctx.scale(scale * renderScale, scale * renderScale);
    mctx.fillStyle = "#fff";
    mctx.fill(path2d);
    mctx.restore();
    maskPixelsRef.current = mctx.getImageData(0, 0, sw, sh).data;

    const bc = document.createElement("canvas");
    bc.width = sw;
    bc.height = sh;
    const bctx = bc.getContext("2d")!;
    bctx.filter = `blur(${Math.round(6 * renderScale)}px)`;
    bctx.drawImage(mc, 0, 0);
    blurPixelsRef.current = bctx.getImageData(0, 0, sw, sh).data;

    needsRebuildRef.current = false;
  }, []);

  const init = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    // Render shading at higher resolution on high-DPR screens for antialiasing
    const renderScale = Math.min(dpr, 1.5);
    sizeRef.current = { w, h, dpr, renderScale };
    needsRebuildRef.current = true;
    startTimeRef.current = null;

    const sw = Math.round(w * renderScale);
    const sh = Math.round(h * renderScale);
    if (!shadeCanvasRef.current)
      shadeCanvasRef.current = document.createElement("canvas");
    shadeCanvasRef.current.width = sw;
    shadeCanvasRef.current.height = sh;

    if (!envRRef.current) buildEnvMaps();
  }, [svgScale, svgPath, svgWidth, svgHeight, buildEnvMaps]);

  useEffect(() => {
    init();
    window.addEventListener("resize", init);
    return () => window.removeEventListener("resize", init);
  }, [init]);

  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    const onTouch = (e: TouchEvent) => {
      if ((e.target as Element)?.closest?.("[data-controls-panel]")) return;
      const touch = e.touches[0];
      if (touch) mouseRef.current = { x: touch.clientX, y: touch.clientY };
    };
    window.addEventListener("mousemove", onMouse);
    window.addEventListener("touchstart", onTouch, { passive: true });
    window.addEventListener("touchmove", onTouch, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMouse);
      window.removeEventListener("touchstart", onTouch);
      window.removeEventListener("touchmove", onTouch);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    // Persistent allocations -- reused every frame
    let outImg: ImageData | null = null;
    let lastSw = 0,
      lastSh = 0;

    // Tonemap LUT -- rebuilt only when tonemap value changes
    const tonemapLUT = new Uint8Array(256);
    let lastTonemap = -1;

    // Cached glow path
    let glowPath: Path2D | null = null;
    let lastGlowSvg = "";

    // Pre-computed brush trig
    let lastBrushAngle = -999;
    let brushCos = 1,
      brushSin = 0;

    const animate = (timestamp: number) => {
      if (startTimeRef.current === null) startTimeRef.current = timestamp;
      const introElapsed = (timestamp - startTimeRef.current) * 0.001;
      const introDuration = 2.0;

      if (needsRebuildRef.current) buildMask();

      const cfg = configRef.current;
      const dpr = window.devicePixelRatio || 1;
      const w = sizeRef.current.w;
      const h = sizeRef.current.h;
      const time = timestamp * 0.001;
      const mouse = mouseRef.current;
      const envR = envRRef.current;
      const envG = envGRef.current;
      const envB = envBRef.current;
      const mask = maskPixelsRef.current;
      const blur = blurPixelsRef.current;
      const shadeCanvas = shadeCanvasRef.current;

      if (
        !envR ||
        !envG ||
        !envB ||
        !mask ||
        !blur ||
        !shadeCanvas ||
        w === 0
      ) {
        rafRef.current = requestAnimationFrame(animate);
        return;
      }

      const renderScale = sizeRef.current.renderScale;
      const sw = Math.round(w * renderScale);
      const sh = Math.round(h * renderScale);

      // Reuse ImageData allocation
      const sctx = shadeCanvas.getContext("2d")!;
      if (!outImg || sw !== lastSw || sh !== lastSh) {
        outImg = sctx.createImageData(sw, sh);
        lastSw = sw;
        lastSh = sh;
      }
      const out = outImg.data;
      const isLight = themeRef.current === "light";
      const bgR = isLight ? 245 : 0;
      const bgG = isLight ? 245 : 0;
      const bgB = isLight ? 245 : 0;
      for (let i = 0, len = out.length; i < len; i += 4) {
        out[i] = bgR;
        out[i + 1] = bgG;
        out[i + 2] = bgB;
        out[i + 3] = 255;
      }

      const stride = sw * 4;
      const envLen = 1024;

      // Rebuild tonemap LUT only when value changes
      if (cfg.tonemap !== lastTonemap) {
        lastTonemap = cfg.tonemap;
        if (cfg.tonemap === 1.0) {
          for (let i = 0; i < 256; i++) tonemapLUT[i] = i;
        } else {
          const invTone = 1 / cfg.tonemap;
          for (let i = 0; i < 256; i++) {
            tonemapLUT[i] = (255 * Math.pow(i / 255, invTone)) | 0;
          }
        }
      }

      // Cache brush angle trig
      if (cfg.brushAngle !== lastBrushAngle) {
        lastBrushAngle = cfg.brushAngle;
        brushCos = Math.cos(cfg.brushAngle);
        brushSin = Math.sin(cfg.brushAngle);
      }

      const mx = mouse.x / w;
      const my = mouse.y / h;

      // Hoist config values
      const cfgRoughness = cfg.roughness;
      const cfgFlowSpeed = cfg.flowSpeed;
      const cfgDistortion = cfg.distortion;
      const cfgFresnel = cfg.fresnel;
      const cfgSpecular = cfg.specular;
      const cfgBrushAngle = cfg.brushAngle;
      const cfgIridescence = cfg.iridescence;
      const cfgDispersion = cfg.dispersion;
      const chromaticSpread = cfgDispersion * 0.06;

      // Pre-compute time-based values
      const t11 = time * cfgFlowSpeed * 1.1;
      const t07 = time * cfgFlowSpeed * 0.7;
      const t04 = time * cfgFlowSpeed * 0.4;
      const t16 = time * cfgFlowSpeed * 1.6;
      const tEnv = time * cfgFlowSpeed * 0.03;
      const tIrid = time * cfgFlowSpeed * 0.15;

      const invSw = 1 / sw;
      const invSh = 1 / sh;

      for (let y = 1; y < sh - 1; y++) {
        const yOff = y * stride;
        const py = y * invSh;

        for (let x = 1; x < sw - 1; x++) {
          const idx = yOff + x * 4;
          if (mask[idx] < 128) continue;

          const left = blur[idx - 4];
          const right = blur[idx + 4];
          const up = blur[idx - stride];
          const down = blur[idx + stride];

          let nx = (right - left) / 510;
          let ny = (down - up) / 510;

          const px = x * invSw;

          const r1 =
            Math.sin(px * 20 * cfgRoughness + t11) *
            Math.cos(py * 16 * cfgRoughness + t07) *
            0.22 *
            cfgDistortion;
          const r2 =
            Math.sin((px + py) * 24 * cfgRoughness - t04) *
            0.14 *
            cfgDistortion;
          const r3 =
            Math.cos(px * 32 * cfgRoughness + py * 12 - t16) *
            0.09 *
            cfgDistortion;

          nx += r1 + r2;
          ny += r3 + r1 * 0.6;

          // Chromatic aberration: sample each channel at different env coord
          const baseCoord = (nx + r2) * 4 + px * 2 + tEnv;

          let envUR = (baseCoord + chromaticSpread) % 1;
          if (envUR < 0) envUR += 1;
          let envUG = baseCoord % 1;
          if (envUG < 0) envUG += 1;
          let envUB = (baseCoord - chromaticSpread) % 1;
          if (envUB < 0) envUB += 1;

          const envIdxR = (envUR * (envLen - 1)) | 0;
          const envIdxG = (envUG * (envLen - 1)) | 0;
          const envIdxB = (envUB * (envLen - 1)) | 0;

          let cr = envR[envIdxR];
          let cg = envG[envIdxG];
          let cb = envB[envIdxB];

          // Secondary reflection
          let envU2 = (envUG + 0.35 + ny * 2.5) % 1;
          if (envU2 < 0) envU2 += 1;
          const envIdx2R = (((envU2 + chromaticSpread) % 1) * (envLen - 1)) | 0;
          const envIdx2G = (envU2 * (envLen - 1)) | 0;
          const envIdx2B =
            (((((envU2 - chromaticSpread) % 1) + 1) % 1) * (envLen - 1)) | 0;

          cr = (cr * 0.6 + envR[envIdx2R] * 0.4) | 0;
          cg = (cg * 0.6 + envG[envIdx2G] * 0.4) | 0;
          cb = (cb * 0.6 + envB[envIdx2B] * 0.4) | 0;

          // Tone curve
          cr = ((cr * (cr + 50)) / 305) | 0;
          cg = ((cg * (cg + 50)) / 305) | 0;
          cb = ((cb * (cb + 50)) / 305) | 0;

          if (isLight) {
            cr = 255 - cr;
            cg = 255 - cg;
            cb = 255 - cb;
            if (cr > 220) cr = 220;
            if (cg > 220) cg = 220;
            if (cb > 218) cb = 218;
          } else {
            if (cr < 25) cr = 25;
            if (cg < 25) cg = 25;
            if (cb < 28) cb = 28;
          }

          // Iridescent color injection
          if (cfgIridescence > 0.01) {
            const angle = Math.atan2(ny + r1, nx + r2) + tIrid;
            const hue = ((angle / Math.PI) * 0.5 + 0.5) % 1;
            const h6 = hue * 6;
            const sector = h6 | 0;
            const frac = h6 - sector;
            let ir = 0,
              ig = 0,
              ib = 0;
            switch (sector % 6) {
              case 0:
                ir = 1;
                ig = frac;
                ib = 0;
                break;
              case 1:
                ir = 1 - frac;
                ig = 1;
                ib = 0;
                break;
              case 2:
                ir = 0;
                ig = 1;
                ib = frac;
                break;
              case 3:
                ir = 0;
                ig = 1 - frac;
                ib = 1;
                break;
              case 4:
                ir = frac;
                ig = 0;
                ib = 1;
                break;
              case 5:
                ir = 1;
                ig = 0;
                ib = 1 - frac;
                break;
            }
            const iFactor = cfgIridescence * 0.35;
            const brightness = (cr + cg + cb) / 765;
            const edgeFade = brightness * 3 < 1 ? brightness * 3 : 1;
            const inject = 120 * iFactor * edgeFade;
            cr = (cr + ir * inject) | 0;
            cg = (cg + ig * inject) | 0;
            cb = (cb + ib * inject) | 0;
          }

          // Fresnel edge glow
          const minEdge =
            left < right
              ? left < up
                ? left < down
                  ? left
                  : down
                : up < down
                  ? up
                  : down
              : right < up
                ? right < down
                  ? right
                  : down
                : up < down
                  ? up
                  : down;
          const edgeness = 1 - minEdge / 255;
          if (edgeness > 0.02) {
            const f = edgeness * edgeness * cfgFresnel;
            cr = (cr + f * 180) | 0;
            cg = (cg + f * 200) | 0;
            cb = (cb + f * 240) | 0;
          }

          // Specular highlight
          const ldx = px - mx;
          const ldy = py - my;
          const ld2 = ldx * ldx + ldy * ldy;
          if (ld2 < 0.15) {
            const sx = ldx + nx * 0.4;
            const sy = ldy + ny * 0.4;
            const sd = Math.sqrt(sx * sx + sy * sy);
            const sp = 1 - sd * 4;
            if (sp > 0) {
              const sp2 = sp * sp;
              const spow = sp2 * sp2 * sp * cfgSpecular;
              cr = (cr + spow * 255) | 0;
              cg = (cg + spow * 245) | 0;
              cb = (cb + spow * 260) | 0;
            }
          }

          // Brush strokes
          if (cfgBrushAngle > 0.01) {
            const bc2 = px * brushCos + py * brushSin;
            const br = Math.sin(bc2 * 400 * cfgRoughness + nx * 20) * 0.5 + 0.5;
            const bfx = br * 0.12 + 0.88;
            cr = (cr * bfx) | 0;
            cg = (cg * bfx) | 0;
            cb = (cb * bfx) | 0;
          }

          // Tonemap via LUT
          out[idx] = tonemapLUT[cr > 255 ? 255 : cr < 0 ? 0 : cr];
          out[idx + 1] = tonemapLUT[cg > 255 ? 255 : cg < 0 ? 0 : cg];
          out[idx + 2] = tonemapLUT[cb > 255 ? 255 : cb < 0 ? 0 : cb];
          out[idx + 3] = 255;
        }
      }

      sctx.putImageData(outImg, 0, 0);

      // Intro: smooth fade-in
      const introFade =
        introElapsed >= introDuration
          ? 1
          : Math.pow(Math.min(introElapsed / introDuration, 1), 2);

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = isLight ? "#f5f5f5" : "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.globalAlpha = introFade;
      ctx.drawImage(
        shadeCanvas,
        0,
        0,
        sw,
        sh,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      ctx.globalAlpha = 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Outer glow with prismatic color
      const {
        scale: lScale,
        offsetX: lOx,
        offsetY: lOy,
      } = getLogoTransform(
        w,
        h,
        svgScaleRef.current,
        svgWidthRef.current,
        svgHeightRef.current,
      );
      const curSvg = svgPathRef.current;
      if (curSvg !== lastGlowSvg) {
        glowPath = new Path2D(curSvg);
        lastGlowSvg = curSvg;
      }
      ctx.save();
      ctx.globalCompositeOperation = isLight ? "multiply" : "screen";
      ctx.filter = `blur(${14 + Math.sin(time * 0.25) * 4}px)`;
      ctx.globalAlpha = 0.08 * cfgFresnel * introFade;
      ctx.translate(lOx, lOy);
      ctx.scale(lScale, lScale);

      const glowHue = (time * 0.1) % 1;
      const glowR = Math.sin(glowHue * Math.PI * 2) * 0.5 + 0.5;
      const glowG = Math.sin((glowHue + 0.33) * Math.PI * 2) * 0.5 + 0.5;
      const glowB = Math.sin((glowHue + 0.66) * Math.PI * 2) * 0.5 + 0.5;

      if (isLight) {
        ctx.fillStyle = `rgb(${(80 + glowR * 60) | 0}, ${(80 + glowG * 60) | 0}, ${(80 + glowB * 60) | 0})`;
      } else {
        ctx.fillStyle = `rgb(${(180 + glowR * 75) | 0}, ${(180 + glowG * 75) | 0}, ${(200 + glowB * 55) | 0})`;
      }
      ctx.fill(glowPath!);
      ctx.restore();

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [buildMask]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 h-full w-full"
      style={{
        background: theme === "light" ? "#f5f5f5" : "#000",
        touchAction: "none",
      }}
    />
  );
}

function getLogoTransform(
  w: number,
  h: number,
  svgScale: number,
  svgWidth: number,
  svgHeight: number,
): { scale: number; offsetX: number; offsetY: number } {
  // Calculate aspect ratios
  const canvasAspect = w / h;
  const svgAspect = svgWidth / svgHeight;

  // Fit SVG to canvas while maintaining aspect ratio
  let scale: number;
  if (canvasAspect > svgAspect) {
    scale = (h / svgHeight) * svgScale;
  } else {
    scale = (w / svgWidth) * svgScale;
  }

  // Center the SVG on the canvas
  const scaledWidth = svgWidth * scale;
  const scaledHeight = svgHeight * scale;
  const offsetX = (w - scaledWidth) / 2;
  const offsetY = (h - scaledHeight) / 2;

  return { scale, offsetX, offsetY };
}
