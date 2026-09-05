. "$PSScriptRoot/common.ps1"

$shop = Select-ShopProject

Write-Host ""
Write-Host "Pulling latest remote theme"
Write-Host "Shop: $($shop.ThemeName)"
Write-Host "Account: $($shop.Email)"
Write-Host "Organization: $($shop.OrgId)"
Write-Host "Theme: $($shop.ThemeId)"
Write-Host "Local files changed on the remote will be overwritten."
Write-Host ""

$backup = $null
try {
    $backup = New-ThemeBackup -Shop $shop -Reason "before-pull"
    $backupStatus = if ($backup.WasCreated) { "created" } else { "reused" }
    Write-Host "Automatic backup ($backupStatus): $($backup.Path)"
} catch {
    $latestBackup = @(Get-ThemeBackups -Shop $shop | Select-Object -First 1)
    if ($latestBackup.Count -eq 0) {
        throw
    }

    Write-Warning (
        "A fresh backup could not be created because the local Google Drive " +
        "theme is inaccessible or incomplete: $($_.Exception.Message)"
    )
    Write-Warning (
        "Pull will repair the local theme using the remote copy. " +
        "Existing safety backup: $($latestBackup[0].FullName)"
    )
}
Write-Host ""

$download = Invoke-HaravanThemeDownloadWithRelogin `
    -WorkingDirectory $shop.Path `
    -ThemeId $shop.ThemeId `
    -OrgId $shop.OrgId
Write-Host ""
if ($download.Partial) {
    Write-Warning "Remote theme pull was partial; the existing local theme was kept."
} elseif ($download.UsedFallback) {
    Write-Host "Latest remote theme downloaded with batch pull fallback."
} else {
    Write-Host "Latest remote theme downloaded."
}

$devBackup = New-ThemeBackup -Shop $shop -Reason "before-dev"
$devBackupStatus = if ($devBackup.WasCreated) { "created" } else { "reused" }
Write-Host "Backup before dev ($devBackupStatus): $($devBackup.Path)"
Write-Host ""
Write-Host "Editing latest remote code: $($shop.ThemeName)"
Write-Host "Saved files overwrite this remote theme. Press Ctrl+C to stop."
Write-Host ""

Invoke-HaravanAt -WorkingDirectory $shop.Path "theme" "dev"
