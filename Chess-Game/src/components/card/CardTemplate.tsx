import React, { useId, useMemo } from "react";

/* ------------------------------------------------------------------ */
/*  THEME                                                              */
/* ------------------------------------------------------------------ */

export interface CardTheme {
  background: string; // nền ngoài cùng (viền tối)
  inset: string; // nền tối nằm giữa khung và ô nội dung
  outline: string; // nét viền đen/đậm quanh các chi tiết
  frameDark: string;
  frame: string;
  frameLight: string;
  highlight: string; // đường bóng loáng trên khung
  trim: string; // viền kim loại quanh gem & bảng tên
  gem: string;
  gemLight: string;
  panelEdge: string; // mép ô nội dung
  panelCenter: string; // giữa ô nội dung
  nameplateText: string;
}

/** Tạo cả bộ màu từ 1 màu gốc (hex). Truyền saturation để ép về xám (silver). */
export function createTheme(baseHex: string, opts?: { saturation?: number }): CardTheme {
  const { h, s: s0 } = hexToHsl(baseHex);
  const s = opts?.saturation ?? s0;
  const c = (sat: number, l: number) => `hsl(${h} ${Math.round(sat)}% ${l}%)`;
  return {
    background: c(s * 0.6, 8),
    inset: c(s * 0.7, 16),
    outline: c(s * 0.7, 6),
    frameDark: c(s, 28),
    frame: c(s, 45),
    frameLight: c(s, 65),
    highlight: c(s, 88),
    trim: c(Math.min(s, 25), 80),
    gem: c(s, 52),
    gemLight: c(s, 82),
    panelEdge: c(s * 0.8, 93),
    panelCenter: c(s * 0.6, 98),
    nameplateText: c(s * 0.3, 96),
  };
}

export const CARD_PRESETS = {
  purple: createTheme("#8e5bd0"),
  blue: createTheme("#2f7fd0"),
  silver: createTheme("#9a9a9a", { saturation: 0 }),
  gold: createTheme("#d4a017"),
  red: createTheme("#cf3a3a"),
  green: createTheme("#2fa86b"),
} satisfies Record<string, CardTheme>;

export type CardPreset = keyof typeof CARD_PRESETS;

function hexToHsl(hex: string) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((x) => x + x).join("");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let hue = 0;
  let sat = 0;
  if (d !== 0) {
    sat = d / (1 - Math.abs(2 * l - 1));
    if (max === r) hue = ((g - b) / d) % 6;
    else if (max === g) hue = (b - r) / d + 2;
    else hue = (r - g) / d + 4;
    hue = Math.round(hue * 60);
    if (hue < 0) hue += 360;
  }
  return { h: hue, s: sat * 100, l: l * 100 };
}

/* ------------------------------------------------------------------ */
/*  COMPONENT                                                          */
/* ------------------------------------------------------------------ */

export interface CardTemplateProps {
  /**
   * - tên preset: "purple" | "blue" | "silver" | ...
   * - mã hex: "#ff6600"  (tự sinh cả bảng màu)
   * - object CardTheme (đầy đủ hoặc 1 phần, ghi đè lên preset purple)
   */
  theme?: CardPreset | string | Partial<CardTheme>;
  /** Nội dung đặt ở giữa thẻ: ảnh, icon, Lottie, SVG animation, text... */
  children?: React.ReactNode;
  /** Nội dung trong bảng tên phía dưới (thường là tên thẻ). */
  footer?: React.ReactNode;
  /** Bật hiệu ứng phát sáng cho gem + ánh kim trên khung. */
  animated?: boolean;
  /** Chiều rộng thẻ. Chiều cao tự tính theo tỉ lệ cố định 784:1371 nên hình không bao giờ méo. */
  width?: number | string;
  className?: string;
  style?: React.CSSProperties;
  contentClassName?: string;
  contentStyle?: React.CSSProperties;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
}

const W = 784;
const H = 1371;

function resolveTheme(t: CardTemplateProps["theme"]): CardTheme {
  if (!t) return CARD_PRESETS.purple;
  if (typeof t === "string") {
    if (t in CARD_PRESETS) return CARD_PRESETS[t as CardPreset];
    return createTheme(t);
  }
  return { ...CARD_PRESETS.purple, ...t };
}

