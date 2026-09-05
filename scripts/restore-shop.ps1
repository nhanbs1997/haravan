. "$PSScriptRoot/common.ps1"

$shop = Select-ShopProject
$backups = @(Get-ThemeBackups -Shop $shop)

if ($backups.Count -eq 0) {
    throw "No backup is available for Organization $($shop.OrgId), theme $($shop.ThemeId)."
}

Write-Host ""
Write-Host "Backups for $($shop.ThemeName)"
Write-Host "------------------------------"
for ($index = 0; $index -lt $backups.Count; $index++) {
    $backup = $backups[$index]
    $sizeMb = [Math]::Round($backup.Length / 1MB, 2)
    Write-Host ("[{0}] {1} | {2} MB | {3}" -f (
        $index + 1
    ), $backup.LastWriteTime.ToString("dd/MM/yyyy HH:mm:ss"), $sizeMb, $backup.Name)
}

$selection = Read-Host "Backup number [1]"
if ([string]::IsNullOrWhiteSpace($selection)) {
    $selection = "1"
}

$selectedIndex = 0
if (-not [int]::TryParse($selection, [ref]$selectedIndex) -or
    $selectedIndex -lt 1 -or $selectedIndex -gt $backups.Count) {
    throw "Invalid backup number: $selection"
}
$selectedBackup = $backups[$selectedIndex - 1]

Write-Host ""
Write-Host "Restore target:"
Write-Host "Organization: $($shop.OrgId)"
Write-Host "Theme: $($shop.ThemeId)"
Write-Host "Backup: $($selectedBackup.FullName)"
Write-Host ""
Write-Host "The current local theme will be backed up before restore."
Write-Host "Restored text files will be pushed to this remote theme."
$confirmation = Read-Host "Type RESTORE to continue"
if ($confirmation -cne "RESTORE") {
    Write-Host "Restore cancelled."
    exit 0
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
$stagingRoot = Join-Path ([System.IO.Path]::GetTempPath()) (
    "haravan-restore-" + [Guid]::NewGuid().ToString("N")
)
New-Item -ItemType Directory -Path $stagingRoot | Out-Null

try {
    [System.IO.Compression.ZipFile]::ExtractToDirectory(
        $selectedBackup.FullName,
        $stagingRoot
    )

    $manifestPath = Join-Path $stagingRoot "_haravan-backup.json"
    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
        throw "Invalid backup: _haravan-backup.json is missing."
    }
    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    if ([string]$manifest.orgId -ne [string]$shop.OrgId -or
        [string]$manifest.themeId -ne [string]$shop.ThemeId) {
        throw "This backup belongs to Organization $($manifest.orgId), theme $($manifest.themeId)."
    }
    if ([string]$manifest.scope -eq "selected") {
        throw (
            "Backup này chỉ chứa các file được chọn ($($manifest.fileCount) file), " +
            "không thể dùng để restore toàn bộ theme. Hãy chọn backup scope=full."
        )
    }

    $currentFiles = Get-ThemeFileHashMap -RootPath $shop.Path
    $backupFiles = Get-ThemeFileHashMap -RootPath $stagingRoot
    $changedFiles = @($backupFiles.Keys | Where-Object {
        -not $currentFiles.ContainsKey($_) -or $currentFiles[$_] -ne $backupFiles[$_]
    } | Sort-Object)
    $removedFiles = @($currentFiles.Keys | Where-Object {
        -not $backupFiles.ContainsKey($_)
    } | Sort-Object)

    $safetyBackup = New-ThemeBackup `
        -Shop $shop `
        -Reason "before-restore" `
        -Force
    Write-Host ""
    Write-Host "Safety backup: $($safetyBackup.Path)"

    foreach ($directoryName in Get-ThemeContentDirectoryNames) {
        $targetDirectory = Join-Path $shop.Path $directoryName
        $sourceDirectory = Join-Path $stagingRoot $directoryName

        if (Test-Path -LiteralPath $targetDirectory -PathType Container) {
            $removed = Remove-HaravanDirectorySafely `
                -Path $targetDirectory `
                -AllowedRoot $shop.Path `
                -MaxAttempts 8
            if (-not $removed) {
                throw (
                    "Could not replace local theme directory: $targetDirectory. " +
                    "Stop Haravan: Start, close files from this shop in VS Code, " +
                    "wait for Google Drive to finish syncing, and run restore again."
                )
            }
        }

        if (Test-Path -LiteralPath $sourceDirectory -PathType Container) {
            Copy-Item `
                -LiteralPath $sourceDirectory `
                -Destination $targetDirectory `
                -Recurse `
                -Force
        }
    }

    $pushFiles = @($changedFiles | Where-Object { Test-ThemeTextFile -RelativePath $_ })
    if ($pushFiles.Count -gt 0) {
        Write-Host ""
        Write-Host "Pushing restored text files to remote theme..."
        foreach ($relativePath in $pushFiles) {
            Write-Host "Restore: $relativePath"
            Invoke-HaravanAt -WorkingDirectory $shop.Path "theme" "push-only" $relativePath
        }
    }

    Write-Host ""
    Write-Host "Restore completed."
    Write-Host "Changed files restored: $($changedFiles.Count)"
    Write-Host "Extra local files removed: $($removedFiles.Count)"
    if ($removedFiles.Count -gt 0) {
        Write-Warning (
            "Haravan CLI has no direct delete command. If theme dev was not running " +
            "during restore, remove these extra remote files in Haravan Admin: " +
            ($removedFiles -join ", ")
        )
    }
} finally {
    if (Test-Path -LiteralPath $stagingRoot -PathType Container) {
        $stagingRemoved = Remove-HaravanDirectorySafely `
            -Path $stagingRoot `
            -AllowedRoot ([System.IO.Path]::GetTempPath()) `
            -MaxAttempts 6
        if (-not $stagingRemoved) {
            Write-Warning "Restore staging directory was left at: $stagingRoot"
        }
    }
}
