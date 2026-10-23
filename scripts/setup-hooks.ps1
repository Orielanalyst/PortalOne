$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot

git -C $root config core.hooksPath .githooks

Write-Host "Git hooks enabled for $root"
Write-Host "  pre-commit: blocks .env files and obvious API keys"
Write-Host "  pre-push:   runs typecheck and tests"
