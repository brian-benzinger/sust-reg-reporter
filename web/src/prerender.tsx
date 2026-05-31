/**
 * Prerender entry (ADR-0013, ADR-0021): serialize every page in the manifest
 * to static HTML and write it, plus the stylesheet, into dist/. Thin I/O glue —
 * bundled for Node by webpack and run by `npm run build`; excluded from the
 * coverage gate the same way infra/bin is. All page/markup logic is in tested
 * modules under src/.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { Layout } from "./components/Layout.tsx";
import { buildPages, defaultCorpus, type PageSpec } from "./site.tsx";
import { STYLESHEET, STYLESHEET_PATH } from "./styles.ts";

const outDir = resolve(process.cwd(), "dist");

function renderDocument(page: PageSpec): string {
  const html = renderToStaticMarkup(
    <Layout
      title={page.title}
      description={page.description}
      canonicalPath={page.canonicalPath}
      withClient={page.withClient}
    >
      {page.node}
    </Layout>,
  );
  return `<!doctype html>\n${html}\n`;
}

async function main(): Promise<void> {
  const pages = buildPages(defaultCorpus());

  await mkdir(outDir, { recursive: true });
  await writeFile(
    join(outDir, STYLESHEET_PATH.replace(/^\//, "")),
    STYLESHEET,
    "utf8",
  );

  for (const page of pages) {
    const dest = join(outDir, page.path);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, renderDocument(page), "utf8");
  }

  console.log(`Prerendered ${pages.length} page(s) to ${outDir}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
