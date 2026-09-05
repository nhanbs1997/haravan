[CmdletBinding()]
param(
    [ValidateSet("parse", "prepare", "draft", "status")]
    [string]$Action = "prepare",
    [string]$ContextPath,
    [string]$ContextJson,
    [string]$TicketId,
    [string]$AdditionalRequest,
    [string]$ChangesPath,
    [ValidateRange(0, 1440)][int]$ReuseMinutes = 30,
    [switch]$ForceFetch
)

. "$PSScriptRoot/common.ps1"

$workflowRoot = Join-Path $script:ProjectRoot ".ticket-workflow"

function Get-WorkflowProperty {
    param(
        [Parameter(Mandatory = $true)][object]$Object,
        [Parameter(Mandatory = $true)][string[]]$Names
    )

    foreach ($name in $Names) {
        $property = $Object.PSObject.Properties[$name]
        if ($property -and $null -ne $property.Value) {
            return [string]$property.Value
        }
    }
    return ""
}

function Get-WorkflowInputParts {
    param([string]$Value)

    $raw = [string]$Value
    if ([string]::IsNullOrWhiteSpace($raw)) {
        return [PSCustomObject]@{
            TicketId           = ""
            AdditionalRequest  = ""
        }
    }

    $match = [regex]::Match($raw, "(?<!\d)(\d{3,})(?!\d)")
    if (-not $match.Success) {
        throw "Không xác định được Ticket ID từ đầu vào: $raw"
    }

    $before = $raw.Substring(0, $match.Index).Trim()
    $after = $raw.Substring($match.Index + $match.Length).Trim()
    $inlineRequest = ""
    if ($before -eq "" -or $before -eq "#") {
        $inlineRequest = $after -replace "^\s*[-:|]+\s*", ""
    }

    return [PSCustomObject]@{
        TicketId          = $match.Groups[1].Value
        AdditionalRequest = $inlineRequest.Trim()
    }
}

function Resolve-WorkflowAdditionalRequest {
    param(
        [string]$InputValue,
        [string]$ExplicitRequest,
        [object]$Context
    )

    $inputParts = Get-WorkflowInputParts -Value $InputValue
    $contextRequest = if ($Context) {
        Get-WorkflowProperty -Object $Context -Names @(
            "additionalRequest",
            "requestedScope",
            "scopeRequest",
            "userRequest"
        )
    } else {
        ""
    }

    $candidates = @(
        $ExplicitRequest,
        $contextRequest,
        $inputParts.AdditionalRequest
    ) | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) } |
        ForEach-Object { ([string]$_).Trim() } |
        Select-Object -Unique

    if (@($candidates).Count -gt 1) {
        throw (
            "Có nhiều yêu cầu bổ sung khác nhau giữa tham số, context và đầu vào. " +
            "Chỉ truyền một yêu cầu để tránh sửa sai phạm vi."
        )
    }
    if (@($candidates).Count -eq 1) {
        return [string]@($candidates)[0]
    }
    return ""
}

function Get-WorkflowImplementationScope {
    param([string]$AdditionalRequest)

    if ([string]::IsNullOrWhiteSpace($AdditionalRequest)) {
        return "Xử lý theo toàn bộ yêu cầu đã xác minh trong ticket."
    }
    return (
        "CHỈ ĐƯỢC XỬ LÝ YÊU CẦU BỔ SUNG SAU ĐÂY:`n" +
        $AdditionalRequest.Trim() +
        "`n`nKhông tự sửa các lỗi hoặc yêu cầu khác trong ticket nếu người dùng chưa chỉ định."
    )
}

function Assert-WorkflowSafeJson {
    param([Parameter(Mandatory = $true)][object]$Object)

    foreach ($property in $Object.PSObject.Properties) {
        if ($property.Name -match "(?i)(password|passwd|secret|token|cookie|access.?key)") {
            throw (
                "Context chứa trường nhạy cảm '$($property.Name)'. " +
                "Hãy xóa trường này trước khi chạy workflow."
            )
        }
    }
}

