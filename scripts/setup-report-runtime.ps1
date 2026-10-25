param([Parameter(Mandatory=$true)][string]$Python)
$ErrorActionPreference='Stop'
$reportPython=(Resolve-Path -LiteralPath $Python).Path
if (-not (Test-Path -LiteralPath 'vendor/report-wheels/manifest.json')) { throw 'Run from the PortalOne project root.' }
bun scripts/check-report-assets.ts
if ($LASTEXITCODE -ne 0) { throw 'Wheel verification failed.' }
New-Item -ItemType Directory -Path '.local-tools/report-python','.runtime' -Force | Out-Null
& $reportPython -m pip install --no-index --find-links vendor/report-wheels --target .local-tools/report-python 'reportlab==4.4.9' 'pillow==12.3.0' 'pypdf==6.10.0' 'charset-normalizer==3.5.2'
if ($LASTEXITCODE -ne 0) { throw 'Offline report runtime installation failed.' }
@{python=$reportPython}|ConvertTo-Json|Set-Content -LiteralPath '.runtime/report-runtime.json'
Write-Output 'Report Python configured. Cache the pinned QGIS image before rehearsal; no source database is modified.'
