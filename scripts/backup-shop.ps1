. "$PSScriptRoot/common.ps1"

$shop = Select-ShopProject

Write-Host ""
Write-Host "Creating local backup"
Write-Host "Shop: $($shop.ThemeName)"
Write-Host "Organization: $($shop.OrgId)"
Write-Host "Theme: $($shop.ThemeId)"
Write-Host ""

$backup = New-ThemeBackup -Shop $shop -Reason "manual" -Force
$sizeMb = [Math]::Round($backup.SizeBytes / 1MB, 2)

Write-Host "Backup created successfully."
Write-Host "Files: $($backup.FileCount)"
Write-Host "Size: $sizeMb MB"
Write-Host "Path: $($backup.Path)"