function ConvertTo-WorkflowSourceUrl {
    param([Parameter(Mandatory = $true)][string]$Url)

    $value = $Url.Trim()
    if ([string]::IsNullOrWhiteSpace($value)) {
        return ""
    }
    if ($value.StartsWith("//")) {
        $value = "https:$value"
    } elseif ($value -notmatch "^https?://") {
        $value = "https://$value"
    }

    try {
        $uri = [System.Uri]$value
    } catch {
        throw "URL website không hợp lệ: $Url"
    }
    if ([string]::IsNullOrWhiteSpace($uri.Host)) {
        throw "URL website không có hostname: $Url"
    }

    # Public homepage có HTML ổn định hơn link /admin hoặc link sản phẩm.
    return "{0}://{1}/" -f $uri.Scheme, $uri.Host
}

function Get-WorkflowTicketId {
    param(
        [string]$Value,
        [object]$Context
    )

    $candidate = if ($Context) {
        Get-WorkflowProperty -Object $Context -Names @("ticketId", "id")
    } else {
        $Value
    }
    if ([string]::IsNullOrWhiteSpace($candidate)) {
        $candidate = $Value
    }

    $match = [regex]::Match([string]$candidate, "(?<!\d)(\d{3,})(?!\d)")
    if (-not $match.Success) {
        throw "Không xác định được Ticket ID từ context hoặc tham số đầu vào."
    }
    return $match.Groups[1].Value
}

function Read-WorkflowContext {
    param(
        [string]$Path,
        [string]$Json
    )

    if (-not [string]::IsNullOrWhiteSpace($Json)) {
        $raw = $Json
    } elseif (-not [string]::IsNullOrWhiteSpace($Path)) {
        $resolvedPath = (Resolve-Path -LiteralPath $Path -ErrorAction Stop).Path
        $raw = Get-Content -LiteralPath $resolvedPath -Raw
    } else {
        throw (
            "Thiếu context. Chạy browser helper rồi lưu JSON, sau đó truyền " +
            "-ContextPath hoặc -ContextJson."
        )
    }

    try {
        $context = $raw | ConvertFrom-Json -ErrorAction Stop
    } catch {
        throw "Context JSON không hợp lệ: $($_.Exception.Message)"
    }
    Assert-WorkflowSafeJson -Object $context

    $ticketIdValue = Get-WorkflowTicketId -Value $TicketId -Context $context
    $websiteUrl = Get-WorkflowProperty -Object $context -Names @(
        "websiteUrl",
        "webLink",
        "shopUrl",
        "publicUrl"
    )
    $adminUrl = Get-WorkflowProperty -Object $context -Names @(
        "adminUrl",
        "myHaravanLink",
        "myharavanUrl"
    )
    if ([string]::IsNullOrWhiteSpace($websiteUrl)) {
        $websiteUrl = $adminUrl
    }

    $orgIdValue = Get-WorkflowProperty -Object $context -Names @(
        "orgId",
        "org_id",
        "haravanOrgId"
    )
    $requestText = Get-WorkflowProperty -Object $context -Names @(
        "requestText",
        "content",
        "ticketContent",
        "description"
    )
    $additionalRequest = Resolve-WorkflowAdditionalRequest `
        -InputValue $TicketId `
        -ExplicitRequest $AdditionalRequest `
        -Context $context
    $scopeMode = if ([string]::IsNullOrWhiteSpace($additionalRequest)) {
        "ticket-request"
    } else {
        "explicit-additional-request"
    }
    $implementationScope = Get-WorkflowImplementationScope `
        -AdditionalRequest $additionalRequest
    $subject = Get-WorkflowProperty -Object $context -Names @("subject", "title")
    $ticketUrl = Get-WorkflowProperty -Object $context -Names @("ticketUrl", "url")
    $shopName = Get-WorkflowProperty -Object $context -Names @(
        "shopName",
        "storeName",
        "accountName"
    )

    if ([string]::IsNullOrWhiteSpace($websiteUrl)) {
        $insideUrl = if ($orgIdValue) {
            "https://inside.haravan.com/shops/$orgIdValue"
        } else {
            "https://inside.haravan.com/shops/{org_id}"
        }
        throw (
            "Context chưa có website/admin link. Hãy mở $insideUrl, lấy link web " +
            "rồi bổ sung vào websiteUrl trước khi fetch theme."
        )
    }

    $sourceUrl = ConvertTo-WorkflowSourceUrl -Url $websiteUrl
    $contextThemeId = Get-WorkflowProperty -Object $context -Names @(
        "themeId",
        "theme_id"
    )
    $hasDirectThemeMetadata = (
        -not [string]::IsNullOrWhiteSpace($orgIdValue) -and
        -not [string]::IsNullOrWhiteSpace($contextThemeId)
    )
    if ($hasDirectThemeMetadata) {
        if ($orgIdValue -notmatch "^\d+$" -or $contextThemeId -notmatch "^\d+$") {
            throw "Org ID hoặc Theme ID trong context không hợp lệ."
        }
        $detected = [PSCustomObject]@{
            OrgId = $orgIdValue
            ThemeId = $contextThemeId
        }
        Write-Host "Dùng Org ID/Theme ID đã có trong context; bỏ qua fetch HTML storefront."
    } else {
        $detected = Get-ShopIdsFromUrl -Url $sourceUrl
    }

    if (-not [string]::IsNullOrWhiteSpace($orgIdValue) -and
        $orgIdValue -notmatch "^\d+$") {
        throw "Org ID trong context không hợp lệ: $orgIdValue"
    }
    if (-not [string]::IsNullOrWhiteSpace($orgIdValue) -and
        $orgIdValue -ne $detected.OrgId) {
        throw (
            "Org ID không khớp: ticket/context=$orgIdValue, website=$($detected.OrgId). " +
            "Kiểm tra lại website hoặc Inside trước khi fetch."
        )
    }

    return [PSCustomObject]@{
        TicketId   = $ticketIdValue
        TicketUrl  = $ticketUrl
        Subject    = $subject
        RequestText = $requestText
        AdditionalRequest = $additionalRequest
        ScopeMode  = $scopeMode
        ImplementationScope = $implementationScope
        WebsiteUrl = $websiteUrl
        AdminUrl   = $adminUrl
        ShopName   = $shopName
        SourceUrl  = $sourceUrl
        OrgId      = [string]$detected.OrgId
        ThemeId    = [string]$detected.ThemeId
    }
}

