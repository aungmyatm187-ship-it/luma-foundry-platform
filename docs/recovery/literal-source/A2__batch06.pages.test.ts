import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
const root=resolve(import.meta.dirname,".."); const app=readFileSync(resolve(root,"client/src/App.tsx"),"utf8"); const pages=readFileSync(resolve(root,"client/src/pages/SpatialBatchSix.tsx"),"utf8"); const css=readFileSync(resolve(root,"client/src/pages/spatial-batch-06.css"),"utf8");
describe("Batch 06 hospitality and spatial collection",()=>{it("registers five independent routes",()=>[["/maison-rook","MaisonRook"],["/terra-forma","TerraForma"],["/veloce-district","VeloceDistrict"],["/hinge-hearth","HingeHearth"],["/fieldnote-cabins","FieldnoteCabins"]].forEach(([route,component])=>{expect(app).toContain(`path={"${route}"} component={${component}}`);expect(pages).toContain(`export function ${component}`)}));it("retains motion reduction support",()=>{expect(pages).toContain("useBatchReveal()");expect(css).toContain("@media(prefers-reduced-motion:reduce)")})});
