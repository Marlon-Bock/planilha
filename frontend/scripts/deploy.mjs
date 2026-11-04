// Gera o frontend estático e coloca em backend/public, onde o Laravel/Apache serve na hospedagem.
// Uso (no PC): npm run deploy   → depois: git add -A, commit, push; no servidor: git pull.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "out");
const target = join(root, "..", "backend", "public");
const manifestFile = join(target, ".frontend-build.json");

// Arquivos do Laravel que o deploy nunca pode sobrescrever/apagar.
const PROTECTED = new Set(["index.php", ".htaccess", "robots.txt", ".frontend-build.json"]);
// "/" é tratado pelo Laravel (redireciona para /dashboard).
const SKIP = new Set(["index.html"]);

console.log("▶ Gerando build estático do Next.js...");
rmSync(out, { recursive: true, force: true });
const build = spawnSync("npx next build", {
  cwd: root,
  stdio: "inherit",
  shell: true,
  env: { ...process.env, NEXT_EXPORT: "1" },
});
if (build.status !== 0 || !existsSync(out)) {
  console.error("✖ O build falhou; nada foi alterado em backend/public.");
  process.exit(1);
}

// Lista todos os arquivos gerados.
const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const full = join(dir, name);
  return statSync(full).isDirectory() ? walk(full) : [full];
});
const files = walk(out)
  .map((f) => relative(out, f).split("\\").join("/"))
  .filter((f) => !SKIP.has(f) && !PROTECTED.has(f));

// Remove o build anterior (só o que o deploy anterior criou).
if (existsSync(manifestFile)) {
  const previous = JSON.parse(readFileSync(manifestFile, "utf8")).files ?? [];
  for (const f of previous) {
    if (!PROTECTED.has(f)) rmSync(join(target, f), { force: true });
  }
}
rmSync(join(target, "_next"), { recursive: true, force: true }); // arquivos com hash: sempre recria

console.log(`▶ Copiando ${files.length} arquivos para backend/public...`);
for (const f of files) {
  const dest = join(target, f);
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(join(out, f), dest);
}
writeFileSync(manifestFile, JSON.stringify({ builtAt: new Date().toISOString(), files }, null, 2));

// Remove pastas que ficaram vazias (ex.: páginas que deixaram de existir).
const prune = (dir) => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      prune(full);
      if (!readdirSync(full).length) rmSync(full, { recursive: true });
    }
  }
};
prune(target);

console.log("✔ Pronto! Agora: git add -A && git commit -m \"deploy\" && git push   →   no servidor: git pull");
