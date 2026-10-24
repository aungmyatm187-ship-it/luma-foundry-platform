# Luma Foundry — DNS and Email Propagation Status

**Checked:** 2026-09-22 16:13 UTC  
**Scope:** Read-only public DNS, website reachability, and Cloudflare token inspection.

## Public DNS result

Independent Cloudflare DNS-over-HTTPS and Google Public DNS lookups both report that `lumafoundry.live` is still authoritative at the registrar's prior nameservers:

- `ns1.globaldomaingroup.com`
- `ns2.globaldomaingroup.com`

The observed SOA is still `ns1.globaldomaingroup.com`. The intended Cloudflare nameservers (`ethan.ns.cloudflare.com` and `phoenix.ns.cloudflare.com`) are **not** authoritative in public DNS at this check time. No public Zoho verification TXT or MX record is visible yet.

## Website continuity

- `https://lumafoundry.live/` returned HTTP 200.
- `https://www.lumafoundry.live/` returned HTTP 301 to the apex, then HTTP 200.

The website remains reachable, but reachability does not prove Cloudflare DNS delegation has completed.

## Cloudflare API limitation

The available Cloudflare API token did not pass the documented read-only token-verification endpoint. No Cloudflare API mutation was attempted. This prevents a token-based zone-status confirmation in this session.

## Safe next action

Confirm in the domain registrar (Global Domain Group) that the delegation is saved exactly as:

1. `ethan.ns.cloudflare.com`
2. `phoenix.ns.cloudflare.com`

Remove the two Global Domain Group nameservers only after confirming the registrar has a saved/active nameserver configuration. Do not add Zoho records at the old registrar while Cloudflare is intended to become authoritative. Once public NS answers change to the two Cloudflare nameservers and the Cloudflare zone shows **Active**, retry Zoho verification and then add MX/SPF/DKIM/DMARC records in Cloudflare DNS.