function Get-WorkflowSessionDirectory {
    param([Parameter(Mandatory = $true)][string]$TicketIdValue)

    if ($TicketIdValue -notmatch "^\d+$") {
        throw "Ticket ID không hợp lệ: $TicketIdValue"
    }
    return Join-Path $workflowRoot $TicketIdValue
}

function Write-WorkflowJson {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][object]$Value
    )

    $parent = Split-Path -Parent $Path
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
    $Value | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Get-WorkflowThemeSignature {
    param([Parameter(Mandatory = $true)][string]$RootPath)

    if (-not (Test-HaravanThemeContent -RootPath $RootPath)) {
        return ""
    }

    $records = New-Object System.Collections.Generic.List[string]
    foreach ($directoryName in Get-ThemeContentDirectoryNames) {
        $directoryPath = Join-Path $RootPath $directoryName
        if (-not (Test-Path -LiteralPath $directoryPath -PathType Container)) {
            continue
        }
        foreach ($file in Get-ChildItem -LiteralPath $directoryPath -File -Recurse) {
            $relativePath = $file.FullName.Substring($RootPath.Length).
                TrimStart([System.IO.Path]::DirectorySeparatorChar) -replace '\\', '/'
            [void]$records.Add((
                "{0}|{1}|{2}" -f
                    $relativePath,
                    $file.Length,
                    $file.LastWriteTimeUtc.Ticks
            ))
        }
    }
    if ($records.Count -eq 0) {
        return ""
    }

    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
        $metadata = ($records | Sort-Object) -join "`n"
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($metadata)
        $hashBytes = $sha256.ComputeHash($bytes)
        return ([System.BitConverter]::ToString($hashBytes) -replace "-", "")
    } finally {
        $sha256.Dispose()
    }
}

