# Pinned orchestration packages

These are the 20 new or changed npm package archives acquired relative to
`341de32:bun.lock` for the relief data contract and agent runtime. All declare MIT.
Every archive's SHA-512 matches both the committed lockfile and npm's versioned
metadata. `manifest.json` records version, URL, SHA-256, size and license location.
Package scripts were disabled during installation.

The JSON Schema package omits license text from its npm archive. Its MIT text is
retained alongside the archive from the exact `gitHead` recorded by npm; the
manifest links that pinned source. Other archives contain their own license text.

Runtime packages: LangGraph 1.5.2, LangChain Core 1.3.0 and Zod 4.6.7, with locked
transitive dependencies. Acquired source is preserved in the archives without
modification. PortalOne's integration code lives in `src/lib/server/`.

Smoke tests: an actual conditional LangGraph loop reached END under a recursion
limit; the application suite and offline/live relief scenarios exercise the
installed, lockfile-matched modules. The demo uses locally installed modules and
performs no registry fetch at runtime. A normal fresh install uses
`bun install --frozen-lockfile`; archives are retained for inspection and recovery,
not represented as a Bun cache layout or a fully offline installer.

Acquisition is reproducible with `bun scripts/vendor-agent-packages.ts` while the
registry is reachable. It fails on an integrity mismatch or unconfirmed license.
The baseline intentionally stays fixed to describe this acquisition boundary.