export const CardTemplate: React.FC<CardTemplateProps> = ({
  theme,
  children,
  footer,
  animated = false,
  width = "100%",
  className,
  style,
  contentClassName,
  contentStyle,
  onClick,
}) => {
  const rawId = useId();
  const uid = "ct" + rawId.replace(/[^a-zA-Z0-9]/g, "");
  const t = useMemo(() => resolveTheme(theme), [theme]);

  const id = (name: string) => `${uid}-${name}`;
  const url = (name: string) => `url(#${id(name)})`;

  // Đường viền ô nội dung (cửa sổ vòm phía trên)
  const panelPath =
    "M 58 255 A 150 150 0 0 1 208 105 L 576 105 A 150 150 0 0 1 726 255 " +
    "L 726 1160 A 60 60 0 0 1 666 1220 L 118 1220 A 60 60 0 0 1 58 1160 Z";

  // Dải ruy-băng: vẽ 3 lớp (viền đậm -> thân -> vệt sáng)
  const Ribbon = ({ d, w = 10 }: { d: string; w?: number }) => (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} stroke={t.outline} strokeWidth={w + 7} />
      <path d={d} stroke={url("metal")} strokeWidth={w} />
      <path d={d} stroke={t.highlight} strokeWidth={2} opacity={0.65} />
    </g>
  );

  const Spiral = ({ cx, cy }: { cx: number; cy: number }) => (
    <g>
      <circle cx={cx} cy={cy} r={58} fill={url("metal")} stroke={t.outline} strokeWidth={5} />
      <circle cx={cx} cy={cy} r={46} fill={t.frameDark} stroke={t.outline} strokeWidth={3} />
      <path
        d={`M ${cx + 4} ${cy} A 4 4 0 1 0 ${cx} ${cy + 4} A 12 12 0 1 0 ${cx - 12} ${cy - 8} A 24 24 0 1 0 ${cx + 12} ${cy + 20} A 36 36 0 0 0 ${cx - 6} ${cy - 34}`}
        fill="none"
        stroke={t.frameLight}
        strokeWidth={7}
        strokeLinecap="round"
      />
      <path
        d={`M ${cx - 30} ${cy - 30} A 44 44 0 0 1 ${cx + 20} ${cy - 40}`}
        fill="none"
        stroke={t.highlight}
        strokeWidth={3}
        strokeLinecap="round"
        opacity={0.8}
      />
    </g>
  );

  const Gem = ({ cx, cy, r }: { cx: number; cy: number; r: number }) => {
    const k = r / 38;
    const pts = [
      [0, -38], [10, -10], [38, 0], [10, 10],
      [0, 38], [-10, 10], [-38, 0], [-10, -10],
    ]
      .map(([x, y]) => `${cx + x * k},${cy + y * k}`)
      .join(" ");
    return (
      <g className={animated ? "ct-gem" : undefined}>
        <polygon points={pts} fill={url("gem")} stroke={t.trim} strokeWidth={2.5} strokeLinejoin="round" />
        <polygon
          points={`${cx},${cy - 38 * k} ${cx + 10 * k},${cy - 10 * k} ${cx},${cy} ${cx - 10 * k},${cy - 10 * k}`}
          fill={t.gemLight}
          opacity={0.55}
        />
      </g>
    );
  };

  return (
    <div
      className={className}
      onClick={onClick}
      style={{
        position: "relative",
        width,
        aspectRatio: `${W} / ${H}`, // giữ tỉ lệ -> không méo
        containerType: "inline-size",
        userSelect: "none",
        ...style,
      }}
    >
      {animated && (
        <style>{`
          @keyframes ct-pulse { 0%,100% { transform: scale(1); filter: brightness(1); } 50% { transform: scale(1.12); filter: brightness(1.4) drop-shadow(0 0 8px ${t.gemLight}); } }
          @keyframes ct-shine { 0% { transform: translateX(-900px) skewX(-20deg); } 60%,100% { transform: translateX(1500px) skewX(-20deg); } }
          .ct-gem { transform-box: fill-box; transform-origin: center; animation: ct-pulse 2.8s ease-in-out infinite; }
          .ct-shine { animation: ct-shine 4.5s ease-in-out infinite; }
          @media (prefers-reduced-motion: reduce) { .ct-gem, .ct-shine { animation: none; } }
        `}</style>
      )}

      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        style={{ position: "absolute", inset: 0, display: "block" }}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={id("metal")} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={W} y2={H}>
            <stop offset="0" stopColor={t.frameLight} />
            <stop offset="0.5" stopColor={t.frame} />
            <stop offset="1" stopColor={t.frameDark} />
          </linearGradient>
          <linearGradient id={id("gem")} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={W} y2={H}>
            <stop offset="0" stopColor={t.gemLight} />
            <stop offset="1" stopColor={t.gem} />
          </linearGradient>
          <radialGradient id={id("panel")} gradientUnits="userSpaceOnUse" cx="392" cy="665" r="620">
            <stop offset="0" stopColor={t.panelCenter} />
            <stop offset="1" stopColor={t.panelEdge} />
          </radialGradient>
          <linearGradient id={id("plate")} gradientUnits="userSpaceOnUse" x1="165" y1="1232" x2="165" y2="1310">
            <stop offset="0" stopColor={t.frameLight} />
            <stop offset="0.5" stopColor={t.frame} />
            <stop offset="1" stopColor={t.frameDark} />
          </linearGradient>
          <clipPath id={id("clip")}>
            <rect x="0" y="0" width={W} height={H} />
          </clipPath>

          {/* Phụ kiện góc (góc trên-trái) – được mirror ra 4 góc */}
          <g id={id("corner")}>
            <Spiral cx={100} cy={100} />
            <Ribbon d="M 52 360 C 40 320 60 290 90 285 C 118 280 128 250 108 238 C 96 232 82 240 88 252" w={9} />
            <Ribbon d="M 60 330 C 52 345 66 362 82 352" w={6} />
          </g>

          {/* Phụ kiện cạnh bên (trái) */}
          <g id={id("side")}>
            <Ribbon d="M 42 575 C 72 580 80 610 58 636" w={8} />
            <Ribbon d="M 42 592 C 30 605 38 625 52 620" w={5} />
            <polygon
              points="10,675 58,640 106,675 58,710"
              fill={url("metal")}
              stroke={t.outline}
              strokeWidth={5}
              strokeLinejoin="round"
            />
            <polygon points="30,675 58,655 86,675 58,695" fill={t.frameDark} stroke={t.outline} strokeWidth={2} />
            <polygon points="46,675 58,664 70,675 58,686" fill={url("gem")} stroke={t.trim} strokeWidth={1.5} />
          </g>
        </defs>

        <g clipPath={url("clip")}>
          {/* nền ngoài */}
          <rect width={W} height={H} fill={t.background} />

          {/* thân khung */}
          <rect x="25" y="45" width="734" height="1280" rx="14" fill={t.inset} stroke={t.outline} strokeWidth="6" />
          <rect x="36" y="56" width="712" height="1258" rx="8" fill="none" stroke={url("metal")} strokeWidth="6" />
          <rect x="36" y="56" width="712" height="1258" rx="8" fill="none" stroke={t.highlight} strokeWidth="1.5" opacity="0.6" />

          {/* ô nội dung */}
          <path d={panelPath} fill={t.outline} stroke={t.outline} strokeWidth="22" strokeLinejoin="round" />
          <path d={panelPath} fill="none" stroke={url("metal")} strokeWidth="14" strokeLinejoin="round" />
          <path d={panelPath} fill={url("panel")} stroke={t.outline} strokeWidth="3" />
          <path d={panelPath} fill="none" stroke={t.highlight} strokeWidth="2" opacity="0.7" transform="translate(0 -6)" />

          {/* ruy-băng vòm phía trên nối huy hiệu với góc */}
          <Ribbon d="M 310 72 C 240 62 150 66 104 100" />
          <g transform={`translate(${W} 0) scale(-1 1)`}>
            <Ribbon d="M 310 72 C 240 62 150 66 104 100" />
          </g>
          {/* ruy-băng dưới nối góc với bảng tên */}
          <Ribbon d="M 150 1275 C 190 1218 310 1212 372 1228" />
          <g transform={`translate(${W} 0) scale(-1 1)`}>
            <Ribbon d="M 150 1275 C 190 1218 310 1212 372 1228" />
          </g>

          {/* 4 góc: xoắn ốc + hoa văn */}
          <use href={`#${id("corner")}`} />
          <use href={`#${id("corner")}`} transform={`translate(${W} 0) scale(-1 1)`} />
          <use href={`#${id("corner")}`} transform={`translate(0 ${H}) scale(1 -1)`} />
          <use href={`#${id("corner")}`} transform={`translate(${W} ${H}) scale(-1 -1)`} />

          {/* 2 cạnh bên */}
          <use href={`#${id("side")}`} />
          <use href={`#${id("side")}`} transform={`translate(0 1350) scale(1 -1)`} />
          <use href={`#${id("side")}`} transform={`translate(${W} 0) scale(-1 1)`} />
          <use href={`#${id("side")}`} transform={`translate(${W} 1350) scale(-1 -1)`} />

          {/* huy hiệu trên cùng */}
          <g>
            <Ribbon d="M 345 98 C 305 72 278 92 286 122 C 292 142 318 140 322 122" w={8} />
            <g transform={`translate(${W} 0) scale(-1 1)`}>
              <Ribbon d="M 345 98 C 305 72 278 92 286 122 C 292 142 318 140 322 122" w={8} />
            </g>
            <polygon points="362,135 392,214 422,135" fill={url("metal")} stroke={t.outline} strokeWidth="5" strokeLinejoin="round" />
            <polygon points="384,160 392,190 400,160" fill={t.frameDark} />
            <circle cx="392" cy="100" r="58" fill={url("metal")} stroke={t.outline} strokeWidth="5" />
            <circle cx="392" cy="100" r="48" fill={t.frameDark} stroke={t.trim} strokeWidth="4" />
            <Gem cx={392} cy={100} r={36} />
          </g>

          {/* điểm nhấn dưới + bảng tên */}
          <polygon points="392,1178 412,1214 392,1252 372,1214" fill={url("metal")} stroke={t.outline} strokeWidth="5" strokeLinejoin="round" />
          <polygon points="392,1196 402,1214 392,1234 382,1214" fill={url("gem")} stroke={t.trim} strokeWidth="1.5" />
          <polygon points="392,1300 412,1325 392,1352 372,1325" fill={url("metal")} stroke={t.outline} strokeWidth="5" strokeLinejoin="round" />

          <path
            d="M 185 1232 L 600 1232 Q 620 1232 620 1252 L 620 1290 Q 620 1310 600 1310 L 185 1310 Q 165 1310 165 1290 L 165 1252 Q 165 1232 185 1232 Z"
            fill={url("plate")}
            stroke={t.outline}
            strokeWidth="14"
            strokeLinejoin="round"
          />
          <path
            d="M 185 1232 L 600 1232 Q 620 1232 620 1252 L 620 1290 Q 620 1310 600 1310 L 185 1310 Q 165 1310 165 1290 L 165 1252 Q 165 1232 185 1232 Z"
            fill={url("plate")}
            stroke={t.trim}
            strokeWidth="4"
            strokeLinejoin="round"
          />

          {/* vệt ánh kim chạy qua khung */}
          {animated && (
            <g style={{ mixBlendMode: "screen" }} pointerEvents="none">
              <rect className="ct-shine" x="0" y="0" width="90" height={H} fill={t.highlight} opacity="0.22" />
            </g>
          )}
        </g>
      </svg>

      {/* ---------- KHU VỰC NỘI DUNG (khớp đúng ô vòm) ---------- */}
      <div
        className={contentClassName}
        style={{
          position: "absolute",
          left: `${(58 / W) * 100}%`,
          top: `${(105 / H) * 100}%`,
          width: `${(668 / W) * 100}%`,
          height: `${(1115 / H) * 100}%`,
          borderRadius: "22.5% 22.5% 9% 9% / 13.5% 13.5% 5.4% 5.4%",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxSizing: "border-box",
          padding: "4cqw",
          ...contentStyle,
        }}
      >
        {children}
      </div>

      {/* ---------- BẢNG TÊN ---------- */}
      {footer !== undefined && (
        <div
          style={{
            position: "absolute",
            left: `${(175 / W) * 100}%`,
            top: `${(1236 / H) * 100}%`,
            width: `${(435 / W) * 100}%`,
            height: `${(70 / H) * 100}%`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: t.nameplateText,
            fontWeight: 700,
            fontSize: "4.6cqw",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            textShadow: `0 1px 2px ${t.outline}`,
            whiteSpace: "nowrap",
            overflow: "hidden",
          }}
        >
          {footer}
        </div>
      )}
    </div>
  );
};

