// Gera os ícones do app (PWA, Android/TWA, Apple e favicon) a partir de um SVG.
// Uso: npm run icons
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";

const BRAND_FROM = "#f472b6";
const BRAND_TO = "#db2777";
// Ícone "wallet" do lucide (o mesmo da logo da sidebar) com um coraçãozinho, em coordenadas 24x24.
const GLYPH = `
  <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/>
  <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>
  <path transform="translate(5.2 8.3) scale(0.4)" fill="#fff" stroke="none" d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.6 1.2 5.3 3 1.7-1.8 3.2-3 5.3-3 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z"/>`;

/**
 * @param {object} o
 * @param {boolean} o.rounded  cantos arredondados (ícone "any"); false = quadrado cheio (maskable/apple)
 * @param {number} o.glyph     tamanho do desenho dentro de 512px
 */
function svg({ rounded, glyph }) {
  const scale = glyph / 24;
  const offset = (512 - glyph) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${BRAND_FROM}"/>
      <stop offset="1" stop-color="${BRAND_TO}"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="${rounded ? 112 : 0}" fill="url(#g)"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${GLYPH}
  </g>
</svg>`;
}

const any = svg({ rounded: true, glyph: 280 });
// Maskable: o Android recorta em círculo/squircle, então o desenho fica na zona segura (~60%).
const maskable = svg({ rounded: false, glyph: 230 });

await mkdir("public/icons", { recursive: true });

const out = [
  ["public/icons/icon-192.png", any, 192],
  ["public/icons/icon-512.png", any, 512],
  ["public/icons/icon-maskable-192.png", maskable, 192],
  ["public/icons/icon-maskable-512.png", maskable, 512],
  ["public/icons/apple-touch-icon.png", maskable, 180],
];
for (const [file, source, size] of out) {
  await sharp(Buffer.from(source)).resize(size, size).png().toFile(file);
  console.log("✓", file);
}

// Badge das notificações: o Android usa só a transparência (silhueta branca na barra de status).
const badge = `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 24 24">
  <path fill="#fff" d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.6 1.2 5.3 3 1.7-1.8 3.2-3 5.3-3 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z"/>
</svg>`;
await sharp(Buffer.from(badge)).resize(72, 72).png().toFile("public/icons/badge-72.png");
console.log("✓ public/icons/badge-72.png");

// Favicon vetorial (Next serve src/app/icon.svg automaticamente).
await writeFile("src/app/icon.svg", any);
console.log("✓ src/app/icon.svg");
