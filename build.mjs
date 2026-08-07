import { cp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { marpCli } from "@marp-team/marp-cli";
import { parse as parseYaml } from "yaml";
import ejs from "ejs";

const decksDir = "decks";
const outDir = "out";
const indexTemplate = path.join(import.meta.dirname, "templates", "index.ejs");

const convertDecks = async () => {
  const exitCode = await marpCli(["--html", "-I", decksDir, "-o", outDir]);
  if (exitCode !== 0) {
    throw new Error(`marp exited with code ${exitCode}`);
  }
};

const listDeckNames = async () =>
  (await readdir(decksDir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

const copyAssets = async (deckNames) => {
  for (const deckName of deckNames) {
    const deckDir = path.join(decksDir, deckName);
    const deckOutDir = path.join(outDir, deckName);
    await mkdir(deckOutDir, { recursive: true });

    const files = (await readdir(deckDir, { withFileTypes: true })).filter(
      (entry) => entry.isFile() && !entry.name.endsWith(".md"),
    );

    for (const file of files) {
      await cp(path.join(deckDir, file.name), path.join(deckOutDir, file.name));
    }
  }
};

const frontmatterPattern = /^---\n([\s\S]*?)\n---/;

const readDeckMeta = async (deckName) => {
  const raw = await readFile(path.join(decksDir, deckName, "index.md"), "utf8");
  const match = frontmatterPattern.exec(raw);
  const frontmatter = match ? parseYaml(match[1]) : {};

  return {
    name: deckName,
    title: frontmatter.title ?? deckName,
    links: frontmatter.links ?? [],
  };
};

const buildIndex = async (deckNames) => {
  const decks = await Promise.all(deckNames.map(readDeckMeta));
  const html = await ejs.renderFile(indexTemplate, { decks });
  await writeFile(path.join(outDir, "index.html"), html);
};

await convertDecks();

const deckNames = await listDeckNames();
await copyAssets(deckNames);
await buildIndex(deckNames);