function Get-WorkflowThemeCachePath {
    param([Parameter(Mandatory = $true)][string]$ShopPath)

    return Join-Path $ShopPath ".haravan-workflow-cache.json"
}

function Read-WorkflowThemeCache {
    param([Parameter(Mandatory = $true)]$Shop)

    $cachePath = Get-WorkflowThemeCachePath -ShopPath $Shop.Path
    if (-not (Test-Path -LiteralPath $cachePath -PathType Leaf)) {
        return $null
    }
    try {
        return Get-Content -LiteralPath $cachePath -Raw | ConvertFrom-Json -ErrorAction Stop
    } catch {
        Write-Warning "Bỏ qua cache theme không hợp lệ: $cachePath"
        return $null
    }
}

function Test-WorkflowThemeCacheFresh {
    param(
        [Parameter(Mandatory = $true)]$Shop,
        [Parameter(Mandatory = $true)]$Context,
        [Parameter(Mandatory = $true)][int]$MaxAgeMinutes
    )

    if ($MaxAgeMinutes -le 0) {
        return $false
    }
    $cache = Read-WorkflowThemeCache -Shop $Shop
    if (-not $cache) {
        return $false
    }
    foreach ($propertyName in @("orgId", "themeId", "sourceUrl", "fetchedAt", "signature")) {
        $property = $cache.PSObject.Properties[$propertyName]
        if (-not $property -or [string]::IsNullOrWhiteSpace([string]$property.Value)) {
            return $false
        }
    }

    try {
        $fetchedAt = [datetime]::Parse(
            [string]$cache.fetchedAt,
            [System.Globalization.CultureInfo]::InvariantCulture,
            [System.Globalization.DateTimeStyles]::RoundtripKind
        )
    } catch {
        return $false
    }
    $age = (Get-Date) - $fetchedAt.ToLocalTime()
    if ($age.TotalMinutes -lt 0 -or $age.TotalMinutes -gt $MaxAgeMinutes) {
        return $false
    }
    if ([string]$cache.orgId -ne [string]$Context.OrgId -or
        [string]$cache.themeId -ne [string]$Context.ThemeId -or
        -not [string]::Equals(
            [string]$cache.sourceUrl,
            [string]$Context.SourceUrl,
            [System.StringComparison]::OrdinalIgnoreCase
        )) {
        return $false
    }
    if (-not (Test-HaravanThemeContent -RootPath $Shop.Path)) {
        return $false
    }

    $currentSignature = Get-WorkflowThemeSignature -RootPath $Shop.Path
    return -not [string]::IsNullOrWhiteSpace($currentSignature) -and
        [string]::Equals(
            $currentSignature,
            [string]$cache.signature,
            [System.StringComparison]::Ordinal
        )
}

function Write-WorkflowThemeCache {
    param(
        [Parameter(Mandatory = $true)]$Shop,
        [Parameter(Mandatory = $true)]$Context,
        [Parameter(Mandatory = $true)][string]$Mode
    )

    $signature = Get-WorkflowThemeSignature -RootPath $Shop.Path
    if ([string]::IsNullOrWhiteSpace($signature)) {
        return
    }
    $cache = [ordered]@{
        version   = 1
        fetchedAt = (Get-Date).ToUniversalTime().ToString("o")
        orgId     = [string]$Context.OrgId
        themeId   = [string]$Context.ThemeId
        sourceUrl = [string]$Context.SourceUrl
        signature = $signature
        mode      = $Mode
    }
    Write-WorkflowJson `
        -Path (Get-WorkflowThemeCachePath -ShopPath $Shop.Path) `
        -Value $cache
}

