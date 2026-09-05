. "$PSScriptRoot/common.ps1"

function Select-ShopOrAdd {
    $projects = @(Get-ShopProjects)
    if ($projects.Count -eq 0) {
        Write-Host ""
        Write-Host "Chưa có shop nào được cấu hình trong workspace."
        $inputVal = Read-Host "Dán URL shop (vd: https://ten.myharavan.com/?themeid=-1) hoặc nhấn Enter để Login thêm shop"
        if ([string]::IsNullOrWhiteSpace($inputVal)) {
            return [PSCustomObject]@{ Action = "add"; Shop = $null; Url = "" }
        }
        return [PSCustomObject]@{ Action = "url"; Shop = $null; Url = $inputVal.Trim() }
    }

    Write-Host ""
    Write-Host "Haravan shops"
    Write-Host "-------------"
    for ($index = 0; $index -lt $projects.Count; $index++) {
        $shop = $projects[$index]
        Write-Host ("[{0}] {1} | {2} | org {3} | theme {4}" -f (
            $index + 1
        ), $shop.ThemeName, $shop.Email, $shop.OrgId, $shop.ThemeId)
    }
    Write-Host "[U] Nhập URL shop"
    Write-Host "[A] Login và thêm shop mới"

    $selection = Read-Host "Dán URL shop, chọn số [1], Org ID, Theme ID, hoặc A"
    if ([string]::IsNullOrWhiteSpace($selection)) {
        $selection = "1"
    }

    # Tự động nhận diện nếu người dùng dán trực tiếp URL shop
    if ($selection -match "^https?://" -or $selection -match "\.myharavan\.com" -or $selection -match "themeid=" -or $selection -match "^\w+\.com" -or $selection -match "^\w+\.vn") {
        return [PSCustomObject]@{ Action = "url"; Shop = $null; Url = $selection.Trim() }
    }

    if ($selection -match "^(?i:a|add)$") {
        return [PSCustomObject]@{ Action = "add"; Shop = $null; Url = "" }
    }
    if ($selection -match "^(?i:u|url)$") {
        $shopUrl = Read-Host "Nhập URL shop (vd: https://ten.myharavan.com/?themeid=-1)"
        return [PSCustomObject]@{ Action = "url"; Shop = $null; Url = $shopUrl.Trim() }
    }

    return [PSCustomObject]@{
        Action = "dev"
        Shop   = Resolve-ShopSelection -Projects $projects -Selection $selection
        Url    = ""
    }
}

$choice = Select-ShopOrAdd
if ($choice.Action -eq "add") {
    $beforeConnections = @((Get-ShopProjects) | ForEach-Object {
        "$($_.OrgId)|$($_.ThemeId)"
    })
    & (Join-Path $PSScriptRoot "add-shop.ps1") -Login

    $projects = @(Get-ShopProjects)
    $newShops = @($projects | Where-Object {
        "$($_.OrgId)|$($_.ThemeId)" -notin $beforeConnections
    })
    if ($newShops.Count -eq 1) {
        $shop = $newShops[0]
    } else {
        $shop = Select-ShopProject
    }
} elseif ($choice.Action -eq "url") {
    $beforeConnections = @((Get-ShopProjects) | ForEach-Object {
        "$($_.OrgId)|$($_.ThemeId)"
    })
    & (Join-Path $PSScriptRoot "add-shop.ps1") -Url $choice.Url

    $projects = @(Get-ShopProjects)
    $newShops = @($projects | Where-Object {
        "$($_.OrgId)|$($_.ThemeId)" -notin $beforeConnections
    })
    if ($newShops.Count -eq 1) {
        $shop = $newShops[0]
    } else {
        $shop = Select-ShopProject
    }
} else {
    $shop = $choice.Shop
}

Write-Host ""
Write-Host "Preparing: $($shop.ThemeName)"
Write-Host "Organization: $($shop.OrgId)"
Write-Host "Theme: $($shop.ThemeId)"
Write-Host "Account: $($shop.Email)"
Write-Host "Folder: $($shop.Path)"

$dailyShopCleanup = Invoke-HaravanDailyShopCleanup -ProtectedPaths @($shop.Path)

$beforePullBackup = $null
if (Test-HaravanThemeContent -RootPath $shop.Path) {
    $beforePullBackup = New-ThemeBackup -Shop $shop -Reason "before-auto-pull"
    $beforePullStatus = if ($beforePullBackup.WasCreated) {
        "created"
    } else {
        "reused"
    }
    Write-Host (
        "Backup before pull ({0}): {1}" -f `
            $beforePullStatus,
            $beforePullBackup.Path
    )
} else {
    Write-Warning (
        "Local theme content is missing or incomplete, so there is nothing " +
        "to back up before pull."
    )
}

Write-Host "Pulling latest remote theme before development..."
$pullResult = Invoke-HaravanThemeDownloadWithRelogin `
    -WorkingDirectory $shop.Path `
    -ThemeId $shop.ThemeId `
    -OrgId $shop.OrgId
if ($pullResult.Partial) {
    Write-Warning "Remote theme pull was partial; the existing local theme was kept."
} elseif ($pullResult.UsedFallback) {
    Write-Host "Latest remote theme downloaded with batch pull fallback."
} else {
    Write-Host "Latest remote theme downloaded."
}

$backup = New-ThemeBackup -Shop $shop -Reason "before-dev"
$backupStatus = if ($backup.WasCreated) { "created" } else { "reused" }

Write-Host "Backup before dev ($backupStatus): $($backup.Path)"
Write-Host ""
Write-Host "Editing latest remote code: $($shop.ThemeName)"
Write-Host "Saved files overwrite this remote theme. Press Ctrl+C to stop."
Write-Host ""

Invoke-HaravanAt -WorkingDirectory $shop.Path "theme" "dev"
