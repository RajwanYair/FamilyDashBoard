# serve-local.ps1 — Local dev/preview server launcher
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts/serve-local.ps1 -Mode dev
#   powershell -ExecutionPolicy Bypass -File scripts/serve-local.ps1 -Mode preview
param(
    [Parameter(Mandatory)]
    [ValidateSet("dev", "preview")]
    [string]$Mode
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

switch ($Mode) {
    "dev" {
        Write-Host "`n  Dev server (hot-reload): http://localhost:5173`n" -ForegroundColor Cyan
        npx vite
    }
    "preview" {
        Write-Host "`n  Building production bundle...`n" -ForegroundColor Cyan
        npm run build
        Write-Host "`n  Preview server: http://localhost:4173/FamilyDashBoard/`n" -ForegroundColor Cyan
        npx vite preview
    }
}
