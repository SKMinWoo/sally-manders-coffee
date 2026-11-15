// Writes app/icon.svg, the browser tab's icon: Sally from components/sally/Sally.tsx, in the
// header's dark printing on its black, as a rounded tile. Run it again after changing her:
//   npx tsx scripts/render-icon.tsx

import { writeFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { Sally, SIGN } from "@/components/sally/Sally";

const mark = renderToStaticMarkup(<Sally palette={SIGN.dark} title="" />)
  .replace(/^<svg[^>]*>/, "")
  .replace(/<\/svg>$/, "");

// Sally's own box is 157.9 × 114.2 from (29.2, 60.8); centre her on a square tile with a margin
const size = 176;
const x = +(29.2 - (size - 157.9) / 2).toFixed(2);
const y = +(60.8 - (size - 114.2) / 2).toFixed(2);

writeFileSync(
  "app/icon.svg",
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${size} ${size}">` +
    `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="36" fill="${SIGN.dark.paper}"/>${mark}</svg>\n`,
);
console.log("wrote app/icon.svg");
