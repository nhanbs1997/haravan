param(
    [switch]$Login,
    [string]$Url,
    [string]$OrgId,
    [string]$ThemeId
)

. "$PSScriptRoot/common.ps1"

try {
    $null = Get-HaravanCommand
} catch {
    & (Join-Path $PSScriptRoot "setup.ps1")
}

$organizationIds = @(Get-LoggedInOrganizationIds)
if ($Login) {
    if ($organizationIds.Count -gt 0) {
        Write-Host "Haravan CLI đã xác nhận phiên đăng nhập hiện tại: $($organizationIds -join ', ')" -ForegroundColor Green
    } else {
        Write-Host "Chưa có Organization trong phiên Haravan CLI. Mở bước đăng nhập..."
        Invoke-HaravanAt -WorkingDirectory $script:ProjectRoot "login"
        $organizationIds = @(Get-LoggedInOrganizationIds)
    }
}

Write-Host ""
Write-Host "Logged-in Organizations:"
if ($organizationIds.Count -eq 0) {
    Write-Warning "Haravan CLI chưa xác nhận Organization nào trong phiên hiện tại."
}

$shopsDirectory = Join-Path $script:ProjectRoot "shops"
New-Item -ItemType Directory -Path $shopsDirectory -Force | Out-Null

# --- Dùng cặp Org/Theme đã xác minh từ ticket ---
$hasExplicitSelection = (
    -not [string]::IsNullOrWhiteSpace($OrgId) -or
    -not [string]::IsNullOrWhiteSpace($ThemeId)
)
if ($hasExplicitSelection) {
    if ([string]::IsNullOrWhiteSpace($OrgId) -or
        [string]::IsNullOrWhiteSpace($ThemeId)) {
        throw "OrgId và ThemeId phải được truyền cùng nhau."
    }
    if ($OrgId -notmatch '^\d+$' -or $ThemeId -notmatch '^\d+$') {
        throw "OrgId hoặc ThemeId không hợp lệ: org=$OrgId, theme=$ThemeId"
    }
    if ($OrgId -notin $organizationIds) {
        throw (
            "Organization $OrgId chưa có trong phiên Haravan CLI. " +
            "Hãy đăng nhập đúng Organization rồi chạy lại."
        )
    }

    $orgId = $OrgId
    $themeId = $ThemeId
    Write-Host "Dùng Org/Theme đã xác minh: $orgId / $themeId"
    Write-Host ""
    Write-Host "Themes in Organization $orgId`:"
    Invoke-HaravanAt -WorkingDirectory $script:ProjectRoot "select" $orgId
    $themeOutput = Invoke-HaravanCaptureAt -WorkingDirectory $script:ProjectRoot "theme" "list"
    $themeIds = @(Get-HaravanTableIds -Lines $themeOutput)
    if ($themeId -notin $themeIds) {
        throw (
            "Theme $themeId không thuộc Organization $orgId. " +
            "Danh sách theme hiện có: $($themeIds -join ', ')"
        )
    }
} elseif (-not [string]::IsNullOrWhiteSpace($Url)) {
    # --- Auto-detect từ URL ---
    $detected = Get-ShopIdsFromUrl -Url $Url
    $orgId    = $detected.OrgId
    $themeId  = $detected.ThemeId

    if ($orgId -notin $organizationIds) {
        if (-not (Ensure-HaravanOrganizationLogin -OrgId $orgId -SourceUrl $Url)) {
            throw (
                "Organization $orgId (từ URL) chưa được login. " +
                "Đã bỏ qua bước đăng nhập; hãy chạy lại với đúng tài khoản quản lý org này."
            )
        }
        $organizationIds = @(Get-LoggedInOrganizationIds)
    }
    if ($orgId -notin $organizationIds) {
        throw (
            "Organization $orgId (từ URL) vẫn chưa xuất hiện trong phiên Haravan sau khi login. " +
            "Hãy kiểm tra đúng tài khoản quản lý org rồi chạy lại."
        )
    }

    Write-Host ""
    Write-Host "Themes in Organization $orgId`:"
    Invoke-HaravanAt -WorkingDirectory $script:ProjectRoot "select" $orgId
    $themeOutput = Invoke-HaravanCaptureAt -WorkingDirectory $script:ProjectRoot "theme" "list"
    $themeIds = @(Get-HaravanTableIds -Lines $themeOutput)
    if ($themeId -notin $themeIds) {
        throw (
            "Theme $themeId (từ URL) không thuộc Organization $orgId. " +
            "Danh sách theme hiện có: $($themeIds -join ', ')"
        )
    }
} else {
    # --- Nhập thủ công ---
    if ($organizationIds.Count -eq 0) {
        throw "No logged-in Organization found. Run: npm.cmd run add:shop"
    }
    $defaultOrgId = $organizationIds[0]
    $orgId = Read-Host "Organization ID [$defaultOrgId]"
    if ([string]::IsNullOrWhiteSpace($orgId)) {
        $orgId = $defaultOrgId
    }
    if ($orgId -notin $organizationIds) {
        throw "Organization $orgId is not logged in."
    }

    Write-Host ""
    Write-Host "Themes in Organization $orgId`:"
    Invoke-HaravanAt -WorkingDirectory $script:ProjectRoot "select" $orgId
    $themeOutput = Invoke-HaravanCaptureAt -WorkingDirectory $script:ProjectRoot "theme" "list"
    $themeIds = @(Get-HaravanTableIds -Lines $themeOutput)
    if ($themeIds.Count -eq 0) {
        throw "No theme found for Organization $orgId."
    }

    $defaultThemeId = $themeIds[0]
    $themeId = Read-Host "Theme ID [$defaultThemeId]"
    if ([string]::IsNullOrWhiteSpace($themeId)) {
        $themeId = $defaultThemeId
    }
    if ($themeId -notin $themeIds) {
        throw "Theme $themeId does not belong to Organization $orgId."
    }
}