function Invoke-WorkflowPrepare {
    $context = Read-WorkflowContext -Path $ContextPath -Json $ContextJson
    $sessionDirectory = Get-WorkflowSessionDirectory -TicketIdValue $context.TicketId
    New-Item -ItemType Directory -Path $sessionDirectory -Force | Out-Null

    Write-Host ""
    Write-Host "Ticket #$($context.TicketId): $($context.Subject)"
    Write-Host "Website: $($context.WebsiteUrl)"
    Write-Host "Organization: $($context.OrgId)"
    Write-Host "Theme: $($context.ThemeId)"

    if (-not (Ensure-HaravanOrganizationLogin `
        -OrgId $context.OrgId `
        -SourceUrl $context.SourceUrl)) {
        throw "Chưa đăng nhập Organization $($context.OrgId); workflow dừng trước khi fetch."
    }

    $existingShop = @(
        Get-ShopProjects | Where-Object {
            $_.OrgId -eq $context.OrgId -and $_.ThemeId -eq $context.ThemeId
        }
    )
    $cacheReused = $false
    $shop = @()
    if ($existingShop.Count -gt 0 -and
        (Test-HaravanThemeContent -RootPath $existingShop[0].Path) -and
        -not $ForceFetch -and
        (Test-WorkflowThemeCacheFresh `
            -Shop $existingShop[0] `
            -Context $context `
            -MaxAgeMinutes $ReuseMinutes)) {
        $shop = @($existingShop[0])
        $cacheReused = $true
        Write-Host (
            "Theme local còn mới trong {0} phút; bỏ qua backup và fetch/pull remote." -f
                $ReuseMinutes
        ) -ForegroundColor DarkCyan
    } else {
        if ($existingShop.Count -gt 0 -and
            (Test-HaravanThemeContent -RootPath $existingShop[0].Path)) {
            $backup = New-ThemeBackup `
                -Shop $existingShop[0] `
                -Reason ("before-ticket-{0}" -f $context.TicketId)
            Write-Host "Backup trước khi cập nhật theme: $($backup.Path)"
        }

        Write-Host "Fetch/pull theme vào workspace..."
        & (Join-Path $PSScriptRoot "add-shop.ps1") `
            -OrgId $context.OrgId `
            -ThemeId $context.ThemeId
        if (-not $?) {
            throw "add-shop.ps1 không hoàn tất. Kiểm tra lỗi CLI ở terminal và chạy lại."
        }

        $shop = @(
            Get-ShopProjects | Where-Object {
                $_.OrgId -eq $context.OrgId -and $_.ThemeId -eq $context.ThemeId
            }
        )
    }
    if ($shop.Count -ne 1) {
        throw "Không xác định được thư mục shop sau khi fetch org/theme."
    }
    if (-not (Test-HaravanThemeContent -RootPath $shop[0].Path)) {
        throw "Theme sau khi fetch chưa đủ assets/layout/templates: $($shop[0].Path)"
    }
    if (-not $cacheReused) {
        try {
            Write-WorkflowThemeCache `
                -Shop $shop[0] `
                -Context $context `
                -Mode "fresh-fetch"
        } catch {
            Write-Warning "Không ghi được cache theme; lần chạy sau sẽ fetch lại: $($_.Exception.Message)"
        }
    }

    $prepared = [ordered]@{
        version       = 1
        status        = "theme-fetched"
        fetchMode     = if ($cacheReused) { "reused-cache" } else { "fresh-fetch" }
        cacheReused   = $cacheReused
        reuseMinutes  = $ReuseMinutes
        replyMode     = "draft-only"
        preparedAt    = (Get-Date).ToString("o")
        ticketId      = $context.TicketId
        ticketUrl     = $context.TicketUrl
        subject       = $context.Subject
        requestText   = $context.RequestText
        originalRequestText = $context.RequestText
        additionalRequest = $context.AdditionalRequest
        scopeMode     = $context.ScopeMode
        implementationScope = $context.ImplementationScope
        websiteUrl    = $context.WebsiteUrl
        adminUrl      = $context.AdminUrl
        shopName      = $context.ShopName
        sourceUrl     = $context.SourceUrl
        orgId         = $context.OrgId
        themeId       = $context.ThemeId
        shopPath      = $shop[0].Path
        themeName     = $shop[0].ThemeName
        changesFile   = (Join-Path $sessionDirectory "changes.json")
        draftFile     = (Join-Path $sessionDirectory "draft-reply.md")
        replySent     = $false
    }
    Write-WorkflowJson -Path (Join-Path $sessionDirectory "context.json") -Value $prepared

    $changesFile = Join-Path $sessionDirectory "changes.json"
    if (-not (Test-Path -LiteralPath $changesFile -PathType Leaf)) {
        @() | ConvertTo-Json | Set-Content -LiteralPath $changesFile -Encoding UTF8
    }

    $readmeLines = @(
        "# Ticket #$($context.TicketId) — phiên xử lý",
        "",
        "- Theme: $($shop[0].ThemeName)",
        "- Org ID: $($context.OrgId)",
        "- Theme ID: $($context.ThemeId)",
        "- Shop path: $($shop[0].Path)",
        ("- Fetch mode: " + $(if ($cacheReused) { "tái sử dụng cache local" } else { "fetch mới" })),
        "- Trạng thái: theme sẵn sàng, chờ xử lý yêu cầu",
        "- Reply: chỉ tạo draft; không Reply/Send tự động",
        "",
        "## Yêu cầu từ ticket",
        "",
        $context.RequestText
    )
    if (-not [string]::IsNullOrWhiteSpace($context.AdditionalRequest)) {
        $readmeLines += @(
            "",
            "## Phạm vi chỉnh sửa bắt buộc",
            "",
            $context.ImplementationScope,
            "",
            "changes.json và danh sách file push chỉ được chứa phần yêu cầu bổ sung này."
        )
    }
    $readmeLines | Set-Content -LiteralPath (Join-Path $sessionDirectory "README.md") -Encoding UTF8

    Write-Host ""
    Write-Host "Đã fetch theme vào: $($shop[0].Path)" -ForegroundColor Green
    Write-Host "Context: $(Join-Path $sessionDirectory 'context.json')"
    Write-Host "Sau khi sửa code, cập nhật changes.json rồi chạy:"
    Write-Host "npm.cmd run ticket:draft -- -TicketId $($context.TicketId)"
}

