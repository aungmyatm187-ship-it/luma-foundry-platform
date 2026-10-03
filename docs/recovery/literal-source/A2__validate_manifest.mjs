import fs from "node:fs";

const file = "/home/ubuntu/luma-foundry/luma-foundry-batch-01-product-manifest-filled.csv";
const text = fs.readFileSync(file, "utf8").trim();
const rows = text.split(/\r?\n/);
const parse = (line) => {
  const out = []; let cell = ""; let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (c === '"' && line[i + 1] === '"' && quoted) { cell += '"'; i += 1; }
    else if (c === '"') quoted = !quoted;
    else if (c === ',' && !quoted) { out.push(cell); cell = ""; }
    else cell += c;
  }
  out.push(cell);
  return out;
};
const header = parse(rows[0]);
const data = rows.slice(1).map(parse);
const must = ["batch", "index", "sku", "slug", "template_name", "one_line_promise", "live_preview_url", "status"];
if (rows.length !== 6) throw new Error(`Expected 6 rows; found ${rows.length}.`);
if (data.some((row) => row.length !== header.length)) throw new Error("A data row does not match the header column count.");
if (must.some((name) => !header.includes(name))) throw new Error("A required manifest header is missing.");
if (/\[[^\]]+\]/.test(text)) throw new Error("Unresolved bracketed placeholder found.");
const col = (name) => header.indexOf(name);
if (data.some((row) => !/^https:\/\/lumafoundry-jx4veohg\.manus\.space\//.test(row[col("live_preview_url")]))) throw new Error("A live-preview URL is not on the expected Manus domain.");
if (data.some((row, i) => row[col("sku")] !== `LF-B01-0${i + 1}` || row[col("status")] !== "live-concept-preview")) throw new Error("SKU or delivery status mismatch.");
console.log(`Validated ${data.length} Batch 01 rows with ${header.length} fields each.`);
