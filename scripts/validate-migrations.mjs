import { readdir } from "node:fs/promises";

const directory = new URL("../supabase/migrations/", import.meta.url);
const files = (await readdir(directory)).filter((file) => file.endsWith(".sql")).sort();
const versions = new Set();
const orderedVersions = [];
const errors = [];

for (const file of files) {
  const match = /^(\d{12,14})_[a-z0-9_]+\.sql$/.exec(file);
  if (!match) {
    errors.push(`${file}: nom invalide (version numérique + nom snake_case attendus)`);
    continue;
  }
  if (versions.has(match[1])) errors.push(`${file}: version ${match[1]} déjà utilisée`);
  versions.add(match[1]);
  orderedVersions.push(match[1]);
}

if (!files.length) errors.push("aucune migration SQL trouvée");
const sortedVersions = [...orderedVersions].sort();
if (orderedVersions.some((version, index) => version !== sortedVersions[index])) {
  errors.push("l’ordre lexical des fichiers diffère de l’ordre des versions Supabase");
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`${files.length} migrations valides, ordonnées de ${files[0]} à ${files.at(-1)}.`);
}