export default CardTemplate;

/* ------------------------------------------------------------------ */
/*  VÍ DỤ SỬ DỤNG                                                      */
/* ------------------------------------------------------------------ */
/*
import CardTemplate from "./cardTemplate";

function SpinningStar() {
  return (
    <svg viewBox="0 0 100 100" style={{ width: "50%", animation: "spin 6s linear infinite" }}>
      <polygon points="50,5 61,38 95,38 67,58 78,92 50,71 22,92 33,58 5,38 39,38" fill="#8e5bd0" />
    </svg>
  );
}

export default function Demo() {
  return (
    <div style={{ display: "flex", gap: 24 }}>
      <CardTemplate theme="purple" footer="Arcane Mage" animated width={260}>
        <SpinningStar />
      </CardTemplate>

      <CardTemplate theme="silver" footer="Steel Knight" width={260}>
        <img src="/knight.png" alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </CardTemplate>

      <CardTemplate theme="#ff7a00" footer="Fire Drake" animated width={260}>
        <h2>Nội dung tuỳ ý</h2>
      </CardTemplate>

      // Ghi đè từng màu riêng lẻ:
      <CardTemplate theme={{ ...CARD_PRESETS.blue, gem: "#ff3366", gemLight: "#ffb3c6" }} width={260} />
    </div>
  );
}
*/