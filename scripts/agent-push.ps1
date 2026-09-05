param(
    [string]$ShopPath,
    [string[]]$Files,
    [switch]$All,
    [switch]$SkipGit,
    [string]$GitRepoPath,
    [string]$GitRemote,
    [string]$GitBranch,
    [string]$GitCommitMessage
)

. "$PSScriptRoot/common.ps1"

# --- Auto-detect shop từ thư mục shops/ dùng _haravan-backup.json ---
$shopsRoot = Join-Path $script:ProjectRoot "shops"
$shopDir = $null
$meta = $null

if ($ShopPath) {
    $resolvedShopPath = (Resolve-Path -LiteralPath $ShopPath -ErrorAction Stop).Path
    $shopsRootPrefix = [System.IO.Path]::GetFullPath($shopsRoot).TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
    $resolvedShopFullPath = [System.IO.Path]::GetFullPath($resolvedShopPath)
    if (-not $resolvedShopFullPath.StartsWith($shopsRootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "ShopPath phải nằm trực tiếp trong thư mục shops/."
    }
    if (-not (Test-Path -LiteralPath $resolvedShopFullPath -PathType Container)) {
        throw "Không tìm thấy ShopPath: $resolvedShopFullPath"
    }

    $backupMeta = Join-Path $resolvedShopFullPath "_haravan-backup.json"
    $cliLocal = Join-Path $resolvedShopFullPath ".haravan-cli_local.json"
    if (Test-Path -LiteralPath $backupMeta -PathType Leaf) {
        $meta = Get-Content -LiteralPath $backupMeta -Raw | ConvertFrom-Json
    } elseif (Test-Path -LiteralPath $cliLocal -PathType Leaf) {
        $cfg = Get-Content -LiteralPath $cliLocal -Raw | ConvertFrom-Json
        $meta = [PSCustomObject]@{
            orgId = [string]$cfg.org_id
            themeId = [string]$cfg.theme_id
            themeName = [string]$cfg.theme_name
        }
    }
    if (-not $meta -or -not $meta.orgId -or -not $meta.themeId) {
        throw "ShopPath không có metadata Haravan hợp lệ."
    }
    $shopDir = $resolvedShopFullPath
} else {
    foreach ($dir in Get-ChildItem -LiteralPath $shopsRoot -Directory) {
        if ($dir.Name.StartsWith(".")) { continue }
        $backupMeta = Join-Path $dir.FullName "_haravan-backup.json"
        if (Test-Path -LiteralPath $backupMeta -PathType Leaf) {
            try {
                $meta = Get-Content -LiteralPath $backupMeta -Raw | ConvertFrom-Json
                if ($meta.orgId -and $meta.themeId) {
                    $shopDir = $dir.FullName
                    break
                }
            } catch {}
        }
        # Fallback sang .haravan-cli_local.json
        $cliLocal = Join-Path $dir.FullName ".haravan-cli_local.json"
        if (Test-Path -LiteralPath $cliLocal -PathType Leaf) {
            try {
                $cfg = Get-Content -LiteralPath $cliLocal -Raw | ConvertFrom-Json
                if ($cfg.theme_id) {
                    $meta = [PSCustomObject]@{
                        orgId = [string]$cfg.org_id
                        themeId = [string]$cfg.theme_id
                        themeName = [string]$cfg.theme_name
                    }
                    $shopDir = $dir.FullName
                    break
                }
            } catch {}
        }
    }
}

if (-not $shopDir) {
    throw "Không tìm thấy shop nào trong thư mục shops/. Hãy chạy 'Haravan: Start' để cấu hình shop."
}

$shop = [PSCustomObject]@{
    Path      = $shopDir
    OrgId     = [string]$meta.orgId
    ThemeId   = [string]$meta.themeId
    ThemeName = if ($meta.PSObject.Properties["themeName"]) { [string]$meta.themeName } else { $meta.themeId }
    Email     = Get-HaravanAccountEmail -OrgId ([string]$meta.orgId)
}

Write-Host ""
Write-Host "Shop: $($shop.ThemeName)  |  Org: $($shop.OrgId)  |  Theme: $($shop.ThemeId)"
Write-Host ""

function Resolve-AgentPushFiles {
    param(
        [Parameter(Mandatory = $true)]$Shop,
        [string[]]$RequestedFiles,
        [switch]$PushAll
    )

    $themeDirectories = @(Get-ThemeContentDirectoryNames)
    if ($PushAll) {
        return @((Get-ThemeFileHashMap -RootPath $Shop.Path).Keys |
            Where-Object { $_ -notmatch '^config/[^/]+\.json$' } |
            Sort-Object)
    }

    $tokens = @(
        $RequestedFiles |
            ForEach-Object { [regex]::Split([string]$_, '[,\r\n]+') } |
            ForEach-Object { ([string]$_).Trim() } |
            Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    )
    if ($tokens.Count -eq 0) {
        throw (
            "Không có file được chọn. Hãy truyền -Files " +
            "templates/product.liquid,assets/product_style.scss.liquid; " +
            "chỉ dùng -All khi thật sự muốn push toàn theme."
        )
    }

    $shopRoot = [System.IO.Path]::GetFullPath($Shop.Path).TrimEnd('\', '/')
    $shopPrefix = $shopRoot + [System.IO.Path]::DirectorySeparatorChar
    $resolvedPaths = @()
    foreach ($token in $tokens) {
        if ([System.IO.Path]::IsPathRooted($token)) {
            $resolvedFullPath = (Resolve-Path -LiteralPath $token -ErrorAction Stop).Path
            $resolvedFullPath = [System.IO.Path]::GetFullPath($resolvedFullPath)
            if (-not $resolvedFullPath.StartsWith($shopPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
                throw "File phải nằm trong shop theme: $token"
            }
            $relativePath = $resolvedFullPath.Substring($shopPrefix.Length)
        } else {
            $relativePath = $token
        }

        $relativePath = ($relativePath -replace '\\', '/').TrimStart('/')
        if ($relativePath -match '(^|/)\.\.(/|$)') {
            throw "Đường dẫn file không hợp lệ: $token"
        }
        $topLevelDirectory = ($relativePath -split '/')[0]
        if ($topLevelDirectory -notin $themeDirectories) {
            throw "Chỉ được push file trong assets/config/layout/locales/snippets/templates: $token"
        }

        if ($relativePath -match '^config/[^/]+\.json$') {
            $skipMessage = (
                "Bỏ qua file local-only không được Haravan CLI upload: {0}. " +
                "CLI chỉ nhận config/**/*.html; hãy chỉnh file này trong Haravan Admin " +
                "nếu cần đồng bộ cấu hình Theme Editor."
            ) -f $relativePath
            Write-Warning $skipMessage
            continue
        }

        $localPath = Join-Path $Shop.Path ($relativePath -replace '/', [System.IO.Path]::DirectorySeparatorChar)
        if (-not (Test-Path -LiteralPath $localPath -PathType Leaf)) {
            throw "Không tìm thấy file theme: $localPath"
        }
        $resolvedPaths += $relativePath
    }

    return @($resolvedPaths | Sort-Object -Unique)
}

if ($All -and @($Files).Count -gt 0) {
    throw "Không thể dùng đồng thời -All và -Files."
}

$targetPaths = @(Resolve-AgentPushFiles -Shop $shop -RequestedFiles $Files -PushAll:$All)
if ($targetPaths.Count -eq 0) {
    throw "Không có file theme hợp lệ để push."
}
$scopeLabel = if ($All) { "toàn theme" } else { "file đã chọn" }
Write-Host (
    "Phạm vi push: {0} ({1} file)" -f $scopeLabel, $targetPaths.Count
)

# --- Đảm bảo .haravan-cli_local.json tồn tại ---
$cliLocalPath = Join-Path $shop.Path ".haravan-cli_local.json"
if (-not (Test-Path -LiteralPath $cliLocalPath -PathType Leaf)) {
    $cliConfig = [ordered]@{
        org_id     = $shop.OrgId
        theme_id   = $shop.ThemeId
        theme_name = $shop.ThemeName
    } | ConvertTo-Json -Compress
    Set-Content -LiteralPath $cliLocalPath -Value $cliConfig -Encoding UTF8
    Write-Host "    Đã tạo .haravan-cli_local.json"
}

# --- 1. Tạo backup ---
Write-Host "==> Tạo bản backup trước khi push..."
$backupParams = @{
    Shop   = $shop
    Reason = if ($All) { "before-agent-push-full" } else { "before-agent-push-selected" }
    Force  = $true
}
if (-not $All) {
    $backupParams.RelativePaths = $targetPaths
}
$backup = New-ThemeBackup @backupParams
$sizeMb = [Math]::Round($backup.SizeBytes / 1MB, 2)
Write-Host "    Backup OK: $([System.IO.Path]::GetFileName($backup.Path)) ($sizeMb MB)"

# --- 2. Push đúng các file đã chọn lên remote ---
Write-Host ""
Write-Host "==> Đang push code lên Haravan remote..."
$pushedFiles = @()
$failedFiles = @()
foreach ($relativePath in $targetPaths) {
    try {
        $pushOutput = @(Invoke-HaravanCaptureAt `
            -WorkingDirectory $shop.Path `
            "theme" "push-only" $relativePath)
        $pushText = $pushOutput -join "`n"
        if ((Test-HaravanThemeCommandFailure -Lines $pushOutput) -or
            $pushText -notmatch "(?i)file pushed successfully") {
            throw "Haravan CLI không xác nhận push thành công."
        }
        $pushedFiles += $relativePath
    } catch {
        Write-Warning "Push thất bại: $relativePath - $($_.Exception.Message)"
        $failedFiles += $relativePath
    }
}

Write-Host ""
Write-Host "=== BÁO CÁO KẾT QUẢ PUSH ==="
if ($pushedFiles.Count -gt 0) {
    Write-Host "Các file ĐÃ PUSH THÀNH CÔNG ($($pushedFiles.Count)):" -ForegroundColor Green
    foreach ($f in $pushedFiles) {
        Write-Host " - [OK] $f" -ForegroundColor Green
    }
}
if ($failedFiles.Count -gt 0) {
    Write-Host "Các file CHƯA PUSH ĐƯỢC / BỎ QUA ($($failedFiles.Count)):" -ForegroundColor Yellow
    foreach ($f in $failedFiles) {
        Write-Host " - [CHƯA PUSH] $f" -ForegroundColor Yellow
    }
}

if ($pushedFiles.Count -gt 0) {
    Write-Host ""
    if ($SkipGit) {
        Write-Host "==> Bỏ qua lưu Git theo tham số -SkipGit."
    } else {
        Write-Host "==> Lưu các file đã push vào Git..."
        $gitArchiveParams = @{
            Shop          = $shop
            RelativePaths = @($pushedFiles)
        }
        if (-not [string]::IsNullOrWhiteSpace($GitRepoPath)) {
            $gitArchiveParams.RepositoryPath = $GitRepoPath
        }
        if (-not [string]::IsNullOrWhiteSpace($GitRemote)) {
            $gitArchiveParams.Remote = $GitRemote
        }
        if (-not [string]::IsNullOrWhiteSpace($GitBranch)) {
            $gitArchiveParams.Branch = $GitBranch
        }
        if (-not [string]::IsNullOrWhiteSpace($GitCommitMessage)) {
            $gitArchiveParams.CommitMessage = $GitCommitMessage
        }

        $gitArchive = Invoke-HaravanGitArchive @gitArchiveParams
        switch ($gitArchive.Status) {
            "Pushed" {
                Write-Host (
                    "Git archive OK: {0} file(s), commit {1}, {2}/{3}" -f
                    @($gitArchive.Paths).Count,
                    $gitArchive.CommitId,
                    $gitArchive.Remote,
                    $gitArchive.Branch
                ) -ForegroundColor Green
            }
            "NoChanges" {
                Write-Host "Git archive: không có thay đổi mới để commit."
            }
            "CommittedNoRemote" {
                Write-Warning (
                    "Đã commit Git {0} nhưng chưa push remote. Cấu hình remote rồi " +
                    "chạy lại agent:push nếu cần." -f $gitArchive.CommitId
                )
            }
            "CommittedNoBranch" {
                Write-Warning (
                    "Đã commit Git {0} nhưng chưa push vì detached HEAD." -f
                    $gitArchive.CommitId
                )
            }
            "CommittedNoPush" {
                Write-Host (
                    "Git commit OK: {0}; git push đang tắt trong cấu hình." -f
                    $gitArchive.CommitId
                )
            }
            "Disabled" {
                Write-Host "Bỏ qua lưu Git vì git.enabled=false trong .haravan-workflow.json."
            }
            "GitUnavailable" {
                Write-Warning "Không thể lưu Git vì Git chưa sẵn sàng trên máy."
            }
            "NoRepository" {
                Write-Warning "Không có Git repository; code Haravan vẫn đã push thành công."
            }
            "Failed" {
                Write-Warning "Lưu/push Git không hoàn tất; code Haravan vẫn đã push thành công."
            }
            default {
                Write-Warning "Lưu Git trả về trạng thái không xác định: $($gitArchive.Status)"
            }
        }
    }
}
Write-Host ""
