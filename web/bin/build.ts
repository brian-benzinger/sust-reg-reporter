/**
 * Static-site build entrypoint (ADR-0013).
 *
 * Thin I/O glue: it asks `buildSite` for the in-memory file list and flushes it
 * to `web/dist/`. All page/markup logic is in `src/` and unit-tested; this file
 * is deliberately logic-light and excluded from the coverage gate, the same way
 * the CDK app entrypoint in `infra/bin/` is (ADR-0019).
 *
 * Run with Node's native TypeScript type-stripping: `npm run build -w @sust-reg/web`.
 */
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDefaultSite } from "../src/site.ts";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "dist");

async function main(): Promise<void> {
  const files = buildDefaultSite();

  // Start clean so removed pages never linger in the published output.
  await rm(outDir, { recursive: true, force: true });

  for (const file of files) {
    const dest = join(outDir, file.path);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, file.contents, "utf8");
  }

  console.log(`Built ${files.length} file(s) to ${outDir}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
