import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

const [tectonicExecutable, outputBundles] = process.argv.slice(2);
if (!tectonicExecutable || !outputBundles) {
  throw new Error(
    "Usage: bun tools/prepare_tectonic_cache.ts <tectonic-executable> <output-bundles-directory>",
  );
}

const repoRoot = resolve(import.meta.dir, "..");
const seedTex = join(repoRoot, "tools", "tectonic_cache_seed.tex");
const temporaryRoot = mkdtempSync(join(tmpdir(), "ai-job-search-tectonic-"));
const cacheRoot = join(temporaryRoot, "cache");
const outputRoot = resolve(outputBundles);

try {
  let prepared = false;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const result = spawnSync(
      tectonicExecutable,
      ["--outdir", temporaryRoot, seedTex],
      {
        env: { ...process.env, TECTONIC_CACHE_DIR: cacheRoot },
        stdio: "inherit",
        timeout: 300_000,
      },
    );

    if (result.error) throw result.error;
    if (result.status === 0) {
      prepared = true;
      break;
    }
    if (attempt < 3) {
      console.warn(
        "Tectonic resource preparation did not finish; retrying with its partial cache.",
      );
    }
  }

  if (!prepared) {
    throw new Error("Tectonic could not prefetch the resume LaTeX resources.");
  }
  if (!existsSync(join(temporaryRoot, "tectonic_cache_seed.pdf"))) {
    throw new Error("Tectonic completed without creating its resource check PDF.");
  }

  const bundlesRoot = join(cacheRoot, "bundles");
  if (!existsSync(bundlesRoot)) {
    throw new Error("Tectonic did not create its resource bundle cache.");
  }

  rmSync(outputRoot, { recursive: true, force: true });
  mkdirSync(dirname(outputRoot), { recursive: true });
  cpSync(bundlesRoot, outputRoot, { recursive: true });
  const seedHash = createHash("sha256").update(readFileSync(seedTex)).digest("hex");
  const versionResult = spawnSync(tectonicExecutable, ["--version"], { encoding: "utf-8" });
  if (versionResult.status !== 0) {
    throw new Error("Could not read the bundled Tectonic version.");
  }
  writeFileSync(
    join(dirname(outputRoot), "version.txt"),
    versionResult.stdout.trim() + "\n" + seedHash + "\n",
  );
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
