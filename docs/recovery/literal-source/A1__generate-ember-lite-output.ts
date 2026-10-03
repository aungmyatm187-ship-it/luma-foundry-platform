import { readFile, writeFile } from "node:fs/promises";
import { adaptEmberLiteEvidenceBundle } from "../server/emberLiteEvidenceAdapter";

const input = JSON.parse(await readFile("fixtures/ember-lite/verified-bundle.json", "utf8"));
const output = adaptEmberLiteEvidenceBundle(input);
await writeFile("fixtures/ember-lite/expected-ember-signal-output.json", `${JSON.stringify(output, null, 2)}\n`);
