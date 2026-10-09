# Product research: evidence-led review packets

**Prepared:** 9 October 2026

**Focus:** Workflow automation, human review, and market signals relevant to Luma Foundry’s evidence-gated product pipeline.

## What the research suggests

Luma already has a valuable differentiator that general-purpose workflow builders do not make central: clearance depends on named evidence records, and machine traceability cannot substitute for human rights and counsel review. The next product step is therefore not another generic automation canvas. It is making review work easier to complete and safer to trust.

The research surfaced three useful patterns. n8n’s documentation supports pausing selected high-risk AI tool calls, showing the reviewer the proposed tool and parameters, then either executing or cancelling the action. LangGraph positions human review alongside stateful workflows and persisted context. A first-hand n8n/gotoHuman interview and demo illustrates why reviews benefit from retained iterations and a clear route to retry or continue. These patterns informed a read-only review packet rather than an automated approval: Luma keeps its human gate, but gives reviewers a more complete view of what is present, who recorded it, and what is still missing.[1] [2] [3]

## SimilarWeb snapshot

The public SimilarWeb profiles are labeled **September 2026**. SimilarWeb marks the traffic and engagement values as **estimated data**; its methodology describes a blend of direct measurement, contributory signals, partnerships, public extraction, and predictive modelling. The API was unavailable to this API-created session, so this snapshot uses the public profile pages only. The visit callouts below are the figures shown in each page’s traffic panel; treat them as directional, not first-party analytics or an audited market-size measure.[4] [5] [6]

| Public profile signal | n8n.io | make.com |
|---|---:|---:|
| Visits callout shown in the last-three-month traffic panel | 4.9M | 5.1M |
| Global rank (September 2026) | 12,682 | 8,083 |
| Change versus prior month | −12.44% | +0.84% |
| Bounce rate | 53.1% | 31.26% |
| Pages per visit | 2.95 | 8.04 |
| Average visit duration | 3:02 | 7:52 |
| Top desktop traffic source | Organic Search, 42.19% | Direct, 74.19% |

The directional signal is that both products have similar public visit callouts, while Make’s page reports deeper engagement and stronger direct traffic. n8n’s profile highlights a larger organic-search contribution. This is not proof of product quality or conversion; it suggests Luma should make its distinctive review workflow discoverable through concrete examples and should show enough operational detail to earn a longer, more deliberate evaluation.[4] [5]

## Applied product improvement

Added **Evidence Review Packet** as a shared, immutable point-in-time read view in the core domain, authenticated API, and MCP server. For each required evidence kind it reports the expected producer class, record presence, records currently returned by the repository, an unambiguous newest record where timestamps permit, blockers, and kind-level coverage. It freezes copied records so callers cannot mutate the in-memory ledger through the returned packet. `requiredRecordsComplete` is deliberately distinct from clearance; owner approval is not checked, legal sufficiency is not assessed, and stored recorder-role labels are not independently authenticated.

This is the product-specific adaptation of the research: make the handoff inspectable while keeping the final decision with the responsible human reviewer. A review also confirmed that the clearance workflow has an owner-approval gate, while the direct `set_product_status` guard currently checks evidence-kind presence only. The packet and its documentation do not hide that gap; unifying those authorization paths is a separate security/governance change and is not part of this commit. The repository contains a manual SQL migration defining evidence hash-chain and update/delete rejection triggers; rollout state was not independently checked here.

The core, API, and MCP tests cover empty and complete packets, immutable copies, ambiguous timestamp ties, authentication on the API query, and the explicit approval/provenance limits.

## Sources

[1]: https://docs.n8n.io/build/integrate-ai/ai-examples/human-in-the-loop-for-tools "n8n: Human-in-the-loop for tools"
[2]: https://www.langchain.com/langgraph "LangGraph: Balance agent control with agency"
[3]: https://www.youtube.com/watch?v=NG9bFFNNmQg "n8n: Making AI Agents Reliable (Human-in-the-Loop Demo), 12 September 2025"
[4]: https://www.similarweb.com/website/n8n.io/ "SimilarWeb: n8n.io traffic analytics, ranking and audience"
[5]: https://www.similarweb.com/website/make.com/ "SimilarWeb: make.com traffic analytics, ranking and audience"
[6]: https://support.similarweb.com/hc/en-us/articles/360001631538-Similarweb-Data-Methodology "SimilarWeb: Data methodology"
