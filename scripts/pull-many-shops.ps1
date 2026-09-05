param(
    [string]$UrlFile
)

. "$PSScriptRoot/common.ps1"

if ([string]::IsNullOrWhiteSpace($UrlFile)) {
    $defaultUrlFile = Join-Path $script:ProjectRoot "urls.txt"
    if (Test-Path -LiteralPath $defaultUrlFile -PathType Leaf) {
        $UrlFile = $defaultUrlFile
    }
}

function Get-BatchUrls {
    param([string]$SourceFile)

    $urls = @()
    if (-not [string]::IsNullOrWhiteSpace($SourceFile)) {
        $resolvedFile = (Resolve-Path -LiteralPath $SourceFile -ErrorAction Stop).Path
        $urls = @(Get-Content -LiteralPath $resolvedFile | ForEach-Object {
            $line = ([string]$_).Trim()
            if (-not [string]::IsNullOrWhiteSpace($line) -and -not $line.StartsWith("#")) {
                $line
            }
        })
    } else {
        Write-Host "Dán từng URL website, mỗi dòng một URL."
        Write-Host "Nhấn Enter ở dòng trống để bắt đầu pull."
        while ($true) {
            $line = (Read-Host ("URL {0}" -f ($urls.Count + 1))).Trim()
            if ([string]::IsNullOrWhiteSpace($line)) {
                break
            }
            $urls += $line
        }
    }

    return @(
        $urls |
            ForEach-Object { ([string]$_).Trim() } |
            Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
            Select-Object -Unique
    )
}

function ConvertTo-ThemeSourceUrl {
    param([Parameter(Mandatory = $true)][string]$Url)

    $value = $Url.Trim()
    if ($value -notmatch '^https?://') {
        $value = "https://$value"
    }

    try {
        $uri = [System.Uri]$value
    } catch {
        throw "URL không hợp lệ: $Url"
    }

    if ([string]::IsNullOrWhiteSpace($uri.Host)) {
        throw "URL không có hostname: $Url"
    }

    # URL ticket thường có /admin. Public homepage giúp lấy CDN theme id ổn định hơn.
    return "{0}://{1}/" -f $uri.Scheme, $uri.Host
}

$urls = @(Get-BatchUrls -SourceFile $UrlFile)
if ($urls.Count -eq 0) {
    throw "Chưa có URL nào để pull."
}

Write-Host ""
Write-Host ("Đã nhận {0} URL. Workflow sẽ xử lý tuần tự, không tự lưu mật khẩu." -f $urls.Count)
Write-Host ""

$results = @()
for ($index = 0; $index -lt $urls.Count; $index++) {
    $originalUrl = $urls[$index]
    $sourceUrl = $null
    $detected = $null

    Write-Host ""
    Write-Host ("===== [{0}/{1}] {2} =====" -f ($index + 1), $urls.Count, $originalUrl)

    try {
        $sourceUrl = ConvertTo-ThemeSourceUrl -Url $originalUrl
        $detected = Get-ShopIdsFromUrl -Url $sourceUrl

        if (-not (Ensure-HaravanOrganizationLogin `
            -OrgId $detected.OrgId `
            -SourceUrl $originalUrl)) {
            $results += [PSCustomObject]@{
                Url = $originalUrl
                OrgId = $detected.OrgId
                ThemeId = $detected.ThemeId
                Status = "Skipped - chưa login"
            }
            continue
        }

        $existingShop = @(
            Get-ShopProjects | Where-Object {
                $_.OrgId -eq $detected.OrgId -and $_.ThemeId -eq $detected.ThemeId
            }
        )
        if ($existingShop.Count -gt 0 -and (Test-HaravanThemeContent -RootPath $existingShop[0].Path)) {
            $backup = New-ThemeBackup -Shop $existingShop[0] -Reason "before-batch-pull"
            Write-Host "Backup trước pull: $($backup.Path)"
        }

        Write-Host (
            "Pull theme {0} thuộc Organization {1}..." -f
                $detected.ThemeId, $detected.OrgId
        )

        & (Join-Path $PSScriptRoot "add-shop.ps1") -Url $sourceUrl
        if ($LASTEXITCODE -ne 0) {
            throw "add-shop.ps1 kết thúc với exit code $LASTEXITCODE."
        }

        $results += [PSCustomObject]@{
            Url = $originalUrl
            OrgId = $detected.OrgId
            ThemeId = $detected.ThemeId
            Status = "Pulled"
        }
    } catch {
        Write-Warning ("Pull thất bại cho {0}: {1}" -f $originalUrl, $_.Exception.Message)
        $results += [PSCustomObject]@{
            Url = $originalUrl
            OrgId = if ($detected) { $detected.OrgId } else { "" }
            ThemeId = if ($detected) { $detected.ThemeId } else { "" }
            Status = "Failed: $($_.Exception.Message)"
        }
    }
}

Write-Host ""
Write-Host "===== KẾT QUẢ BATCH PULL ====="
$results | Format-Table -AutoSize
Write-Host "Hoàn tất. Không chạy theme dev và không push code."
