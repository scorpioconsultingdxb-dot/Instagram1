#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Creates a timestamped PostgreSQL custom-format backup for Viewora with SHA-256 checksum
  and configurable retention pruning.
#>
param(
  [string]$BackupDir = $(if ($env:BACKUP_DIR) { $env:BACKUP_DIR } else { "./backups" }),
  [int]$RetentionDays = $(if ($env:BACKUP_RETENTION_DAYS) { [int]$env:BACKUP_RETENTION_DAYS } else { 14 }),
  [string]$ContainerName = $(if ($env:POSTGRES_CONTAINER) { $env:POSTGRES_CONTAINER } else { "viewora-postgres" }),
  [string]$DatabaseName = $(if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "viewora" }),
  [string]$AdminUser = $(if ($env:POSTGRES_ADMIN_USER) { $env:POSTGRES_ADMIN_USER } else { "viewora_admin" })
)

$ErrorActionPreference = "Stop"

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
$timestamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
$outFile = Join-Path $BackupDir "viewora_${DatabaseName}_${timestamp}.dump"

Write-Host "[Viewora Backup] Starting PostgreSQL backup for database '$DatabaseName'..."

$dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
$pgDumpCmd = Get-Command pg_dump -ErrorAction SilentlyContinue
$pgDumpExe = if ($pgDumpCmd) { $pgDumpCmd.Source } else { $null }

if (-not $pgDumpExe) {
  foreach ($ver in @("17", "16", "15", "14", "13")) {
    $candidate = "C:\Program Files\PostgreSQL\$ver\bin\pg_dump.exe"
    if (Test-Path $candidate) {
      $pgDumpExe = $candidate
      break
    }
  }
}

$dockerRunning = $false

if ($dockerCmd) {
  $runningNames = & docker ps --format "{{.Names}}" 2>$null
  if ($runningNames -contains $ContainerName) {
    $dockerRunning = $true
  }
}

if ($dockerRunning) {
  $tmpInside = "/tmp/viewora_backup_${timestamp}.dump"
  & docker exec -e "PGPASSWORD=$($env:POSTGRES_ADMIN_PASSWORD)" $ContainerName `
    pg_dump -U $AdminUser -d $DatabaseName -Fc --no-owner --no-acl -f $tmpInside
  if ($LASTEXITCODE -ne 0) { throw "docker exec pg_dump failed with exit code $LASTEXITCODE" }
  & docker cp "${ContainerName}:${tmpInside}" $outFile
  & docker exec $ContainerName rm -f $tmpInside | Out-Null
}
elseif ($pgDumpExe) {
  $connUrl = if ($env:DATABASE_ADMIN_URL) { $env:DATABASE_ADMIN_URL } else { $env:DATABASE_URL }
  if ($connUrl) {
    & $pgDumpExe $connUrl -Fc --no-owner --no-acl -f $outFile
  } else {
    $env:PGPASSWORD = $env:POSTGRES_ADMIN_PASSWORD
    $pgHost = if ($env:POSTGRES_HOST) { $env:POSTGRES_HOST } else { "127.0.0.1" }
    $pgPort = if ($env:POSTGRES_PORT) { $env:POSTGRES_PORT } else { "5432" }
    & $pgDumpExe -h $pgHost -p $pgPort -U $AdminUser -d $DatabaseName -Fc --no-owner --no-acl -f $outFile
  }
  if ($LASTEXITCODE -ne 0) { throw "pg_dump failed with exit code $LASTEXITCODE" }
}
else {
  throw "Neither running Docker container '$ContainerName' nor local 'pg_dump' (PATH or C:\Program Files\PostgreSQL\<ver>\bin) was found."
}

if (-not (Test-Path $outFile) -or (Get-Item $outFile).Length -eq 0) {
  if (Test-Path $outFile) { Remove-Item -Force $outFile }
  throw "Backup file is empty; aborting."
}

$hash = (Get-FileHash -Path $outFile -Algorithm SHA256).Hash.ToLowerInvariant()
"$hash  $(Split-Path -Leaf $outFile)" | Set-Content -Path "${outFile}.sha256" -Encoding ASCII
Write-Host "[Viewora Backup] Created: $outFile (SHA-256: $hash)"

if ($RetentionDays -gt 0) {
  $cutoff = (Get-Date).AddDays(-$RetentionDays)
  Get-ChildItem -Path $BackupDir -Filter "viewora_*.dump*" |
    Where-Object { $_.LastWriteTime -lt $cutoff } |
    Remove-Item -Force
  Write-Host "[Viewora Backup] Pruned backups older than $RetentionDays days."
}
