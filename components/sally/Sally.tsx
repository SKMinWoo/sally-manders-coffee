// Sally: a Barton Springs salamander (Eurycea sosorum) in profile, down in the striped diner mug
// she lives in, the tip of her tail curling out behind her. Ported from design/mockups/names.js,
// geometry unchanged. The groups carry s-* classes (s-in, s-tail, s-body, s-gills, s-eye, s-lid,
// s-arm) so SallyIntro can animate her parts; at rest she needs no script.

export interface SallyPalette {
  ink: string; // the mug
  fill: string; // her skin
  accent: string; // her gills
  paper: string; // the mug's stripe, and anything knocked out
  spot: string; // freckles
  iris: string;
  eye: string;
  line: string; // her mouth and the closed lid
}

// The sign-painter theme's three printings (design/mockups/themes.js, "sign").
export const SIGN: Record<"paper" | "dark" | "pop", SallyPalette> = {
  paper: { ink: "#1A1613", fill: "#EE9E9B", accent: "#C9321F", paper: "#F5EAD0", spot: "#FBE0D9", iris: "#EDB230", eye: "#1A1613", line: "#8A3B36" },
  dark: { ink: "#F5EAD0", fill: "#EE9E9B", accent: "#E5452E", paper: "#1A1613", spot: "#FBE0D9", iris: "#EDB230", eye: "#1A1613", line: "#8A3B36" },
  pop: { ink: "#1A1613", fill: "#F2A9A5", accent: "#C9321F", paper: "#1F9E98", spot: "#FBE0D9", iris: "#EDB230", eye: "#1A1613", line: "#8A3B36" },
};

const HEAD = "M78 124V116C75 97 86 84 104 82C122 79 144 80 158 85.5C169 89 174.5 94.5 174.5 100.5C174.5 106.5 166.5 109.5 154 109.5H104V124Z";
const TAIL = "M53 122V96C53 90 49 86 43.5 86C37.5 86 33.5 90 33.5 95C33.5 98 35 100.2 37.2 100.6C37.6 98.4 38.2 96 39.8 94.6C41 93.6 42.4 93.2 43.6 93.6C44.8 94 45 95.5 45 97V122Z";
const MUG = "M40 114h88v38a22 22 0 0 1-22 22H62a22 22 0 0 1-22-22Z";
const ARM = "M110 106C112.5 109.5 115 113.5 116.5 119";
const TOES = "M116.5 119l-3.5 5M116.5 119l0.5 6M116.5 119l5 3.5";
const FRECKLES = [[112, 89, 1.7], [125, 85, 1.3], [134, 93.5, 1.6], [117, 98.5, 1.3], [161, 99, 1.3]] as const;
const TAIL_FRECKLES = [[49, 105, 1.3], [49, 93.5, 1.1]] as const;
// measured bounds of the full mark, padded for stroke widths; keep in step with the drawing
const BOX = "29.2 60.8 157.9 114.2";
const BIG = "translate(104 113) scale(1.15) translate(-104 -113)";

// one gill: a thin stalk feathered on both sides, pointing along +x before it is turned
function gill(len: number) {
  const f = [0.3, 0.54, 0.78]
    .map((t) => `M${(len * t).toFixed(1)} ${(-2.6 * t).toFixed(1)}l${(len * 0.15).toFixed(1)}-${(len * 0.15).toFixed(1)}M${(len * t + 1.5).toFixed(1)} ${(-2.6 * t).toFixed(1)}l${(len * 0.13).toFixed(1)} ${(len * 0.11).toFixed(1)}`)
    .join("");
  return `M0 0C${len * 0.35} -1 ${len * 0.7} -3 ${len} -1${f}`;
}
const GILLS = [[97, 86, -132, 21], [89, 93, -160, 22], [84, 101, -172, 19]] as const;

/** `title=""` when a name sits beside her (the header lockup): she is then decorative and hidden from screen readers. */
export function Sally({ palette = SIGN.dark, title = "Sally Mander's" }: { palette?: SallyPalette; title?: string }) {
  const p = palette;
  const a11y = title ? { role: "img", "aria-label": title } : { "aria-hidden": true };
  return (
    <svg viewBox={BOX} overflow="visible" {...a11y}>
      {/* the rim: whatever of her is below this line is inside the mug */}
      <clipPath id="s-rim">
        <rect x="0" y="0" width="400" height="113" />
      </clipPath>
      <g className="s-in" clipPath="url(#s-rim)">
        <g className="s-tail">
          <g transform="translate(49 122) scale(1.15) translate(-49 -122)">
            <path fill={p.fill} d={TAIL} />
            {TAIL_FRECKLES.map(([x, y, r]) => <circle key={`${x},${y}`} fill={p.spot} cx={x} cy={y} r={r} />)}
          </g>
        </g>
        <g className="s-body">
          <g transform={BIG}>
            <g className="s-gills">
              {GILLS.map(([x, y, turn, len]) => (
                <path key={turn} transform={`translate(${x} ${y}) rotate(${turn})`} fill="none" stroke={p.accent} strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.1} d={gill(len)} />
              ))}
            </g>
            <path fill={p.fill} d={HEAD} />
            {FRECKLES.map(([x, y, r]) => <circle key={`${x},${y}`} fill={p.spot} cx={x} cy={y} r={r} />)}
            <g className="s-eye">
              <circle fill={p.iris} cx={146} cy={92} r={6.3} />
              <circle fill={p.eye} cx={147.2} cy={92} r={4.4} />
            </g>
            <path className="s-lid" opacity={0} fill="none" stroke={p.line} strokeWidth={2.6} strokeLinecap="round" d="M140 93.5Q146 87 152 93.5" />
            <path fill="none" stroke={p.line} strokeWidth={2.2} strokeLinecap="round" d="M166 104.8C158 105.2 149 104.6 141.5 102.6C138.8 101.9 137.2 100.6 136.8 98.6" />
          </g>
        </g>
      </g>
      <path fill="none" stroke={p.ink} strokeWidth={12} strokeLinecap="round" d="M128 127h7a16.5 16.5 0 0 1 0 33h-7" />
      <path fill={p.ink} d={MUG} />
      <rect fill={p.ink} x={36} y={108} width={96} height={10} rx={5} />
      <rect fill={p.paper} x={40} y={135} width={88} height={6} />
      <g className="s-arm">
        <g transform={BIG}>
          <path fill="none" stroke={p.fill} strokeWidth={6.4} strokeLinecap="round" d={ARM} />
          <path fill="none" stroke={p.fill} strokeWidth={6.4 * 0.45} strokeLinecap="round" d={TOES} />
        </g>
      </g>
    </svg>
  );
}
