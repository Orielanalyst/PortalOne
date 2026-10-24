# Official Zetaris connection helpers

- Upstream: https://github.com/zetaris/getting-started
- Pinned commit: `6a2fbaa47c32c9ac33f6584c64b43b146c621bed`
- Acquired: 2026-10-24
- License: Apache-2.0; full upstream license is in `LICENSE`.
- Files: `scripts/check_zetaris.py`, `query_zetaris.py`, `zetaris_api.py`,
  `zetaris_sql.py`, copied without modification from the pinned revision.
- Purpose: local catalogue discovery and bounded SQL smoke tests. These are
  diagnostic tools, not a completed application data adapter.
- Runtime: the existing Python 3.14.4 in Ubuntu WSL. No Python packages required
  for these HTTP checks. The unused JDBC path has optional dependencies.
- The small Windows wrapper in `../../scripts/check-zetaris.ps1` reads an ignored
  `.env` and passes only required configuration over stdin to WSL.

Run the checks described in `../../docs/ENVIRONMENT.md`. Do not replace these
files from `main` during a demo; update the pin deliberately and rerun the checks.
