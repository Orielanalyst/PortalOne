# Environment audit — 2026-10-24

Latest on 24 October: after the user saved their NVIDIA key directly in Nightshift,
the live completion probe returned exactly `PORTALONE_OK`. The response model
field reported `nvidia/nemotron-3-ultra-550b-a55b` through `meterless/auto`.
The saved request took 6,025 ms and used 151 tokens; these are observations,
not a latency guarantee. Authenticated `/v1/models` discovery passes and an invalid
token returns 401. The earlier `no_provider_configured` blocker is resolved.
World Model's compiled reference passes
8/8 conformance checks, and the persistent plan-assumption feature works on
labelled synthetic observations. See the new receipts in `evidence/`.

The table below preserves the initial audit checkpoint. The later results above
supersede its Meterless-unavailable row and not-yet-tested engine status.

**Verdict: Zetaris is installed and supports authenticated sample-data queries.**
Relief datasets and the application's Zetaris adapter are not yet implemented.
Nightshift/Nemotron has a live smoke receipt; the new agent loop is not verified.

## Verified facts

| Check | Result |
|---|---|
| Host | Windows 11 Pro, approximately 31.7 GiB RAM |
| Docker / Compose | Engine 29.9.2 / Compose 5.6.1 |
| WSL | Ubuntu and docker-desktop running on WSL2 |
| Docker resources | 12 CPUs; 16,629,133,312 bytes RAM (about 15.49 GiB) |
| Services | postgres, driver, api and ui healthy |
| Setup jobs | init and bootstrap exited 0, as designed |
| Vendor verification | All 9 checks passed, including login and end-to-end SQL |
| Vendor preflight in Ubuntu | All required checks passed; existing data-volume warning is expected |
| Registry | Manifest read succeeded; WSL preflight confirms sign-in |
| Catalogue | Official helper returned 2 visible Lightning databases |
| Real data | Selected two rows each from NY_TAXI and TPCDS_DB through the official SQL helper |
| Query timing | Selected-column queries reported 8,829 ms (NY_TAXI) and 12,053 ms (TPCDS); observations, not a benchmark |
| Local baseline application | Typecheck passed, 9 tests passed, production build passed |
| Git hooks | `core.hooksPath` is `.githooks` |
| GitHub CI | Blocked at startup by account billing/spending limits, before jobs run |
| Repository visibility | Private; public submission access remains a release task |
| Meterless runtime | No response at 8088, 8090, 8787 or 11434 during audit |

The Git Bash preflight's missing-registry warning was not reproduced in Ubuntu
WSL. Use WSL, the vendor's documented Windows route. The successful existing
volume is retained; the warning does not require deletion or reinstallation.
The WSL disk check reports its filesystem's available space, not a guarantee
of physical Windows drive capacity. No extra capacity claim relies on it.

## Connections and local configuration

- Bundle folder on this machine:
  `C:\Users\GLC\Documents\zetaris\zetaris-platform\zetaris-platform`
- UI and verified helper origin: `http://127.0.0.1:3000`.
- Raw API: `http://127.0.0.1:8888`; it is not interchangeable with UI proxy paths.
- JDBC: `jdbc:zetaris:lightning@localhost:10000`; matching jar is in the bundle.
  The jar and Java are present; a separate JDBC-client smoke test was not run.
- Login returned numeric org ID 1 on this install. Discover it again on a new
  install; another org ID is not evidence of failure.
- The project `.env` was created from the existing local account and is ignored.
  `.env.example` contains no credentials. Login tokens are not written to reports.
- The UI publish is bound on all host interfaces by the supplied Compose file;
  raw API and JDBC are loopback-bound. This audit did not change network exposure
  or the existing account password. Review before making the UI remotely accessible.

## Repeat the checks

From this repository, in PowerShell:

```powershell
.\scripts\check-zetaris.ps1
.\scripts\check-zetaris.ps1 -Sql 'SELECT LocationID, zone, borough FROM NY_TAXI.taxi_zones LIMIT 2'
```

The wrapper uses Ubuntu WSL's existing Python, the ignored `.env`, and official
helpers pinned in `../vendor/zetaris-getting-started`. It reads the catalogue or
executes the supplied SQL. Always select bounded, non-sensitive columns for
evidence reports; do not capture credentials or entire geometry/text payloads.
No package installation or remote source download occurs during these checks.

From Ubuntu WSL, the vendor platform checks are:

```bash
cd /mnt/c/Users/GLC/Documents/zetaris/zetaris-platform/zetaris-platform
./preflight.sh
./verify.sh
```

These existing-stack checks are read-only with respect to platform data. Do not
use the separate throwaway-install verification tool against this installation.

## Remaining readiness gates

1. Nightshift auth/discovery and Nemotron smoke completion are verified. Connect
   the upcoming planner feature and retain model identity per run.
2. World Model is vendored and verified: 8/8 conformance and the persistent
   product-specific state-change case pass.
3. Define and register small relief sources with provenance and a reproducible
   load path. Verify a domain-relevant join, not just a sample query.
4. Implement a server-only data adapter with timeouts, query budgets, provenance
   mapping and explicit live/offline status. Its read path is not present yet.
5. Account owner resolves GitHub Actions billing/spending limits; then rerun and
   require actual green verification. No account payment or limit was changed.
6. At release, review declarations, repository access and reproducibility before
   making the submission repository public.

CI evidence: https://github.com/Orielanalyst/PortalOne/actions/runs/39986817817

Vendor references:
- https://github.com/zetaris/getting-started/blob/6a2fbaa47c32c9ac33f6584c64b43b146c621bed/START-HERE.md
- https://github.com/zetaris/getting-started/blob/6a2fbaa47c32c9ac33f6584c64b43b146c621bed/docs/connections/README.md

Machine-readable records are in `evidence/`. They represent this audit and do
not assert a production-ready humanitarian system.

## Power and engine commands

```sh
bun run check:world-model
bun run demo:world-model
bun run check:meterless
bun run check:meterless --infer
```

The World Model source and generated module are pinned in `vendor/` with their
Apache-2.0 license. The official Nightshift Windows installer and installed
proprietary runtime remain in ignored `.local-tools/`; do not redistribute them
in the public submission repository. Runtime credentials remain in Nightshift's
local store; the probe reads the runtime token without printing it.

`check:meterless --infer` sends one small public smoke prompt and checks the exact
answer marker. Its final-text request uses `chat_template_kwargs.enable_thinking`
set to false, supported by [NVIDIA's model card](https://build.nvidia.com/nvidia/nemotron-3-ultra-550b-a55b/modelcard)
and passed through by the installed Nightshift proxy. Thinking prefixes and
separate reasoning fields are excluded from the saved answer. An unfinished trace
or a token-truncated response fails the check. Auto routing is not a model pin.
