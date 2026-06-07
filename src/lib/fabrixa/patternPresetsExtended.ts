// Additional vector pattern presets (shown under "More" in the 2D editor).
import { type PatternPreset } from "./presets";

const wrap = (size: number, body: string, bg: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="100%" height="100%" fill="${bg}"/>${body}</svg>`;

export const PATTERN_PRESETS_MORE: PatternPreset[] = [
  {
    id: "dots-fine",
    label: "Fine Dots",
    svg: (c, bg) =>
      wrap(
        24,
        `<circle cx="6" cy="6" r="2" fill="${c}"/><circle cx="18" cy="18" r="2" fill="${c}"/>`,
        bg,
      ),
  },
  {
    id: "dots-large",
    label: "Large Dots",
    svg: (c, bg) =>
      wrap(
        48,
        `<circle cx="12" cy="12" r="8" fill="${c}"/><circle cx="36" cy="36" r="8" fill="${c}"/>`,
        bg,
      ),
  },
  {
    id: "hstripes",
    label: "H-Stripes",
    svg: (c, bg) =>
      wrap(
        40,
        `<rect y="0" width="40" height="8" fill="${c}"/><rect y="20" width="40" height="8" fill="${c}"/>`,
        bg,
      ),
  },
  {
    id: "vstripes",
    label: "V-Stripes",
    svg: (c, bg) =>
      wrap(
        40,
        `<rect x="0" width="8" height="40" fill="${c}"/><rect x="20" width="8" height="40" fill="${c}"/>`,
        bg,
      ),
  },
  {
    id: "grid",
    label: "Grid",
    svg: (c, bg) =>
      wrap(40, `<path d="M0 20H40M20 0V40" stroke="${c}" stroke-width="1.5" fill="none"/>`, bg),
  },
  {
    id: "grid-bold",
    label: "Bold Grid",
    svg: (c, bg) =>
      wrap(50, `<path d="M0 25H50M25 0V50" stroke="${c}" stroke-width="4" fill="none"/>`, bg),
  },
  {
    id: "zigzag",
    label: "Zigzag",
    svg: (c, bg) =>
      wrap(
        48,
        `<polyline points="0,24 12,12 24,24 36,12 48,24" fill="none" stroke="${c}" stroke-width="4"/>`,
        bg,
      ),
  },
  {
    id: "waves",
    label: "Waves",
    svg: (c, bg) =>
      wrap(
        60,
        `<path d="M0 30 Q15 10 30 30 T60 30" fill="none" stroke="${c}" stroke-width="3"/><path d="M0 45 Q15 25 30 45 T60 45" fill="none" stroke="${c}" stroke-width="3" opacity="0.6"/>`,
        bg,
      ),
  },
  {
    id: "scallop",
    label: "Scallop",
    svg: (c, bg) =>
      wrap(
        48,
        `<path d="M0 24 Q12 0 24 24 T48 24" fill="none" stroke="${c}" stroke-width="3"/>`,
        bg,
      ),
  },
  {
    id: "hex",
    label: "Hexagon",
    svg: (c, bg) =>
      wrap(
        56,
        `<polygon points="28,4 52,16 52,40 28,52 4,40 4,16" fill="none" stroke="${c}" stroke-width="2"/>`,
        bg,
      ),
  },
  {
    id: "honeycomb",
    label: "Honeycomb",
    svg: (c, bg) =>
      wrap(
        60,
        `<polygon points="15,10 25,10 30,20 25,30 15,30 10,20" fill="none" stroke="${c}" stroke-width="2"/><polygon points="35,30 45,30 50,40 45,50 35,50 30,40" fill="none" stroke="${c}" stroke-width="2"/>`,
        bg,
      ),
  },
  {
    id: "triangles",
    label: "Triangles",
    svg: (c, bg) =>
      wrap(
        40,
        `<polygon points="20,5 35,35 5,35" fill="${c}"/><polygon points="20,5 35,35 5,35" fill="${c}" transform="translate(20,0)"/>`,
        bg,
      ),
  },
  {
    id: "stars",
    label: "Stars",
    svg: (c, bg) =>
      wrap(
        50,
        `<polygon points="25,5 30,20 45,20 33,30 38,45 25,36 12,45 17,30 5,20 20,20" fill="${c}" transform="scale(0.5) translate(25,25)"/>`,
        bg,
      ),
  },
  {
    id: "star-tile",
    label: "Star Tile",
    svg: (c, bg) =>
      wrap(
        40,
        `<text x="8" y="28" font-size="20" fill="${c}">✦</text><text x="28" y="28" font-size="20" fill="${c}">✦</text>`,
        bg,
      ),
  },
  {
    id: "leaves",
    label: "Leaves",
    svg: (c, bg) =>
      wrap(
        60,
        `<ellipse cx="20" cy="30" rx="12" ry="6" fill="${c}" transform="rotate(-35 20 30)"/><ellipse cx="40" cy="20" rx="12" ry="6" fill="${c}" transform="rotate(25 40 20)"/>`,
        bg,
      ),
  },
  {
    id: "vine-scroll",
    label: "Vine Scroll",
    svg: (c, bg) =>
      wrap(
        80,
        `<path d="M10 70 Q40 10 70 40" fill="none" stroke="${c}" stroke-width="2.5"/><circle cx="40" cy="35" r="5" fill="${c}"/>`,
        bg,
      ),
  },
  {
    id: "mandala",
    label: "Mandala",
    svg: (c, bg) =>
      wrap(
        80,
        `<circle cx="40" cy="40" r="30" fill="none" stroke="${c}" stroke-width="1.5"/><circle cx="40" cy="40" r="18" fill="none" stroke="${c}" stroke-width="1.5"/><circle cx="40" cy="40" r="6" fill="${c}"/>`,
        bg,
      ),
  },
  {
    id: "block-print",
    label: "Block Print",
    svg: (c, bg) =>
      wrap(
        50,
        `<rect x="5" y="5" width="18" height="18" fill="${c}" opacity="0.9"/><rect x="27" y="27" width="18" height="18" fill="${c}" opacity="0.7"/>`,
        bg,
      ),
  },
  {
    id: "ikat-bold",
    label: "Ikat Bold",
    svg: (c, bg) =>
      wrap(
        60,
        `<rect x="8" y="15" width="44" height="8" fill="${c}"/><rect x="12" y="30" width="36" height="6" fill="${c}" opacity="0.75"/><rect x="8" y="42" width="44" height="8" fill="${c}"/>`,
        bg,
      ),
  },
  {
    id: "basket",
    label: "Basket Weave",
    svg: (c, bg) =>
      wrap(
        40,
        `<rect x="0" y="0" width="20" height="20" fill="${c}"/><rect x="20" y="20" width="20" height="20" fill="${c}"/><rect x="20" y="0" width="20" height="20" fill="none" stroke="${c}" stroke-width="2"/><rect x="0" y="20" width="20" height="20" fill="none" stroke="${c}" stroke-width="2"/>`,
        bg,
      ),
  },
  {
    id: "herringbone",
    label: "Herringbone",
    svg: (c, bg) =>
      wrap(
        40,
        `<path d="M0 20 L10 0 L20 20 L30 0 L40 20" fill="none" stroke="${c}" stroke-width="3"/><path d="M0 40 L10 20 L20 40 L30 20 L40 40" fill="none" stroke="${c}" stroke-width="3"/>`,
        bg,
      ),
  },
  {
    id: "tweed",
    label: "Tweed",
    svg: (c, bg) =>
      wrap(
        30,
        `<rect width="30" height="30" fill="${bg}"/><circle cx="8" cy="8" r="2" fill="${c}"/><circle cx="22" cy="14" r="2" fill="${c}"/><circle cx="12" cy="24" r="2" fill="${c}"/><rect x="18" y="20" width="6" height="2" fill="${c}"/>`,
        bg,
      ),
  },
  {
    id: "plaid",
    label: "Plaid",
    svg: (c, bg) =>
      wrap(
        60,
        `<path d="M0 20H60M0 40H60M20 0V60M40 0V60" stroke="${c}" stroke-width="3" opacity="0.5"/><path d="M0 30H60M30 0V60" stroke="${c}" stroke-width="6" opacity="0.35"/>`,
        bg,
      ),
  },
  {
    id: "tartan",
    label: "Tartan",
    svg: (c, bg) =>
      wrap(
        80,
        `<rect width="80" height="80" fill="${bg}"/><path d="M0 40H80M40 0V80" stroke="${c}" stroke-width="12" opacity="0.4"/><path d="M0 40H80M40 0V80" stroke="${c}" stroke-width="4"/>`,
        bg,
      ),
  },
  {
    id: "arrow",
    label: "Arrows",
    svg: (c, bg) =>
      wrap(
        48,
        `<path d="M8 24 H32 M28 18 L36 24 L28 30" fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round"/>`,
        bg,
      ),
  },
  {
    id: "feather",
    label: "Feather",
    svg: (c, bg) =>
      wrap(
        50,
        `<path d="M25 5 Q35 25 25 45 Q15 25 25 5" fill="none" stroke="${c}" stroke-width="2"/><line x1="25" y1="10" x2="25" y2="42" stroke="${c}" stroke-width="1"/>`,
        bg,
      ),
  },
  {
    id: "chain",
    label: "Chain",
    svg: (c, bg) =>
      wrap(
        44,
        `<ellipse cx="22" cy="12" rx="10" ry="6" fill="none" stroke="${c}" stroke-width="2.5"/><ellipse cx="22" cy="32" rx="10" ry="6" fill="none" stroke="${c}" stroke-width="2.5"/>`,
        bg,
      ),
  },
  {
    id: "spiral",
    label: "Spiral",
    svg: (c, bg) =>
      wrap(
        60,
        `<path d="M30 30 Q38 22 30 14 Q18 14 18 26 Q18 38 32 38 Q46 38 46 22" fill="none" stroke="${c}" stroke-width="2.5"/>`,
        bg,
      ),
  },
  {
    id: "moroccan",
    label: "Moroccan",
    svg: (c, bg) =>
      wrap(
        50,
        `<path d="M25 5 L35 15 L25 25 L15 15 Z M25 25 L35 35 L25 45 L15 35 Z" fill="none" stroke="${c}" stroke-width="2"/>`,
        bg,
      ),
  },
  {
    id: "art-deco",
    label: "Art Deco",
    svg: (c, bg) =>
      wrap(
        60,
        `<path d="M30 5 L55 30 L30 55 L5 30 Z" fill="none" stroke="${c}" stroke-width="2"/><circle cx="30" cy="30" r="8" fill="${c}"/>`,
        bg,
      ),
  },
  {
    id: "brushstroke",
    label: "Brushstroke",
    svg: (c, bg) =>
      wrap(
        70,
        `<path d="M10 50 Q35 20 60 45" fill="none" stroke="${c}" stroke-width="8" stroke-linecap="round" opacity="0.85"/>`,
        bg,
      ),
  },
  {
    id: "damask",
    label: "Damask",
    svg: (c, bg) =>
      wrap(
        120,
        `<path d="M60 20 Q80 0 100 20 Q120 40 100 60 Q80 80 60 60 Q40 80 20 60 Q0 40 20 20 Q40 0 60 20 Z" fill="none" stroke="${c}" stroke-width="2"/><path d="M60 40 Q70 30 80 40 T100 40" fill="none" stroke="${c}" stroke-width="1" opacity="0.5"/>`,
        bg,
      ),
  },
  {
    id: "baroque",
    label: "Baroque Scroll",
    svg: (c, bg) =>
      wrap(
        100,
        `<path d="M20 80 Q40 80 40 60 Q40 40 20 40 Q0 40 0 60 Q0 80 20 80 M40 60 Q40 20 80 20 Q100 20 100 40" fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round"/>`,
        bg,
      ),
  },
  {
    id: "camo",
    label: "Camouflage",
    svg: (c, bg) =>
      wrap(
        100,
        `<path d="M10 10 Q30 5 40 20 T70 10 T90 30 T70 60 T40 50 T10 70 Z" fill="${c}" opacity="0.6"/><path d="M50 50 Q70 45 80 60 T100 50 T80 90 T50 80 Z" fill="${c}" opacity="0.4"/>`,
        bg,
      ),
  },
  {
    id: "geo-mesh",
    label: "Geometric Mesh",
    svg: (c, bg) =>
      wrap(
        60,
        `<path d="M0 0 L30 15 L60 0 L45 30 L60 60 L30 45 L0 60 L15 30 Z" fill="none" stroke="${c}" stroke-width="1.5"/>`,
        bg,
      ),
  },
  {
    id: "lace",
    label: "Lace Pattern",
    svg: (c, bg) =>
      wrap(
        80,
        `<circle cx="40" cy="40" r="35" fill="none" stroke="${c}" stroke-width="1" stroke-dasharray="2 2"/><circle cx="40" cy="40" r="25" fill="none" stroke="${c}" stroke-width="2" opacity="0.5"/>`,
        bg,
      ),
  },
  {
    id: "argyle",
    label: "Argyle",
    svg: (c, bg) =>
      wrap(
        60,
        `<polygon points="30,0 60,30 30,60 0,30" fill="${c}" opacity="0.5"/><path d="M0,0 L60,60 M60,0 L0,60" stroke="${c}" stroke-width="1" stroke-dasharray="2,2"/>`,
        bg,
      ),
  },
  {
    id: "houndstooth",
    label: "Houndstooth",
    svg: (c, bg) =>
      wrap(
        40,
        `<path d="M0,0 H20 V20 H0 Z M20,20 H40 V40 H20 Z M0,20 L10,10 L20,20 Z M20,40 L30,30 L40,40 Z" fill="${c}"/>`,
        bg,
      ),
  },
  {
    id: "chevron-bold",
    label: "Bold Chevron",
    svg: (c, bg) =>
      wrap(
        60,
        `<path d="M0,20 L30,50 L60,20 L60,0 L30,30 L0,0 Z" fill="${c}"/><path d="M0,50 L30,80 L60,50 L60,30 L30,60 L0,30 Z" fill="${c}" opacity="0.6"/>`,
        bg,
      ),
  },
  {
    id: "polka-random",
    label: "Random Dots",
    svg: (c, bg) =>
      wrap(
        80,
        `<circle cx="15" cy="15" r="4" fill="${c}"/><circle cx="45" cy="25" r="6" fill="${c}" opacity="0.7"/><circle cx="25" cy="65" r="5" fill="${c}"/><circle cx="65" cy="55" r="8" fill="${c}" opacity="0.5"/>`,
        bg,
      ),
  },
  {
    id: "checker-slant",
    label: "Slanted Checker",
    svg: (c, bg) =>
      wrap(
        40,
        `<rect x="0" y="0" width="20" height="20" fill="${c}" transform="skewX(10)"/><rect x="20" y="20" width="20" height="20" fill="${c}" transform="skewX(10)"/>`,
        bg,
      ),
  },
  {
    id: "diamonds-outline",
    label: "Diamond Outline",
    svg: (c, bg) =>
      wrap(
        50,
        `<polygon points="25,5 45,25 25,45 5,25" fill="none" stroke="${c}" stroke-width="2"/><circle cx="25" cy="25" r="3" fill="${c}"/>`,
        bg,
      ),
  },
  {
    id: "wavy-lines",
    label: "Wavy Vertical",
    svg: (c, bg) =>
      wrap(
        40,
        `<path d="M10,0 Q20,20 10,40" fill="none" stroke="${c}" stroke-width="3"/><path d="M30,0 Q20,20 30,40" fill="none" stroke="${c}" stroke-width="3"/>`,
        bg,
      ),
  },
  {
    id: "overlapping-circles",
    label: "Overlapping",
    svg: (c, bg) =>
      wrap(
        60,
        `<circle cx="30" cy="30" r="25" fill="none" stroke="${c}" stroke-width="2" opacity="0.6"/><circle cx="0" cy="0" r="25" fill="none" stroke="${c}" stroke-width="2" opacity="0.6"/><circle cx="60" cy="60" r="25" fill="none" stroke="${c}" stroke-width="2" opacity="0.6"/>`,
        bg,
      ),
  },
  {
    id: "cross-grid",
    label: "Cross Grid",
    svg: (c, bg) =>
      wrap(
        40,
        `<path d="M20,0 V40 M0,20 H40" stroke="${c}" stroke-width="1"/><path d="M15,15 L25,25 M25,15 L15,25" stroke="${c}" stroke-width="2"/>`,
        bg,
      ),
  },
  {
    id: "pixel-blocks",
    label: "Pixel Blocks",
    svg: (c, bg) =>
      wrap(
        40,
        `<rect x="0" y="0" width="10" height="10" fill="${c}"/><rect x="10" y="10" width="10" height="10" fill="${c}" opacity="0.5"/><rect x="20" y="0" width="10" height="10" fill="${c}"/><rect x="30" y="10" width="10" height="10" fill="${c}" opacity="0.5"/>`,
        bg,
      ),
  },
  {
    id: "tri-mesh",
    label: "Triangle Mesh",
    svg: (c, bg) =>
      wrap(
        50,
        `<path d="M0,0 L25,50 L50,0 Z" fill="none" stroke="${c}" stroke-width="1"/><path d="M0,50 L25,0 L50,50 Z" fill="none" stroke="${c}" stroke-width="1" opacity="0.5"/>`,
        bg,
      ),
  },
  {
    id: "scales-fill",
    label: "Scale Fill",
    svg: (c, bg) =>
      wrap(
        40,
        `<path d="M0,20 C0,0 40,0 40,20" fill="${c}" opacity="0.4"/><path d="M-20,40 C-20,20 20,20 20,40 M20,40 C20,20 60,20 60,40" fill="${c}" opacity="0.4"/>`,
        bg,
      ),
  },
  {
    id: "stipple",
    label: "Stipple",
    svg: (c, bg) =>
      wrap(
        30,
        `<circle cx="5" cy="5" r="1" fill="${c}"/><circle cx="15" cy="12" r="1" fill="${c}"/><circle cx="25" cy="8" r="1" fill="${c}"/><circle cx="10" cy="25" r="1" fill="${c}"/><circle cx="20" cy="22" r="1" fill="${c}"/>`,
        bg,
      ),
  },
  {
    id: "halftone",
    label: "Halftone",
    svg: (c, bg) =>
      wrap(
        60,
        `<circle cx="10" cy="10" r="1" fill="${c}"/><circle cx="30" cy="10" r="3" fill="${c}"/><circle cx="50" cy="10" r="5" fill="${c}"/><circle cx="10" cy="30" r="3" fill="${c}"/><circle cx="30" cy="30" r="5" fill="${c}"/><circle cx="50" cy="30" r="7" fill="${c}"/>`,
        bg,
      ),
  },
  {
    id: "abstract-waves",
    label: "Abstract Waves",
    svg: (c, bg) =>
      wrap(
        80,
        `<path d="M0,40 Q20,10 40,40 T80,40" fill="none" stroke="${c}" stroke-width="4"/><path d="M0,60 Q20,30 40,60 T80,60" fill="none" stroke="${c}" stroke-width="2" opacity="0.5"/>`,
        bg,
      ),
  },
  {
    id: "radial-burst",
    label: "Radial Burst",
    svg: (c, bg) =>
      wrap(
        60,
        `<line x1="30" y1="30" x2="30" y2="0" stroke="${c}" stroke-width="2"/><line x1="30" y1="30" x2="60" y2="30" stroke="${c}" stroke-width="2"/><line x1="30" y1="30" x2="30" y2="60" stroke="${c}" stroke-width="2"/><line x1="30" y1="30" x2="0" y2="30" stroke="${c}" stroke-width="2"/><line x1="30" y1="30" x2="51" y2="9" stroke="${c}" stroke-width="1" opacity="0.5"/>`,
        bg,
      ),
  },
  {
    id: "circuit",
    label: "Circuit",
    svg: (c, bg) =>
      wrap(
        100,
        `<path d="M10,10 H40 V40 H70 V70" fill="none" stroke="${c}" stroke-width="2"/><circle cx="10" cy="10" r="3" fill="${c}"/><circle cx="70" cy="70" r="3" fill="${c}"/><path d="M40,10 V0 M70,40 H100" stroke="${c}" stroke-width="2"/>`,
        bg,
      ),
  },
  {
    id: "organic-cells",
    label: "Organic Cells",
    svg: (c, bg) =>
      wrap(
        100,
        `<path d="M20,20 Q40,10 60,20 T80,50 T50,80 T20,20" fill="none" stroke="${c}" stroke-width="2"/><circle cx="50" cy="40" r="5" fill="${c}" opacity="0.4"/>`,
        bg,
      ),
  },
  {
    id: "tribal-dash",
    label: "Tribal Dash",
    svg: (c, bg) =>
      wrap(
        50,
        `<line x1="10" y1="10" x2="40" y2="10" stroke="${c}" stroke-width="4" stroke-linecap="round"/><line x1="5" y1="25" x2="45" y2="25" stroke="${c}" stroke-width="2" stroke-dasharray="5,10"/><line x1="10" y1="40" x2="40" y2="40" stroke="${c}" stroke-width="4" stroke-linecap="round"/>`,
        bg,
      ),
  },
];
