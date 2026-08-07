import { cp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { marpCli } from "@marp-team/marp-cli";
import { parse as parseYaml } from "yaml";
import ejs from "ejs";

const decksDir = "decks";
const outDir = "out";
const indexTemplate = path.join(import.meta.dirname, "templates", "index.ejs");

async function convertDecks() {
  const exitCode = await marpCli(["--html", "-I", decksDir, "-o", outDir]);
  if (exitCode !== 0) {
    throw new Error(`marp exited with code ${exitCode}`);
  }
}

async function listDeckNames() {
  const entries = await readdir(decksDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

async function copyAssets(deckNames) {
  for (const deckName of deckNames) {
    const deckDir = path.join(decksDir, deckName);
    const deckOutDir = path.join(outDir, deckName);
    await mkdir(deckOutDir, { recursive: true });

    const files = (await readdir(deckDir, { withFileTypes: true })).filter(
      (entry) => entry.isFile() && !entry.name.endsWith(".md"),
    );

    for (const file of files) {
      await cp(
        path.join(deckDir, file.name),
        path.join(deckOutDir, file.name),
      );
    }
  }
}

const frontmatterPattern = /^---\n([\s\S]*?)\n---/;

async function readDeckMeta(deckName) {
  const raw = await readFile(path.join(decksDir, deckName, "index.md"), "utf8");
  const match = frontmatterPattern.exec(raw);
  const frontmatter = match ? parseYaml(match[1]) : {};

  return {
    name: deckName,
    title: frontmatter.title ?? deckName,
    links: frontmatter.links ?? [],
  };
}

async function buildIndex(deckNames) {
  const decks = await Promise.all(deckNames.map(readDeckMeta));
  const html = await ejs.renderFile(indexTemplate, { decks });
  await writeFile(path.join(outDir, "index.html"), html);
}

const deckNames = await listDeckNames();

await convertDecks();
await copyAssets(deckNames);
await buildIndex(deckNames);