$existingShop = @(Get-ShopProjects | Where-Object {
    $_.OrgId -eq $orgId -and $_.ThemeId -eq $themeId
})
$protectedShopPaths = @($existingShop | ForEach-Object { $_.Path })
$dailyShopCleanup = Invoke-HaravanDailyShopCleanup -ProtectedPaths $protectedShopPaths
if ($existingShop.Count -gt 0) {
    $targetShop = $existingShop[0]
    Write-Host "Shop already configured: org $orgId / theme $themeId"
    Write-Host "Updating login session and pulling latest remote code for $($targetShop.ThemeName)..."
    
    Invoke-HaravanAt -WorkingDirectory $targetShop.Path "select" $orgId
    $download = Invoke-HaravanThemeDownloadAt `
        -WorkingDirectory $targetShop.Path `
        -ThemeId $themeId
    Write-Host "Theme connection refreshed successfully."
    return
}

$stagingName = ".setup-$orgId-$themeId-$(Get-Date -Format 'yyyyMMddHHmmssfff')"
$shopDirectory = Join-Path $shopsDirectory $stagingName
New-Item -ItemType Directory -Path $shopDirectory -Force | Out-Null

try {
    Write-Host ""
    Write-Host "Fetching selected theme: $themeId"
    Invoke-HaravanAt -WorkingDirectory $shopDirectory "select" $orgId
    $download = Invoke-HaravanThemeDownloadAt `
        -WorkingDirectory $shopDirectory `
        -ThemeId $themeId
    if ($download.UsedFallback) {
        Write-Host "Theme downloaded with batch pull fallback."
    }

    $localConfig = Join-Path $shopDirectory ".haravan-cli_local.json"
    $connection = Get-Content -LiteralPath $localConfig -Raw | ConvertFrom-Json
    $themeName = [string]$connection.theme_name
    if ([string]::IsNullOrWhiteSpace($themeName)) {
        $themeName = "theme"
    }
    $loginEmail = Get-HaravanAccountEmail -OrgId $orgId
    if ([string]::IsNullOrWhiteSpace($loginEmail)) {
        throw "Could not find the login email for Organization $orgId."
    }
    $safeThemeName = ($themeName -replace '[<>:"/\\|?*\x00-\x1F]', "-").Trim(" ", ".")
    $safeEmail = ($loginEmail -replace '[<>:"/\\|?*\x00-\x1F]', "-").Trim(" ", ".")
    $finalName = "$orgId - $themeId - $safeThemeName - $safeEmail"
    $finalDirectory = Join-Path $shopsDirectory $finalName
    if (Test-Path -LiteralPath $finalDirectory) {
        throw "Shop folder already exists: $finalDirectory"
    }

    Finalize-HaravanShopDirectory `
        -SourceRoot $shopDirectory `
        -DestinationRoot $finalDirectory `
        -AllowedRoot $shopsDirectory | Out-Null
    Write-Host "Shop folder: $finalDirectory"

    Write-Host ""
    Write-Host "Theme setup complete."
} catch {
    $setupError = $_
    if (Test-Path -LiteralPath $shopDirectory -PathType Container) {
        try {
            $resolvedShopsDirectory = (Resolve-Path -LiteralPath $shopsDirectory).Path
            $resolvedSetupDirectory = (Resolve-Path -LiteralPath $shopDirectory).Path
            $expectedSetupPrefix = ".setup-$orgId-$themeId-"
            $isDirectChild = [string]::Equals(
                (Split-Path -Parent $resolvedSetupDirectory),
                $resolvedShopsDirectory,
                [System.StringComparison]::OrdinalIgnoreCase
            )
            $setupLeaf = Split-Path -Leaf $resolvedSetupDirectory
            $isExpectedSetup = $setupLeaf.StartsWith(
                $expectedSetupPrefix,
                [System.StringComparison]::OrdinalIgnoreCase
            )
            if ($isDirectChild -and $isExpectedSetup) {
                $setupRemoved = Remove-HaravanDirectorySafely `
                    -Path $resolvedSetupDirectory `
                    -AllowedRoot $resolvedShopsDirectory
                if (-not $setupRemoved) {
                    $connectionFile = Join-Path `
                        $resolvedSetupDirectory `
                        ".haravan-cli_local.json"
                    Remove-Item -LiteralPath $connectionFile `
                        -Force -ErrorAction SilentlyContinue
                    Write-Warning (
                        "Incomplete setup directory was ignored but could not be fully removed: " +
                        $resolvedSetupDirectory
                    )
                }
            }
        } catch {
            Write-Warning "Could not clean incomplete setup directory: $($_.Exception.Message)"
        }
    }
    throw $setupError
}
