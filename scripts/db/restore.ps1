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

function Remove-PrismaSchemaParam([string]$url, [string]$overrideDb) {
  if (-not $url) { return $url }
  $u = [System.UriBuilder]$url
  if ($overrideDb) { $u.Path = "/$overrideDb" }
  if ($u.Query) {
    $pairs = ($u.Query.TrimStart('?') -split '&') | Where-Object { $_ -and ($_ -notmatch '^schema=') }
    $u.Query = ($pairs -join '&')
  }
  return $u.Uri.AbsoluteUri
}

function Find-PostgresBinary([string]$exeName) {
  $cmd = Get-Command $exeName -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  foreach ($ver in @("17", "16", "15", "14", "13")) {
    $candidate = "C:\Program Files\PostgreSQL\$ver\bin\${exeName}.exe"
    if (Test-Path $candidate) { return $candidate }
  }
  return $null
}

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
$pgRestoreExe = Find-PostgresBinary "pg_restore"
$psqlExe = Find-PostgresBinary "psql"
$isPlainSql = $BackupFile.ToLowerInvariant().EndsWith(".sql")

$dockerRunning = $false

if ($dockerCmd) {
  $runningNames = & docker ps --format "{{.Names}}" 2>$null
  if ($runningNames -contains $ContainerName) {
    $dockerRunning = $true
  }
}

if ($dockerRunning) {
  $tmpInside = "/tmp/viewora_restore_$PID$(if ($isPlainSql) { '.sql' } else { '.dump' })"
  & docker cp $BackupFile "${ContainerName}:${tmpInside}"
  if ($isPlainSql) {
    & docker exec -e "PGPASSWORD=$($env:POSTGRES_ADMIN_PASSWORD)" $ContainerName `
      psql -v ON_ERROR_STOP=1 -U $AdminUser -d $TargetDb -f $tmpInside
  } else {
    & docker exec -e "PGPASSWORD=$($env:POSTGRES_ADMIN_PASSWORD)" $ContainerName `
      pg_restore -U $AdminUser -d $TargetDb --clean --if-exists --no-owner --no-acl $tmpInside
  }
  $code = $LASTEXITCODE
  & docker exec $ContainerName rm -f $tmpInside | Out-Null
  if ($code -ne 0) { throw "docker exec restore failed with exit code $code" }
}
elseif ($isPlainSql -and $psqlExe) {
  $rawUrl = if ($env:DATABASE_ADMIN_URL) { $env:DATABASE_ADMIN_URL } else { $env:DATABASE_URL }
  if ($rawUrl -and -not $env:POSTGRES_ADMIN_PASSWORD) {
    $cleanUrl = Remove-PrismaSchemaParam $rawUrl $TargetDb
    & $psqlExe --dbname=$cleanUrl -v ON_ERROR_STOP=1 -f $BackupFile
  } else {
    $env:PGPASSWORD = $env:POSTGRES_ADMIN_PASSWORD
    $pgHost = if ($env:POSTGRES_HOST) { $env:POSTGRES_HOST } else { "127.0.0.1" }
    $pgPort = if ($env:POSTGRES_PORT) { $env:POSTGRES_PORT } else { "5432" }
    & $psqlExe -h $pgHost -p $pgPort -U $AdminUser -d $TargetDb -v ON_ERROR_STOP=1 -f $BackupFile
  }
  if ($LASTEXITCODE -ne 0) { throw "psql plain-SQL restore failed with exit code $LASTEXITCODE" }
}
elseif ($pgRestoreExe) {
  $rawUrl = if ($env:DATABASE_ADMIN_URL) { $env:DATABASE_ADMIN_URL } else { $env:DATABASE_URL }
  if ($rawUrl -and -not $env:POSTGRES_ADMIN_PASSWORD) {
    $cleanUrl = Remove-PrismaSchemaParam $rawUrl $TargetDb
    & $pgRestoreExe --dbname=$cleanUrl --clean --if-exists --no-owner --no-acl $BackupFile
  } else {
    $env:PGPASSWORD = $env:POSTGRES_ADMIN_PASSWORD
    $pgHost = if ($env:POSTGRES_HOST) { $env:POSTGRES_HOST } else { "127.0.0.1" }
    $pgPort = if ($env:POSTGRES_PORT) { $env:POSTGRES_PORT } else { "5432" }
    & $pgRestoreExe -h $pgHost -p $pgPort -U $AdminUser -d $TargetDb --clean --if-exists --no-owner --no-acl $BackupFile
  }
  if ($LASTEXITCODE -ne 0) { throw "pg_restore failed with exit code $LASTEXITCODE" }
}
else {
  throw "Neither running Docker container '$ContainerName' nor local 'pg_restore'/'psql' (PATH or C:\Program Files\PostgreSQL\<ver>\bin) was found."
}

Write-Host "[Viewora Restore] Completed restore into '$TargetDb'."
