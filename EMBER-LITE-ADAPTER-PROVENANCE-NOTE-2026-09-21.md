# ember-lite Evidence Adapter

This adapter is an independently written TypeScript transformation. It does not copy or import Python source from `highfive251677-wq/ember-lite`; it reads a sanitized JSON evidence bundle and emits Ember Signal records.

## Provenance wording

Use: `Imported observation from ember-lite bundle, traced to the exact source commit.`

Do not use: `Commercially cleared`, `owned by Luma Foundry`, or any statement that a source commit proves ownership or licence validity.

## Source trace

- Repository: https://github.com/highfive251677-wq/ember-lite
- Branch inspected: `master`
- Source commit: `2bb64e184c5618cf5d7fef2f4755975b6041b535`
- Source repository licence observed: MIT

Because this adapter does not copy or adapt source code, the MIT copyright notice is not being used as a licence claim over generated observation data. If future changes copy or adapt any `ember-lite` source code, preserve the upstream copyright and MIT licence notice in a third-party notices file before merge.

## Input contract

The adapter requires a JSON object with `chain.signed === true`, `chain.verified === true`, and `perception.observations`. It rejects malformed, unsigned, unverified, and credential-like input.

## Output contract

Each safe observation becomes an Ember Signal record with `id`, `title`, `source`, `observedAt`, `status`, `summary`, and `reference`. The source commit is retained in `reference`; the original bundle must be preserved separately from the generated records.
