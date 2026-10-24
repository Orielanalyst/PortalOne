param(
    [string]$EnvFile = (Join-Path $PSScriptRoot '..\.env'),
    [string]$WslDistribution = 'Ubuntu',
    [string]$Sql = ''
)

$ErrorActionPreference = 'Stop'
$taskProjectRoot = Split-Path -Parent $PSScriptRoot
$taskHelperDirectory = Join-Path $taskProjectRoot 'vendor\zetaris-getting-started\scripts'

if (-not (Test-Path -LiteralPath $EnvFile)) {
    throw 'Missing local .env. Copy .env.example and configure your existing Zetaris account.'
}

# Read configuration as data. Never source/evaluate a .env file or print its values.
$taskAllowedNames = @(
    'ZETARIS_BASE_URL', 'ZETARIS_ORG_ID', 'ZETARIS_API_KEY',
    'ZETARIS_USERNAME', 'ZETARIS_PASSWORD', 'ZETARIS_QUERY_LIMIT'
)
$taskConfiguration = @{}
foreach ($taskLine in Get-Content -LiteralPath $EnvFile) {
    if ($taskLine -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
        $taskName = $matches[1]
        $taskValue = $matches[2].Trim()
        if ($taskValue.Length -ge 2 -and (
            ($taskValue.StartsWith('"') -and $taskValue.EndsWith('"')) -or
            ($taskValue.StartsWith("'") -and $taskValue.EndsWith("'"))
        )) {
            $taskValue = $taskValue.Substring(1, $taskValue.Length - 2)
        }
        if ($taskName -in $taskAllowedNames -and $taskValue) {
            $taskConfiguration[$taskName] = $taskValue
        }
    }
}

# This wrapper is deliberately for the audited local install. The vendor helpers
# also support remote instances, which need a separately reviewed configuration.
if ($taskConfiguration['ZETARIS_BASE_URL'] -notin @(
    'http://127.0.0.1:3000', 'http://localhost:3000'
)) {
    throw 'Set ZETARIS_BASE_URL to the audited local Zetaris UI origin on port 3000.'
}
$taskConfiguration['ZETARIS_QUERY_LIMIT'] = '5'

$taskHelperWslPath = & wsl.exe -d $WslDistribution --exec wslpath -a -u ($taskHelperDirectory.Replace('\', '/'))
if ($LASTEXITCODE -ne 0 -or -not $taskHelperWslPath) {
    throw 'Could not resolve the vendor helper path inside WSL.'
}
$taskHelperWslPath = $taskHelperWslPath.Trim()
$taskPayload = @{
    environment = $taskConfiguration
    helperDirectory = $taskHelperWslPath
    sql = $Sql
} | ConvertTo-Json -Compress -Depth 4

# Reuse the pinned official helper; stdin carries credentials without command-line
# arguments, shell interpolation, a temporary secrets file, or logs.
$taskPython = @'
import json, os, runpy, sys
payload = json.load(sys.stdin)
os.environ.update(payload['environment'])
os.environ['PYTHONDONTWRITEBYTECODE'] = '1'
sys.dont_write_bytecode = True
directory = payload['helperDirectory']
sys.path.insert(0, directory)
sql = payload['sql']
filename = 'query_zetaris.py' if sql else 'check_zetaris.py'
sys.argv = [filename] + ([sql] if sql else [])
try:
    runpy.run_path(directory + '/' + filename, run_name='__main__')
except SystemExit as result:
    raise SystemExit(result.code)
'@
$taskPayload | & wsl.exe -d $WslDistribution --exec python3 -c $taskPython
exit $LASTEXITCODE