function Invoke-WorkflowParseInput {
    $parts = Get-WorkflowInputParts -Value $TicketId
    $additionalRequest = Resolve-WorkflowAdditionalRequest `
        -InputValue $TicketId `
        -ExplicitRequest $AdditionalRequest `
        -Context $null
    [PSCustomObject]@{
        TicketId          = $parts.TicketId
        AdditionalRequest = $additionalRequest
        ScopeMode         = if ([string]::IsNullOrWhiteSpace($additionalRequest)) {
            "ticket-request"
        } else {
            "explicit-additional-request"
        }
        ImplementationScope = Get-WorkflowImplementationScope `
            -AdditionalRequest $additionalRequest
    } | Format-List
}

function Read-WorkflowSession {
    param([Parameter(Mandatory = $true)][string]$TicketIdValue)

    $sessionDirectory = Get-WorkflowSessionDirectory -TicketIdValue $TicketIdValue
    $contextFile = Join-Path $sessionDirectory "context.json"
    if (-not (Test-Path -LiteralPath $contextFile -PathType Leaf)) {
        throw "Chưa có context cho Ticket #${TicketIdValue}: $contextFile"
    }
    $context = Get-Content -LiteralPath $contextFile -Raw | ConvertFrom-Json
    Assert-WorkflowSafeJson -Object $context
    return $context
}

function Get-ChangeProperty {
    param(
        [Parameter(Mandatory = $true)][object]$Change,
        [Parameter(Mandatory = $true)][string[]]$Names
    )
    return Get-WorkflowProperty -Object $Change -Names $Names
}

