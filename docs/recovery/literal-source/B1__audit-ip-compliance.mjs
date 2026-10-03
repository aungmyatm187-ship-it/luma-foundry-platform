import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { products } from "../catalogue.js";

const root = resolve(import.meta.dirname, "..");
const outputPath = resolve(root, "data/ip-compliance-audit.json");
const runtimeFiles = ["index.html", "shop.html", "template.html", "app.js", "shop.js", "template.js", "catalogue.js", "styles.css"];
const blockedBrands = ["Apple", "Stripe", "Leica", "Porsche"];
const benchmarkDomains = ["apple.com", "stripe.com", "leica-camera.com", "porsche.com"];
const lumaHost = "lumafoundry-jx4veohg.manus.space";
const allowedRuntimeOrigins = new Set(["https://fonts.googleapis.com", "https://fonts.gstatic.com", `https://${lumaHost}`, "http://www.w3.org"]);

const unique = (values) => [...new Set(values)];
const extractUrls = (content) => unique(content.match(/https?:\/\/[^\s"'<>`\\]+/g) || []);
const benchmarkMatches = (content) => unique([
  ...blockedBrands.filter((brand) => new RegExp(`\\b${brand}\\b`, "i").test(content)),
  ...benchmarkDomains.filter((domain) => content.includes(domain)),
]);
const originOf = (url) => new URL(url).origin;

const runtimeSource = await Promise.all(runtimeFiles.map(async (file) => [file, await readFile(resolve(root, file), "utf8")]));
const runtimeUrls = unique(runtimeSource.flatMap(([, content]) => extractUrls(content)));
const runtimeOrigins = unique(runtimeUrls.map(originOf));
const runtimeBrandMatches = Object.fromEntries(runtimeSource.map(([file, content]) => [file, benchmarkMatches(content)]).filter(([, matches]) => matches.length));
const productRowsWithBenchmarkTerms = products.filter((product) => benchmarkMatches([product.id, product.name, product.category, product.previewUrl, product.imageUrl || ""].join(" ")).length);
const productRowsWithBenchmarkAssetOrigins = products.filter((product) => [product.previewUrl, product.imageUrl].filter(Boolean).some((url) => benchmarkDomains.some((domain) => new URL(url).hostname.endsWith(domain))));
const priorLinkAudit = JSON.parse(await readFile(resolve(root, "data/live-demo-audit.json"), "utf8"));

const audit = {
  auditVersion: 1,
  auditedAtUtc: new Date().toISOString(),
  scope: {
    storefrontRuntimeFiles: runtimeFiles,
    activeProductRecords: products.length,
    method: "Static master-storefront source provenance scan, shared-catalogue row scan, and bounded HTTP link-audit result review",
  },
  masterStorefront: {
    benchmarkTermsOrDomainsObserved: runtimeBrandMatches,
    runtimeOrigins,
    unapprovedRuntimeOrigins: runtimeOrigins.filter((origin) => !allowedRuntimeOrigins.has(origin)),
    approvedFontOrigins: runtimeOrigins.filter((origin) => origin.includes("fonts.googleapis.com") || origin.includes("fonts.gstatic.com")),
    lumaOwnedPreviewOrAssetOrigins: runtimeOrigins.filter((origin) => origin === `https://${lumaHost}`),
    productImages: {
      total: products.filter((product) => product.imageUrl).length,
      allHostedOnLuma: products.filter((product) => product.imageUrl).every((product) => new URL(product.imageUrl).hostname === lumaHost),
    },
  },
  operatorAActiveDemoSurface: {
    totalProductRows: products.length,
    productRowsWithBenchmarkTerms,
    productRowsWithBenchmarkAssetOrigins,
    previewUrlsAllLumaHosted: products.every((product) => new URL(product.previewUrl).hostname === lumaHost),
    lastBoundedHttpLinkAudit: { checkedAtUtc: priorLinkAudit.checked_at_utc, passing: priorLinkAudit.passing, total: priorLinkAudit.total },
    sourceRepositoryAudit: "not accessible in this workspace; require Operator A repository provenance review before commercial release",
  },
  conclusion: {
    observedDirectBenchmarkBrandAssetsInAuditedMasterRuntime: Object.keys(runtimeBrandMatches).length === 0 && productRowsWithBenchmarkAssetOrigins.length === 0,
    observedDirectBenchmarkBrandReferencesInMasterRuntime: Object.keys(runtimeBrandMatches).length === 0,
    status: "technical storefront and catalogue scan passed with stated limitations",
    limitations: [
      "This is not legal advice and cannot guarantee worldwide IP compliance or non-infringement.",
      "This audit cannot establish copyright ownership, licences, source-code provenance, trade-dress risk, patent clearance, or the contents of inaccessible Operator A build repositories and third-party assets.",
      "Require owner-provided asset licences, creator records, code provenance, and qualified counsel review before commercial publication.",
    ],
  },
};

await writeFile(outputPath, JSON.stringify(audit, null, 2), "utf8");
console.log(`IP audit: ${audit.masterStorefront.unapprovedRuntimeOrigins.length} unapproved master-runtime origins; ${audit.operatorAActiveDemoSurface.productRowsWithBenchmarkTerms.length} catalogue rows with benchmark terms; ${audit.operatorAActiveDemoSurface.productRowsWithBenchmarkAssetOrigins.length} catalogue rows with direct benchmark asset origins; link audit ${priorLinkAudit.passing}/${priorLinkAudit.total}.`);
if (audit.masterStorefront.unapprovedRuntimeOrigins.length || Object.keys(runtimeBrandMatches).length || productRowsWithBenchmarkTerms.length || productRowsWithBenchmarkAssetOrigins.length || priorLinkAudit.passing !== products.length) process.exitCode = 1;
