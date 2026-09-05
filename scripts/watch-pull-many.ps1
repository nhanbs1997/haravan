param(
    [string]$UrlFile = ""
)

$projectRoot = Split-Path -Parent $PSScriptRoot
$pullScript = Join-Path $PSScriptRoot "pull-many-shops.ps1"
if ([string]::IsNullOrWhiteSpace($UrlFile)) {
    $UrlFile = Join-Path $projectRoot "urls.txt"
}

if (-not (Test-Path -LiteralPath $UrlFile -PathType Leaf)) {
    New-Item -ItemType File -Path $UrlFile -Force | Out-Null
}

function Get-UrlFileFingerprint {
    param([Parameter(Mandatory = $true)][string]$Path)

    try {
        $content = Get-Content -LiteralPath $Path -Raw -ErrorAction Stop
    } catch {
        return ""
    }

    $hasUrl = @(
        $content -split "`r?`n" | Where-Object {
            $line = ([string]$_).Trim()
            -not [string]::IsNullOrWhiteSpace($line) -and -not $line.StartsWith("#")
        }
    ).Count -gt 0
    if (-not $hasUrl) {
        return "EMPTY"
    }

    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($content)
        return ([System.BitConverter]::ToString($sha256.ComputeHash($bytes))).Replace("-", "")
    } finally {
        $sha256.Dispose()
    }
}

$resolvedUrlFile = (Resolve-Path -LiteralPath $UrlFile).Path
$lastFingerprint = ""

Write-Host "Theo dõi file URL: $resolvedUrlFile"
Write-Host "Mỗi lần lưu URL mới vào file, workflow sẽ tự pull tuần tự."
Write-Host "Nhấn Ctrl+C để dừng watcher."
Write-Host ""

while ($true) {
    $fingerprint = Get-UrlFileFingerprint -Path $resolvedUrlFile

    if ($fingerprint -ne "" -and
        $fingerprint -ne "EMPTY" -and
        $fingerprint -ne $lastFingerprint) {
        # Chờ file ổn định sau thao tác Save của editor/Google Drive.
        Start-Sleep -Milliseconds 800
        $stableFingerprint = Get-UrlFileFingerprint -Path $resolvedUrlFile
        if ($stableFingerprint -eq $fingerprint) {
            $lastFingerprint = $fingerprint
            Write-Host ""
            Write-Host "Phát hiện danh sách URL mới, bắt đầu batch pull..." -ForegroundColor Cyan
            & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $pullScript -UrlFile $resolvedUrlFile
            if ($LASTEXITCODE -ne 0) {
                Write-Warning "Batch pull kết thúc với exit code $LASTEXITCODE. Sửa urls.txt rồi lưu lại để thử lại."
            } else {
                Write-Host "Batch pull hoàn tất. Đang tiếp tục theo dõi urls.txt." -ForegroundColor Green
            }
        }
    }

    Start-Sleep -Seconds 1
}
