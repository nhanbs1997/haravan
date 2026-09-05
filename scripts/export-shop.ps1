. "$PSScriptRoot/common.ps1"

$shop = Select-ShopProject
$distDirectory = Join-Path $script:ProjectRoot "dist"
New-Item -ItemType Directory -Path $distDirectory -Force | Out-Null

$safeName = if ($shop.ThemeName) {
    $shop.ThemeName -replace '[^\p{L}\p{N}._-]+', '-'
} else {
    "org-$($shop.OrgId)"
}
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$outputPath = Join-Path $distDirectory "$safeName-$timestamp.zip"

Invoke-HaravanAt -WorkingDirectory $shop.Path "theme" "export" $outputPath
Write-Host "Release created: $outputPath"
