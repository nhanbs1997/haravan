. "$PSScriptRoot/../scripts/common.ps1"
$shopsPath = Join-Path $script:ProjectRoot "shops"
if (Test-Path -LiteralPath $shopsPath) {
    Get-ChildItem -LiteralPath $shopsPath -Directory | Where-Object { $_.Name -notlike ".*" } | ForEach-Object {
        Write-Host "Removing: $($_.Name)"
        $dirPath = $_.FullName
        
        # Reset ReadOnly attributes on all sub-items
        try {
            Get-ChildItem -LiteralPath $dirPath -Recurse -Force -ErrorAction SilentlyContinue | ForEach-Object {
                if ($_.Attributes -match "ReadOnly") {
                    $_.Attributes = "Normal"
                }
            }
        } catch {}

        $removed = Remove-HaravanDirectorySafely -Path $dirPath -AllowedRoot $shopsPath
        if (-not $removed) {
            # If Google Drive locks the directory, move it aside so shops/ is immediately clean
            $stale = Move-HaravanDirectoryAsideSafely -Path $dirPath -AllowedRoot $shopsPath
            if ($stale) {
                Remove-HaravanDirectorySafely -Path $stale -AllowedRoot $shopsPath | Out-Null
            } else {
                Write-Warning "Could not remove locked directory immediately: $($_.Name)"
            }
        }
    }
}
Write-Host "Done clearing shops directory."
