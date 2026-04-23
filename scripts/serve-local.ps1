<#
.SYNOPSIS
    Start a local web server that matches the GitHub Pages production site.

.DESCRIPTION
    Opens FamilyDashBoard on a real HTTP localhost server so the experience is
    identical to https://rajwanyair.github.io/FamilyDashBoard/.

    WHY file:// looks broken:
      - Root index.html is the raw Vite SOURCE (references main.ts — TS files
        can't run in the browser). GitHub Pages serves the compiled dist/ bundle.
      - Service Workers are silently skipped on file:// (only work on https:// or
        localhost), so the offline cache and background sync do nothing.
      - CSP "self" matches nothing on opaque file:// origins, so all scripts may
        be blocked on Chromium without the local-build patch.
      - Absolute paths (/FamilyDashBoard/icon.svg) never resolve from file://.

    TWO MODES:
      dev       Fast dev server with hot-reload (TypeScript compiled on-the-fly).
                Best for editing code and seeing changes instantly.
                URL: http://localhost:5173/FamilyDashBoard/

      preview   Build first, then serve the exact same artifact deployed to GitHub
                Pages. Best for verifying the production experience locally.
                URL: http://localhost:4173/FamilyDashBoard/

.PARAMETER Mode
    'dev' (default) or 'preview'

.PARAMETER NoBrowser
    Skip automatic browser launch.

.EXAMPLE
    .\scripts\serve-local.ps1
    .\scripts\serve-local.ps1 -Mode preview
    .\scripts\serve-local.ps1 -Mode dev -NoBrowser
#>
param(
    [ValidateSet("dev", "preview")]
    [string]$Mode = "dev",
    [switch]$NoBrowser
)

$ProjectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $ProjectRoot

switch ($Mode) {
    "dev" {
        $Url = "http://localhost:5173/FamilyDashBoard/"
        Write-Host ""
        Write-Host "=== FamilyDashBoard — DEV SERVER ===" -ForegroundColor Cyan
        Write-Host "Mode    : Hot-reload dev (TypeScript compiled on-the-fly)" -ForegroundColor White
        Write-Host "URL     : $Url" -ForegroundColor Green
        Write-Host "Notes   : Proxy fallback ON · Service Worker ON · Source maps ON" -ForegroundColor DarkGray
        Write-Host "Stop    : Ctrl+C" -ForegroundColor DarkGray
        Write-Host ""

        if (-not $NoBrowser) {
            # Give Vite ~2 s to start before launching browser
            $job = Start-Job {
                Start-Sleep 2
                Start-Process $using:Url
            }
        }

        npx vite
    }

    "preview" {
        $Url = "http://localhost:4173/FamilyDashBoard/"
        Write-Host ""
        Write-Host "=== FamilyDashBoard — PRODUCTION PREVIEW ===" -ForegroundColor Cyan
        Write-Host "Mode    : Build -> serve (exact GitHub Pages replica)" -ForegroundColor White
        Write-Host "URL     : $Url" -ForegroundColor Green
        Write-Host "Notes   : Proxy fallback OFF · Service Worker ON · Minified bundle" -ForegroundColor DarkGray
        Write-Host ""
        Write-Host "Step 1/2  Building..." -ForegroundColor Yellow

        npm run build
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Build failed — fix errors before previewing." -ForegroundColor Red
            exit 1
        }

        Write-Host ""
        Write-Host "Step 2/2  Starting preview server..." -ForegroundColor Yellow
        Write-Host "URL     : $Url" -ForegroundColor Green
        Write-Host "Stop    : Ctrl+C" -ForegroundColor DarkGray
        Write-Host ""

        if (-not $NoBrowser) {
            $job = Start-Job {
                Start-Sleep 2
                Start-Process $using:Url
            }
        }

        npx vite preview
    }
}
