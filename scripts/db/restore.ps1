#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Safely restores a Viewora PostgreSQL custom-format .dump backup after SHA-256 verification.
  Requires -ConfirmRestore to prevent accidental data loss.
#>
param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile,
  [string]$TargetDb = $(if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "viewora" }),
  [switch]$ConfirmRestore,
  [string]$ContainerName = $(if ($env:POSTGRES_CONTAINER) { $env:POSTGRES_CONTAINER } else { "viewora-postgres" }),
  [string]$AdminUser = $(if ($env:POSTGRES_ADMIN_USER) { $env:POSTGRES_ADMIN_USER } else { "viewora_admin" })
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $BackupFile)) {
  throw "Backup file not found: $BackupFile"
}

if (-not $ConfirmRestore) {
  Write-Error "SAFETY BLOCK: Restoring overwrites objects in '$TargetDb'. Re-run with -ConfirmRestore (test first with -TargetDb viewora_test)."
  exit 2
}

$checksumFile = "${BackupFile}.sha256"
if (Test-Path $checksumFile) {
  Write-Host "[Viewora Restore] Verifying SHA-256 checksum..."
  $expected = ((Get-Content $checksumFile -Raw).Trim() -split "\s+")[0].ToLowerInvariant()
  $actual = (Get-FileHash -Path $BackupFile -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($expected -ne $actual) {
    throw "Checksum mismatch! Expected $expected but got $actual. Aborting restore."
  }
}

Write-Host "[Viewora Restore] Restoring '$BackupFile' into '$TargetDb'..."

$dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
$pgRestoreCmd = Get-Command pg_restore -ErrorAction SilentlyContinue
$dockerRunning = $false

if ($dockerCmd) {
  $runningNames = & docker ps --format "{{.Names}}" 2>$null
  if ($runningNames -contains $ContainerName) {
    $dockerRunning = $true
  }
}

if ($dockerRunning) {
  $tmpInside = "/tmp/viewora_restore_$PID.dump"
  & docker cp $BackupFile "${ContainerName}:${tmpInside}"
  & docker exec -e "PGPASSWORD=$($env:POSTGRES_ADMIN_PASSWORD)" $ContainerName `
    pg_restore -U $AdminUser -d $TargetDb --clean --if-exists --no-owner --no-acl $tmpInside
  $code = $LASTEXITCODE
  & docker exec $ContainerName rm -f $tmpInside | Out-Null
  if ($code -ne 0) { throw "docker exec pg_restore failed with exit code $code" }
}
elseif ($pgRestoreCmd) {
  $env:PGPASSWORD = $env:POSTGRES_ADMIN_PASSWORD
  $pgHost = if ($env:POSTGRES_HOST) { $env:POSTGRES_HOST } else { "127.0.0.1" }
  $pgPort = if ($env:POSTGRES_PORT) { $env:POSTGRES_PORT } else { "5432" }
  & pg_restore -h $pgHost -p $pgPort -U $AdminUser -d $TargetDb --clean --if-exists --no-owner --no-acl $BackupFile
  if ($LASTEXITCODE -ne 0) { throw "pg_restore failed with exit code $LASTEXITCODE" }
}
else {
  throw "Neither running Docker container '$ContainerName' nor local 'pg_restore' was found."
}

Write-Host "[Viewora Restore] Completed restore into '$TargetDb'."
