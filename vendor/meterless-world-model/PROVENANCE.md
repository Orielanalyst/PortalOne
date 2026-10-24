# Meterless World Model reference

- Upstream: https://github.com/Meterless/Meterless
- Revision: `1742dec56a66e58eef9dda2d2b865823758ca8cd`
- Acquired: 2026-10-24
- License: Apache-2.0, retained in `LICENSE`.
- `src/`: unchanged copies of `engines/world-model/reference/src/`.
- `conformance/`: unchanged upstream suite.
- `AGENTS.md`: unchanged engine implementation specification.
- `README.md`: upstream reference README. Its original sibling links refer to
  the upstream repository layout, not this reduced vendor import.
- `dist/`: built from these six source modules using Bun 1.4.4; declaration files
  emitted by this project's locked TypeScript compiler. No runtime dependencies.

Verification before adoption: upstream 10-test suite passed in an isolated Node
test configuration, and 8/8 conformance checks passed against both upstream source
and the compiled module imported by PortalOne. The upstream test command initially
discovered PortalOne's parent Vitest config; the isolated config corrected that.
Upstream test dependencies remain in the ignored acquisition checkout. They are
not dependencies of the application or this vendored runtime.

The product adapter is `../../src/lib/server/relief-world.ts`. It uses the real
WorldModel store, canonical graph queries and audit log for immutable observations,
independent-origin assessments and invalidation of stale plan assumptions.

Limits: this is the upstream reference, using synchronous JSON persistence and
one writer process per namespace. It is not a production distributed store. The
adapter does not use the reference's assertFact conflict resolution to establish
road safety; reported observations and their assessment remain separate.

Reproduce with `bun run build:world-model`, `bun run check:world-model`,
`bun run test`, and `bun run demo:world-model`. These commands need no model key.