function Invoke-WorkflowDraft {
    $ticketIdValue = Get-WorkflowTicketId -Value $TicketId -Context $null
    $context = Read-WorkflowSession -TicketIdValue $ticketIdValue
    $sessionDirectory = Get-WorkflowSessionDirectory -TicketIdValue $ticketIdValue
    $resolvedChangesPath = if ([string]::IsNullOrWhiteSpace($ChangesPath)) {
        Join-Path $sessionDirectory "changes.json"
    } else {
        (Resolve-Path -LiteralPath $ChangesPath -ErrorAction Stop).Path
    }
    if (-not (Test-Path -LiteralPath $resolvedChangesPath -PathType Leaf)) {
        throw "Không tìm thấy changes.json: $resolvedChangesPath"
    }

    $changesRaw = Get-Content -LiteralPath $resolvedChangesPath -Raw
    if ($changesRaw -match "(?i)(password|passwd|secret|token|cookie|access.?key)") {
        throw "changes.json chứa từ khóa nhạy cảm; draft không được tạo."
    }
    try {
        $parsedChanges = $changesRaw | ConvertFrom-Json -ErrorAction Stop
        $changes = @($parsedChanges)
    } catch {
        throw "changes.json không hợp lệ: $($_.Exception.Message)"
    }
    if ($changes.Count -eq 0) {
        throw "Chưa có mục thay đổi trong changes.json."
    }

    $lines = @(
        "Hi anh/chị,",
        "",
        "Yêu cầu đã được chỉnh sửa ạ",
        ""
    )
    for ($index = 0; $index -lt $changes.Count; $index++) {
        $change = $changes[$index]
        $title = Get-ChangeProperty -Change $change -Names @("title", "request", "content")
        $details = Get-ChangeProperty -Change $change -Names @("details", "result", "description")
        $setup = Get-ChangeProperty -Change $change -Names @(
            "setupInstructions",
            "setup",
            "settings"
        )
        if ([string]::IsNullOrWhiteSpace($title)) {
            throw "Mục thay đổi thứ $($index + 1) chưa có title/request."
        }

        $lines += ("{0}. {1}" -f ($index + 1), $title)
        if (-not [string]::IsNullOrWhiteSpace($details)) {
            $lines += "   $details"
        }

        $screenshotsProperty = $change.PSObject.Properties["screenshots"]
        if ($screenshotsProperty -and $null -ne $screenshotsProperty.Value) {
            foreach ($screenshot in @($screenshotsProperty.Value)) {
                $screenshotName = Split-Path -Leaf ([string]$screenshot)
                if (-not [string]::IsNullOrWhiteSpace($screenshotName)) {
                    $lines += "   Ảnh chỉnh sửa: $screenshotName"
                }
            }
        }
        if (-not [string]::IsNullOrWhiteSpace($setup)) {
            $lines += "   Hướng dẫn vào thiết lập: $setup"
        }
        $lines += ""
    }

    $draftPath = Join-Path $sessionDirectory "draft-reply.md"
    $lines | Set-Content -LiteralPath $draftPath -Encoding UTF8
    $context.status = "draft-ready"
    $draftCreatedAt = (Get-Date).ToString("o")
    if ($context.PSObject.Properties["draftCreatedAt"]) {
        $context.draftCreatedAt = $draftCreatedAt
    } else {
        $context | Add-Member -NotePropertyName "draftCreatedAt" -NotePropertyValue $draftCreatedAt
    }
    Write-WorkflowJson `
        -Path (Join-Path $sessionDirectory "context.json") `
        -Value $context
    Write-Host "Đã tạo bản nháp: $draftPath" -ForegroundColor Green
    Write-Host "Chỉ copy nội dung để kiểm tra thủ công; workflow không mở, không nhập và không gửi Reply."
}

function Invoke-WorkflowStatus {
    $ticketIdValue = Get-WorkflowTicketId -Value $TicketId -Context $null
    $context = Read-WorkflowSession -TicketIdValue $ticketIdValue
    [PSCustomObject]@{
        TicketId    = $context.ticketId
        Status      = $context.status
        ReplyMode   = $context.replyMode
        ReplySent   = $context.replySent
        OrgId       = $context.orgId
        ThemeId     = $context.themeId
        ShopPath    = $context.shopPath
        DraftFile   = $context.draftFile
    } | Format-List
}

switch ($Action) {
    "parse" {
        Invoke-WorkflowParseInput
        break
    }
    "prepare" {
        Invoke-WorkflowPrepare
        break
    }
    "draft" {
        Invoke-WorkflowDraft
        break
    }
    "status" {
        Invoke-WorkflowStatus
        break
    }
}
