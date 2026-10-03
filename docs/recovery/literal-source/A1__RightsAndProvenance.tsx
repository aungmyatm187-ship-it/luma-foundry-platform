import { ArrowLeft, ArrowUpRight, BadgeCheck, FileCheck2, Fingerprint, ShieldCheck } from "lucide-react";

const safeguards = [
  {
    icon: FileCheck2,
    eyebrow: "01 / RELEASE RECORD",
    title: "A traceable source of record",
    body: "A commercial release should map to a specific repository commit, versioned design history, asset register, contributor-rights record, dependency notices, and review status. This is evidence, not a browser restriction.",
  },
  {
    icon: Fingerprint,
    eyebrow: "02 / MEDIA PROVENANCE",
    title: "Watermark assets at their source",
    body: "Where an image, video, or audio asset needs stronger provenance, apply a release-time Content Credential or suitable durable fingerprint. A discreet visible preview mark can deter casual copying, but it is not a substitute for a licence or source record.",
  },
  {
    icon: BadgeCheck,
    eyebrow: "03 / BUYER-SPECIFIC DELIVERY",
    title: "Make every handoff accountable",
    body: "A real commercial delivery should carry a buyer or named-client licence reference, release version, included-asset list, setup guide, and support boundary. No public preview is a transfer of template rights.",
  },
  {
    icon: ShieldCheck,
    eyebrow: "04 / FAIR ENFORCEMENT",
    title: "Keep the web usable",
    body: "Visitors may use ordinary browser functions, including selection, copy, context menus, and accessibility tools. Rights protection is handled with terms, evidence, release controls, and proportionate enforcement—not by degrading everyday browsing.",
  },
];

export default function RightsAndProvenance() {
  return (
    <main className="rights-page min-h-screen overflow-hidden bg-[#0A0B0D] text-[#F6F4EF]">
      <div className="rights-noise" aria-hidden="true" />
      <header className="rights-header">
        <a href="/" className="rights-back"><ArrowLeft className="size-4" /> LUMA FOUNDRY</a>
        <span className="rights-kicker">RIGHTS / PROVENANCE</span>
      </header>

      <section className="rights-hero" aria-labelledby="rights-title">
        <p className="rights-eyebrow">OPEN WEB. CLEAR RIGHTS.</p>
        <h1 id="rights-title">Good work should stay <em>usable.</em></h1>
        <p className="rights-lead">Luma Foundry does not disable right-click, text selection, standard copy commands, or accessibility tools. Public previews remain open to explore; commercial use is governed through clear release evidence and licence terms.</p>
        <div className="rights-status" role="note">
          <span aria-hidden="true" />
          <p><strong>Commercial-release boundary:</strong> a public preview is not a template, source-code, or asset licence. Current concept routes are not represented here as commercially cleared until their release evidence is complete.</p>
        </div>
      </section>

      <section className="rights-grid" aria-label="Layered intellectual-property protection approach">
        {safeguards.map(({ icon: Icon, eyebrow, title, body }) => (
          <article className="rights-card" key={eyebrow}>
            <Icon className="rights-card-icon" aria-hidden="true" />
            <p className="rights-card-eyebrow">{eyebrow}</p>
            <h2>{title}</h2>
            <p>{body}</p>
          </article>
        ))}
      </section>

      <section className="rights-method" aria-labelledby="rights-method-title">
        <div>
          <p className="rights-eyebrow">IMPLEMENTATION STANDARD</p>
          <h2 id="rights-method-title">Protection works best as a layered release process.</h2>
        </div>
        <div className="rights-method-copy">
          <p>For protected media, use the open <a href="https://c2pa.org/" target="_blank" rel="noreferrer">C2PA / Content Credentials</a> standard where the creation and delivery toolchain supports it. The standard is designed for cryptographically verifiable provenance; durable credentials may additionally use a watermark or fingerprint to help reconnect media with its record after metadata loss.</p>
          <p>For Luma Foundry, this means: first establish source and asset evidence; then prepare buyer-specific delivery records; then consider discrete visible preview marks and durable media provenance for individual assets. Watermarking alone cannot prove ownership, prevent screenshots, or replace a reviewed licence.</p>
          <a className="rights-link" href="/">Return to the public collection <ArrowUpRight className="size-4" /></a>
        </div>
      </section>

      <footer className="rights-footer">
        <span>PUBLIC PREVIEW / NO BROWSER RESTRICTIONS</span>
        <span>LICENCE AND PROVENANCE BEFORE COMMERCIAL RELEASE</span>
      </footer>
    </main>
  );
}
