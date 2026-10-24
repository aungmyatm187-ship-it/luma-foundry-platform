# Luma Foundry — DNS and Email Propagation Status

**Checked:** 2026-09-24  
**Status:** `PENDING — registrar delegation not yet propagated`

Public DNS-over-HTTPS still reports `ns1.globaldomaingroup.com` and `ns2.globaldomaingroup.com` as the authoritative nameservers for `lumafoundry.live`. Cloudflare’s assigned nameservers remain `ethan.ns.cloudflare.com` and `phoenix.ns.cloudflare.com`, but they are not authoritative publicly yet.

Because the registrar still serves the Global Domain Group nameservers, the Zoho verification TXT, Zoho MX records, SPF, DKIM, and DMARC records visible inside the pending Cloudflare zone cannot be treated as publicly authoritative. Current public TXT and MX lookups return no answer for the domain. Do not add duplicate mail records or delete website records during this state.

Website continuity remains healthy: the apex returns HTTP 200, and `www.lumafoundry.live` redirects to the apex with HTTP 301 followed by HTTP 200. No DNS or registrar mutation was performed during this check.

The next owner action remains to wait for the approved nameserver delegation to propagate, then retry Zoho verification. Only after Cloudflare is authoritative should the final Zoho MX, SPF, DKIM, and DMARC values be checked and corrected in one controlled pass.
