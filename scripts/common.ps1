$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$script:ProjectRoot = Split-Path -Parent $PSScriptRoot

function Get-HaravanCommand {
    $command = Get-Command "haravan.cmd" -ErrorAction SilentlyContinue
    if (-not $command) {
        $command = Get-Command "haravan" -ErrorAction SilentlyContinue
    }
    if ($command) {
        return $command.Source
    }

    # VS Code can keep an older PATH after a global npm install. Resolve the
    # Windows npm shim directly so restarting VS Code is not required.
    $npmCommand = Get-Command "npm.cmd" -ErrorAction SilentlyContinue
    if ($npmCommand) {
        $npmPrefix = (& $npmCommand.Source config get prefix).Trim()
        $globalShim = Join-Path $npmPrefix "haravan.cmd"
        if (Test-Path -LiteralPath $globalShim -PathType Leaf) {
            return $globalShim
        }
    }

    throw "Haravan CLI is not installed. Run: npm.cmd run setup"
}

function Invoke-Haravan {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
    $command = Get-HaravanCommand

    # Haravan writes progress spinners to stderr. Windows PowerShell turns
    # native stderr into error records when ErrorActionPreference is Stop,
    # although the CLI may still finish successfully.
    $previousErrorPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        & $command @Arguments
        $exitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousErrorPreference
    }

    if ($exitCode -ne 0) {
        throw "Haravan command failed with exit code $exitCode."
    }
}

function Invoke-HaravanAt {
    param(
        [Parameter(Mandatory = $true)][string]$WorkingDirectory,
        [Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments
    )

    Push-Location -LiteralPath $WorkingDirectory
    try {
        Invoke-Haravan @Arguments
    } finally {
        Pop-Location
    }
}

function Invoke-HaravanCaptureAt {
    param(
        [Parameter(Mandatory = $true)][string]$WorkingDirectory,
        [switch]$AllowNonZero,
        [Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments
    )

    $command = Get-HaravanCommand
    $previousErrorPreference = $ErrorActionPreference
    Push-Location -LiteralPath $WorkingDirectory
    try {
        $ErrorActionPreference = "Continue"
        $output = @(& $command @Arguments 2>&1)
        $exitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousErrorPreference
        Pop-Location
    }

    $output | ForEach-Object { Write-Host $_ }
    if ($exitCode -ne 0 -and -not $AllowNonZero) {
        $commandException = [System.Exception]::new(
            "Haravan command failed with exit code $exitCode."
        )
        $commandException.Data["HaravanOutput"] = @($output)
        $commandException.Data["HaravanExitCode"] = $exitCode
        throw $commandException
    }
    return @($output | ForEach-Object { [string]$_ })
}

function Remove-HaravanAnsiCodes {
    param([AllowNull()][string]$Text)

    if ($null -eq $Text) {
        return ""
    }
    return $Text -replace "\x1B\[[0-?]*[ -/]*[@-~]", ""
}

function Test-HaravanThemeCommandFailure {
    param([AllowEmptyCollection()][string[]]$Lines)

    $plainText = (@($Lines) | ForEach-Object {
        Remove-HaravanAnsiCodes -Text ([string]$_)
    }) -join "`n"

    return $plainText -match (
        "(?i)(an error has occurred|themes? no data|file error:|" +
        "can't pull file|unauthenticated request|please create a new project|" +
        "no logged-in organization found|no shops have logged in|" +
        "you need to login again)"
    )
}

function Test-HaravanAuthFailure {
    param([AllowEmptyCollection()][string[]]$Lines)

    $plainText = (@($Lines) | ForEach-Object {
        Remove-HaravanAnsiCodes -Text ([string]$_)
    }) -join "`n"

    return $plainText -match (
        "(?i)(unauthenticated request|no logged-in organization found|" +
        "no shops have logged in|you need to login again)"
    )
}

function Test-HaravanRecoverableDuplicateAssetFailure {
    param([AllowEmptyCollection()][string[]]$Lines)

    $plainText = (@($Lines) | ForEach-Object {
        Remove-HaravanAnsiCodes -Text ([string]$_)
    }) -join "`n"

    $hasDuplicateAsset = $plainText -match (
        "(?i)(file duplicate in the assets template|duplicate name.*assets|" +
        "total number of files written is not equal total number of files from assets api)"
    )
    if (-not $hasDuplicateAsset) {
        return $false
    }

    # A fetch can report a duplicate after writing the first copy of the asset.
    # Do not mask a separate auth/file failure as recoverable.
    $hasBlockingFailure = $plainText -match (
        "(?i)(file error:|can't pull file|unauthenticated request|" +
        "no logged-in organization found|no shops have logged in|you need to login again)"
    )
    return -not $hasBlockingFailure
}

function Test-HaravanRecoverablePullFileFailure {
    param([AllowEmptyCollection()][string[]]$Lines)

    $plainText = (@($Lines) | ForEach-Object {
        Remove-HaravanAnsiCodes -Text ([string]$_)
    }) -join "`n"

    # The CLI skips assets that return HTTP 422 and continues writing the rest
    # of the theme. Its output still contains "File error", so only treat it
    # as recoverable after the resulting project is validated by the caller.
    $hasFileFailure = $plainText -match (
        "(?i)(file error:\s*\[|can't pull file|an file error has occurred)"
    )
    if (-not $hasFileFailure) {
        return $false
    }

    $hasBlockingFailure = $plainText -match (
        "(?i)(unauthenticated request|no logged-in organization found|" +
        "no shops have logged in|you need to login again|please create a new project)"
    )
    return -not $hasBlockingFailure
}

function Get-HaravanPullFileFailureKeys {
    param([AllowEmptyCollection()][string[]]$Lines)

    $keys = @()
    foreach ($line in @($Lines)) {
        $plainLine = Remove-HaravanAnsiCodes -Text ([string]$line)
        if ($plainLine -match "(?i)file error:\s*\[([^\]]+)\]") {
            $keys += $matches[1].Trim()
        } elseif ($plainLine -match "(?i)can't pull file\s*:?\s*(.+)$") {
            $keys += $matches[1].Trim()
        }
    }
    return @($keys | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
        Select-Object -Unique)
}

function Restore-HaravanPullFileFailures {
    param(
        [Parameter(Mandatory = $true)][string]$ExistingRoot,
        [Parameter(Mandatory = $true)][string]$DownloadedRoot,
        [AllowEmptyCollection()][string[]]$RelativePaths
    )

    $restoredCount = 0
    foreach ($relativePathValue in @($RelativePaths)) {
        $relativePath = ([string]$relativePathValue).Trim() -replace '/', '\'
        if ([string]::IsNullOrWhiteSpace($relativePath) -or
            $relativePath.StartsWith('\') -or
            $relativePath -match '(^|[\\])\.\.([\\]|$)') {
            continue
        }

        $existingPath = Join-Path $ExistingRoot $relativePath
        $downloadedPath = Join-Path $DownloadedRoot $relativePath
        if (-not (Test-HaravanPathWithinRoot -Path $existingPath -AllowedRoot $ExistingRoot) -or
            -not (Test-HaravanPathWithinRoot -Path $downloadedPath -AllowedRoot $DownloadedRoot)) {
            continue
        }
        if (-not (Test-Path -LiteralPath $existingPath -PathType Leaf) -or
            (Test-Path -LiteralPath $downloadedPath -PathType Leaf)) {
            continue
        }

        $downloadedParent = Split-Path -Parent $downloadedPath
        New-Item -ItemType Directory -Path $downloadedParent -Force | Out-Null
        Copy-Item -LiteralPath $existingPath -Destination $downloadedPath -Force
        $restoredCount++
        Write-Warning (
            "Preserved the existing local copy for unavailable remote file: " +
            $relativePath
        )
    }
    return $restoredCount
}

function Merge-HaravanPartialPullWithExistingTheme {
    param(
        [Parameter(Mandatory = $true)][string]$ExistingRoot,
        [Parameter(Mandatory = $true)][string]$DownloadedRoot,
        [Parameter(Mandatory = $true)][string]$RecoveryRoot
    )

    if (-not (Test-HaravanThemeContent -RootPath $ExistingRoot)) {
        return $false
    }

    New-Item -ItemType Directory -Path $RecoveryRoot -Force | Out-Null
    $existingConfig = Join-Path $ExistingRoot ".haravan-cli_local.json"
    if (Test-Path -LiteralPath $existingConfig -PathType Leaf) {
        Copy-Item -LiteralPath $existingConfig `
            -Destination (Join-Path $RecoveryRoot ".haravan-cli_local.json") `
            -Force
    }

    foreach ($directoryName in Get-ThemeContentDirectoryNames) {
        $recoveryDirectory = Join-Path $RecoveryRoot $directoryName
        New-Item -ItemType Directory -Path $recoveryDirectory -Force | Out-Null

        foreach ($sourceRoot in @($ExistingRoot, $DownloadedRoot)) {
            $sourceDirectory = Join-Path $sourceRoot $directoryName
            if (-not (Test-Path -LiteralPath $sourceDirectory -PathType Container)) {
                continue
            }
            Get-ChildItem -LiteralPath $sourceDirectory -Force | ForEach-Object {
                Copy-Item -LiteralPath $_.FullName `
                    -Destination $recoveryDirectory `
                    -Recurse -Force
            }
        }
    }

    return (Test-HaravanThemeContent -RootPath $RecoveryRoot)
}

function Test-HaravanThemeContent {
    param([Parameter(Mandatory = $true)][string]$RootPath)

    foreach ($directoryName in @("assets", "layout", "templates")) {
        $directoryPath = Join-Path $RootPath $directoryName
        if (-not (Test-Path -LiteralPath $directoryPath -PathType Container)) {
            return $false
        }

        # A theme may legitimately have no downloadable asset left when the
        # remote asset API returns an error for one or more files. Layout and
        # templates are the minimum required for a runnable theme; assets can
        # be empty while the unavailable files are reported to the user.
        if ($directoryName -eq "assets") {
            continue
        }

        $firstFile = Get-ChildItem -LiteralPath $directoryPath -File -Recurse |
            Select-Object -First 1
        if (-not $firstFile) {
            return $false
        }
    }
    return $true
}

function Test-HaravanPathWithinRoot {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$AllowedRoot
    )

    $fullPath = [System.IO.Path]::GetFullPath($Path)
    $fullPath = $fullPath.TrimEnd([System.IO.Path]::DirectorySeparatorChar)
    $fullRoot = [System.IO.Path]::GetFullPath($AllowedRoot)
    $fullRoot = $fullRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar)
    return $fullPath.StartsWith(
        $fullRoot + [System.IO.Path]::DirectorySeparatorChar,
        [System.StringComparison]::OrdinalIgnoreCase
    )
}

function Test-HaravanPathWithRetry {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Microsoft.PowerShell.Commands.TestPathType]$PathType = (
            [Microsoft.PowerShell.Commands.TestPathType]::Any
        ),
        [int]$MaxAttempts = 8
    )

    $lastError = $null
    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
        try {
            return Test-Path `
                -LiteralPath $Path `
                -PathType $PathType `
                -ErrorAction Stop
        } catch [System.UnauthorizedAccessException] {
            $lastError = $_
        } catch [System.IO.IOException] {
            $lastError = $_
        }

        if ($attempt -lt $MaxAttempts) {
            Start-Sleep -Milliseconds ([Math]::Min(250 * $attempt, 1000))
        }
    }

    if ($lastError) {
        throw $lastError
    }
    return $false
}

function Move-HaravanDirectoryAsideSafely {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$AllowedRoot,
        [int]$MaxAttempts = 8
    )

    if (-not (Test-HaravanPathWithinRoot -Path $Path -AllowedRoot $AllowedRoot)) {
        throw "Unsafe move target outside allowed root: $Path"
    }

    $parentPath = Split-Path -Parent $Path
    $leafName = Split-Path -Leaf $Path
    $destination = Join-Path $parentPath (
        ".haravan-stale-{0}-{1}" -f (
            $leafName,
            [System.Guid]::NewGuid().ToString("N")
        )
    )
    if (-not (Test-HaravanPathWithinRoot `
        -Path $destination `
        -AllowedRoot $AllowedRoot)) {
        throw "Unsafe stale-directory destination: $destination"
    }

    $lastError = $null
    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
        try {
            [System.IO.Directory]::Move($Path, $destination)
            return $destination
        } catch [System.IO.DirectoryNotFoundException] {
            return ""
        } catch [System.UnauthorizedAccessException] {
            $lastError = $_
        } catch [System.IO.IOException] {
            $lastError = $_
        }

        if ($attempt -lt $MaxAttempts) {
            Start-Sleep -Milliseconds ([Math]::Min(250 * $attempt, 1000))
        }
    }

    if ($lastError) {
        Write-Warning (
            "Could not move inaccessible directory aside: $Path. " +
            $lastError.Exception.Message
        )
    }
    return $null
}

function Remove-HaravanDirectorySafely {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$AllowedRoot,
        [int]$MaxAttempts = 8
    )

    if (-not (Test-HaravanPathWithinRoot -Path $Path -AllowedRoot $AllowedRoot)) {
        throw "Unsafe cleanup target outside allowed root: $Path"
    }

    $lastError = $null
    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
        $pathExists = $true
        try {
            $pathExists = Test-Path `
                -LiteralPath $Path `
                -PathType Container `
                -ErrorAction Stop
        } catch {
            # Google Drive can briefly deny stat access immediately after a
            # directory changes. Treat that as transient and retry cleanup.
            $lastError = $_
        }

        if (-not $pathExists) {
            return $true
        }

        try {
            Get-ChildItem -LiteralPath $Path -File -Force -Recurse |
                ForEach-Object {
                    Remove-Item -LiteralPath $_.FullName -Force -ErrorAction Stop
                }
            Get-ChildItem -LiteralPath $Path -Directory -Force -Recurse |
                Sort-Object { $_.FullName.Length } -Descending |
                ForEach-Object {
                    Remove-Item -LiteralPath $_.FullName -Force -ErrorAction Stop
                }
            Remove-Item -LiteralPath $Path -Force -ErrorAction Stop
        } catch {
            $lastError = $_
        }

        $pathStillExists = $true
        try {
            $pathStillExists = Test-Path `
                -LiteralPath $Path `
                -ErrorAction Stop
        } catch {
            # Keep retrying when Google Drive temporarily blocks metadata
            # access instead of terminating with UnauthorizedAccessException.
            $lastError = $_
        }

        if (-not $pathStillExists) {
            return $true
        }

        # If direct deletion was blocked by Google Drive file locks, move directory aside
        if ($lastError -and (Split-Path -Leaf $Path) -notlike ".*") {
            $stalePath = Move-HaravanDirectoryAsideSafely -Path $Path -AllowedRoot $AllowedRoot
            if ($stalePath) {
                # Directory moved aside successfully out of active workspace
                return $true
            }
        }

        if ($attempt -lt $MaxAttempts) {
            Start-Sleep -Milliseconds ([Math]::Min(250 * $attempt, 1000))
        }
    }

    if ($lastError) {
        Write-Warning "Could not remove directory: $Path. $($lastError.Exception.Message)"
    }
    return $false
}

function Sync-HaravanThemeContent {
    param(
        [Parameter(Mandatory = $true)][string]$SourceRoot,
        [Parameter(Mandatory = $true)][string]$TargetRoot
    )

    if (-not (Test-HaravanThemeContent -RootPath $SourceRoot)) {
        throw "Downloaded theme is incomplete: $SourceRoot"
    }
    if (-not (Test-Path -LiteralPath $TargetRoot -PathType Container)) {
        New-Item -ItemType Directory -Path $TargetRoot -Force | Out-Null
    }

    foreach ($directoryName in Get-ThemeContentDirectoryNames) {
        $sourceDirectory = Join-Path $SourceRoot $directoryName
        $targetDirectory = Join-Path $TargetRoot $directoryName

        # Let the retry-aware helper check existence too. A direct Test-Path
        # here can itself fail while Google Drive is refreshing the folder.
        $removed = Remove-HaravanDirectorySafely `
            -Path $targetDirectory `
            -AllowedRoot $TargetRoot `
            -MaxAttempts 8
        if (-not $removed) {
            Write-Warning (
                "Google Drive did not release the old directory. " +
                "Moving it aside before continuing: $targetDirectory"
            )
            $staleDirectory = Move-HaravanDirectoryAsideSafely `
                -Path $targetDirectory `
                -AllowedRoot $TargetRoot `
                -MaxAttempts 8
            if ($null -eq $staleDirectory) {
                throw (
                    "Could not replace local theme directory: $targetDirectory. " +
                    "Close files from this shop in VS Code, wait for Google Drive " +
                    "to finish syncing, and run pull again."
                )
            }
        } else {
            $staleDirectory = ""
        }
        if (Test-Path -LiteralPath $sourceDirectory -PathType Container) {
            Copy-Item -LiteralPath $sourceDirectory `
                -Destination $targetDirectory `
                -Recurse -Force
        }
        if (-not [string]::IsNullOrWhiteSpace($staleDirectory)) {
            $staleRemoved = Remove-HaravanDirectorySafely `
                -Path $staleDirectory `
                -AllowedRoot $TargetRoot `
                -MaxAttempts 8
            if (-not $staleRemoved) {
                Write-Warning "Old Google Drive directory was left at: $staleDirectory"
            }
        }
    }

    $sourceConfig = Join-Path $SourceRoot ".haravan-cli_local.json"
    if (-not (Test-Path -LiteralPath $sourceConfig -PathType Leaf)) {
        throw "Downloaded theme connection file is missing: $sourceConfig"
    }
    Copy-Item -LiteralPath $sourceConfig `
        -Destination (Join-Path $TargetRoot ".haravan-cli_local.json") `
        -Force
}

function Test-HaravanShopDirectory {
    param([Parameter(Mandatory = $true)][string]$RootPath)

    try {
        if (-not (Test-Path -LiteralPath $RootPath -PathType Container)) {
            return $false
        }
        $connectionPath = Join-Path $RootPath ".haravan-cli_local.json"
        return (Test-HaravanThemeContent -RootPath $RootPath) -and
            (Test-Path -LiteralPath $connectionPath -PathType Leaf)
    } catch {
        return $false
    }
}

function Finalize-HaravanShopDirectory {
    param(
        [Parameter(Mandatory = $true)][string]$SourceRoot,
        [Parameter(Mandatory = $true)][string]$DestinationRoot,
        [Parameter(Mandatory = $true)][string]$AllowedRoot
    )

    if (-not (Test-HaravanPathWithinRoot -Path $SourceRoot -AllowedRoot $AllowedRoot)) {
        throw "Unsafe shop staging path outside allowed root: $SourceRoot"
    }
    if (-not (Test-HaravanPathWithinRoot -Path $DestinationRoot -AllowedRoot $AllowedRoot)) {
        throw "Unsafe shop destination outside allowed root: $DestinationRoot"
    }
    if (Test-Path -LiteralPath $DestinationRoot) {
        throw "Shop folder already exists: $DestinationRoot"
    }

    $moveError = $null
    try {
        Move-Item -LiteralPath $SourceRoot `
            -Destination $DestinationRoot `
            -ErrorAction Stop
    } catch {
        $moveError = $_
    }

    if (-not $moveError) {
        if (-not (Test-HaravanShopDirectory -RootPath $DestinationRoot)) {
            throw "Final shop folder is incomplete after move: $DestinationRoot"
        }
        return $DestinationRoot
    }

    # Google Drive can complete the directory copy but fail while removing the
    # hidden staging directory. Preserve a complete destination in that case.
    $destinationReady = Test-HaravanShopDirectory -RootPath $DestinationRoot
    $sourceExists = Test-Path -LiteralPath $SourceRoot -PathType Container
    if (-not $destinationReady -and $sourceExists) {
        Write-Warning (
            "Directory move was blocked. Copying the downloaded theme to the " +
            "final shop folder instead: $DestinationRoot"
        )
        Sync-HaravanThemeContent `
            -SourceRoot $SourceRoot `
            -TargetRoot $DestinationRoot
        $destinationReady = Test-HaravanShopDirectory -RootPath $DestinationRoot
    }

    if (-not $destinationReady) {
        throw $moveError
    }

    if ($sourceExists) {
        $sourceRemoved = Remove-HaravanDirectorySafely `
            -Path $SourceRoot `
            -AllowedRoot $AllowedRoot
        if (-not $sourceRemoved) {
            Write-Warning (
                "Final shop folder is ready, but the staging directory could not " +
                "be removed: $SourceRoot"
            )
        }
    }

    Write-Warning (
        "Move reported an access error after the final shop folder was created; " +
        "the complete folder was kept: $DestinationRoot"
    )
    return $DestinationRoot
}

function Get-HaravanRecentStagedThemeRoot {
    param(
        [Parameter(Mandatory = $true)][string]$WorkingDirectory,
        [Parameter(Mandatory = $true)][datetime]$ReferenceTime
    )

    $candidatePaths = @(
        (Join-Path $script:ProjectRoot "shops\tmp_pull"),
        (Join-Path (Split-Path -Parent $WorkingDirectory) "tmp_pull"),
        (Join-Path $WorkingDirectory "tmp_pull")
    ) | ForEach-Object {
        try {
            [System.IO.Path]::GetFullPath($_)
        } catch {
            $null
        }
    } | Where-Object { $_ } | Select-Object -Unique

    $workingFullPath = [System.IO.Path]::GetFullPath($WorkingDirectory)
    foreach ($candidatePath in $candidatePaths) {
        if ([string]::Equals(
            $candidatePath,
            $workingFullPath,
            [System.StringComparison]::OrdinalIgnoreCase
        )) {
            continue
        }
        try {
            if (-not (Test-HaravanThemeContent -RootPath $candidatePath)) {
                continue
            }
            $latestFile = Get-ChildItem -LiteralPath $candidatePath -File -Recurse |
                Sort-Object LastWriteTime -Descending |
                Select-Object -First 1
            if ($latestFile -and $latestFile.LastWriteTime -ge $ReferenceTime.AddSeconds(-5)) {
                return $candidatePath
            }
        } catch {
            continue
        }
    }
    return ""
}

function Copy-HaravanStagedThemeToScratch {
    param(
        [Parameter(Mandatory = $true)][string]$StagedRoot,
        [Parameter(Mandatory = $true)][string]$ScratchRoot,
        [Parameter(Mandatory = $true)][string]$ScratchProject,
        [Parameter(Mandatory = $true)][string]$SourceConfig
    )

    $bridgeProject = Join-Path $ScratchRoot "staged-project"
    New-Item -ItemType Directory -Path $bridgeProject -Force | Out-Null
    Copy-Item -LiteralPath $SourceConfig `
        -Destination (Join-Path $bridgeProject ".haravan-cli_local.json") `
        -Force

    foreach ($directoryName in Get-ThemeContentDirectoryNames) {
        $sourceDirectory = Join-Path $StagedRoot $directoryName
        if (Test-Path -LiteralPath $sourceDirectory -PathType Container) {
            Copy-Item -LiteralPath $sourceDirectory `
                -Destination (Join-Path $bridgeProject $directoryName) `
                -Recurse -Force
        }
    }

    if (-not (Test-HaravanThemeContent -RootPath $bridgeProject)) {
        return $false
    }
    Sync-HaravanThemeContent `
        -SourceRoot $bridgeProject `
        -TargetRoot $ScratchProject
    return (Test-HaravanThemeContent -RootPath $ScratchProject)
}

function Invoke-HaravanThemeDownloadAt {
    param(
        [Parameter(Mandatory = $true)][string]$WorkingDirectory,
        [Parameter(Mandatory = $true)][string]$ThemeId
    )

    $sourceConfig = Join-Path $WorkingDirectory ".haravan-cli_local.json"
    if (-not (Test-Path -LiteralPath $sourceConfig -PathType Leaf)) {
        throw "Theme connection file is missing: $sourceConfig"
    }

    $scratchParent = [System.IO.Path]::GetTempPath()
    $scratchRoot = Join-Path $scratchParent (
        "haravan-theme-download-" + [System.Guid]::NewGuid().ToString("N")
    )
    $scratchProject = Join-Path $scratchRoot "project"
    New-Item -ItemType Directory -Path $scratchProject -Force | Out-Null
    Copy-Item -LiteralPath $sourceConfig `
        -Destination (Join-Path $scratchProject ".haravan-cli_local.json") `
        -Force

    try {
        $downloadStartedAt = Get-Date
        $fetchOutput = @()
        $fetchException = $null
        try {
            $fetchOutput = @(Invoke-HaravanCaptureAt `
                -WorkingDirectory $scratchProject `
                -AllowNonZero `
                "theme" "fetch" $ThemeId)
        } catch {
            $fetchException = $_
            if ($fetchException.Exception.Data.Contains("HaravanOutput")) {
                $fetchOutput = @($fetchException.Exception.Data["HaravanOutput"])
            }
        }

        $fetchContentReady = Test-HaravanThemeContent -RootPath $scratchProject
        $fetchReportedDuplicate = Test-HaravanRecoverableDuplicateAssetFailure `
            -Lines $fetchOutput
        if (-not $fetchContentReady -and $fetchReportedDuplicate) {
            $stagedThemeRoot = Get-HaravanRecentStagedThemeRoot `
                -WorkingDirectory $WorkingDirectory `
                -ReferenceTime $downloadStartedAt
            if (-not [string]::IsNullOrWhiteSpace($stagedThemeRoot)) {
                $fetchContentReady = Copy-HaravanStagedThemeToScratch `
                    -StagedRoot $stagedThemeRoot `
                    -ScratchRoot $scratchRoot `
                    -ScratchProject $scratchProject `
                    -SourceConfig $sourceConfig
                if ($fetchContentReady) {
                    Write-Warning (
                        "Haravan fetch wrote a complete theme to {0}; " +
                        "using that staged copy without retrying batch pull." -f
                            $stagedThemeRoot
                    )
                }
            }
        }
        $fetchFailed = $null -ne $fetchException -or
            (Test-HaravanThemeCommandFailure -Lines $fetchOutput)
        $recoverableDuplicate = $fetchContentReady -and
            $fetchReportedDuplicate
        $usedFallback = $false
        $syncSourceRoot = $scratchProject

        if ($recoverableDuplicate) {
            Write-Warning (
                "Haravan fetch reported a duplicate asset after creating a usable " +
                "theme. Keeping the downloaded copy and skipping batch-pull retry."
            )
        }

        if (($fetchFailed -and -not $recoverableDuplicate) -or
            -not $fetchContentReady) {
            if ($fetchException) {
                Write-Warning "Haravan theme fetch failed: $($fetchException.Exception.Message)"
            } elseif ($fetchFailed) {
                Write-Warning (
                    "Haravan CLI reported a fetch error even though it returned exit code 0."
                )
            } else {
                Write-Warning "Haravan theme fetch did not create a complete theme directory."
            }

            # Fetch can leave a partial theme even when the CLI reports an
            # error with exit code 0. Start fallback pull from clean folders.
            foreach ($directoryName in Get-ThemeContentDirectoryNames) {
                $partialDirectory = Join-Path $scratchProject $directoryName
                if (Test-Path -LiteralPath $partialDirectory -PathType Container) {
                    $partialRemoved = Remove-HaravanDirectorySafely `
                        -Path $partialDirectory `
                        -AllowedRoot $scratchProject `
                        -MaxAttempts 8
                    if (-not $partialRemoved) {
                        throw "Could not clear partial fetch directory: $partialDirectory"
                    }
                }
            }

            Write-Host "Retrying with Haravan batch pull..."

            $pullOutput = @(Invoke-HaravanCaptureAt `
                -WorkingDirectory $scratchProject `
                "theme" "pull" $ThemeId)
            $pullContentReady = Test-HaravanThemeContent -RootPath $scratchProject
            $pullFailed = Test-HaravanThemeCommandFailure -Lines $pullOutput
            $isAuthError = (Test-HaravanAuthFailure -Lines $fetchOutput) -or
                (Test-HaravanAuthFailure -Lines $pullOutput)
            $recoverablePullFileFailure = Test-HaravanRecoverablePullFileFailure `
                -Lines $pullOutput
            $failedFileKeys = @(Get-HaravanPullFileFailureKeys -Lines $pullOutput)

            if ($recoverablePullFileFailure -and $failedFileKeys.Count -gt 0) {
                foreach ($failedFileKey in $failedFileKeys) {
                    Write-Warning (
                        "Bỏ qua file remote không pull được: {0}" -f $failedFileKey
                    )
                }
            }

            if ($recoverablePullFileFailure -and -not $pullContentReady) {
                $recoveryProject = Join-Path $scratchRoot "recovered-project"
                if (Merge-HaravanPartialPullWithExistingTheme `
                    -ExistingRoot $WorkingDirectory `
                    -DownloadedRoot $scratchProject `
                    -RecoveryRoot $recoveryProject) {
                    $pullContentReady = $true
                    $syncSourceRoot = $recoveryProject
                    Write-Warning (
                        "Haravan pull stopped at an unavailable asset. " +
                        "Merging the downloaded files with the existing local theme."
                    )
                }
            }

            if ($isAuthError) {
                throw (
                    "Haravan CLI is not authenticated for theme $ThemeId. " +
                    "Run: npm.cmd run add:shop  (then login with the correct account)"
                )
            }
            if ($recoverablePullFileFailure) {
                if ($failedFileKeys.Count -gt 0) {
                    Restore-HaravanPullFileFailures `
                        -ExistingRoot $WorkingDirectory `
                        -DownloadedRoot $syncSourceRoot `
                        -RelativePaths $failedFileKeys | Out-Null
                }
                if ($pullContentReady) {
                    Write-Warning (
                        "Haravan pull skipped one or more unavailable files, but the " +
                        "remaining theme files are usable. Continuing with the downloaded theme."
                    )
                }
            } elseif ($pullFailed) {
                throw (
                    "Haravan pull failed for theme $ThemeId. " +
                    "If the problem persists, re-login with: npm.cmd run add:shop"
                )
            }
            if (-not $pullContentReady) {
                if ($recoverablePullFileFailure) {
                    Write-Warning (
                        "Downloaded theme is incomplete after skipping the failed files. " +
                        "Keeping the existing local theme unchanged."
                    )
                    return [PSCustomObject]@{
                        Mode         = "partial"
                        UsedFallback = $true
                        Partial      = $true
                        SkippedFiles = $failedFileKeys
                    }
                }
                throw "Haravan batch pull did not create a complete theme."
            }
            $usedFallback = $true
        }

        Sync-HaravanThemeContent `
            -SourceRoot $syncSourceRoot `
            -TargetRoot $WorkingDirectory

        return [PSCustomObject]@{
            Mode = if ($usedFallback) { "pull" } else { "fetch" }
            UsedFallback = $usedFallback
            Partial = $false
            SkippedFiles = @()
        }
    } finally {
        $scratchRemoved = Remove-HaravanDirectorySafely `
            -Path $scratchRoot `
            -AllowedRoot $scratchParent `
            -MaxAttempts 8
        if (-not $scratchRemoved) {
            Write-Warning "Local download scratch was left at: $scratchRoot"
        }
    }
}

function Invoke-HaravanThemeDownloadWithRelogin {
    param(
        [Parameter(Mandatory = $true)][string]$WorkingDirectory,
        [Parameter(Mandatory = $true)][string]$ThemeId,
        [Parameter(Mandatory = $true)][string]$OrgId
    )

    $attempt = 0
    while ($true) {
        $attempt++
        try {
            return Invoke-HaravanThemeDownloadAt `
                -WorkingDirectory $WorkingDirectory `
                -ThemeId $ThemeId
        } catch {
            if ($attempt -ge 2) {
                throw
            }

            Write-Host ""
            Write-Warning $_.Exception.Message
            Write-Host ""
            Write-Host "Pull failed. This is usually caused by an expired login session."
            $answer = Read-Host "Re-login now and retry? [Y/n]"
            if ($answer -match "^(?i:n|no)$") {
                throw
            }

            Write-Host ""
            Write-Host "Clearing old session for Organization $OrgId..."
            try {
                Invoke-HaravanAt -WorkingDirectory $WorkingDirectory "logout" $OrgId
            } catch {
                # Ignore if already logged out
            }

            Write-Host "Opening Haravan login for Organization $OrgId..."
            Invoke-HaravanAt -WorkingDirectory $WorkingDirectory "login"
            Write-Host ""
            Write-Host "Selecting Organization $OrgId..."
            Invoke-HaravanAt -WorkingDirectory $WorkingDirectory "select" $OrgId
            Write-Host ""
            Write-Host "Retrying pull after re-login..."
        }
    }
}

function Get-HaravanTableIds {
    param([string[]]$Lines)

    $ids = @()
    foreach ($line in $Lines) {
        $cleanLine = ([string]$line) -replace "\x1B\[[0-?]*[ -/]*[@-~]", ""
        if ($cleanLine -match "^\s*(\d{2,})(?:\s|$)") {
            $ids += $matches[1]
        }
    }
    return @($ids | Select-Object -Unique)
}

function Get-LoggedInOrganizationIds {
    try {
        $output = Invoke-HaravanCaptureAt `
            -WorkingDirectory $script:ProjectRoot `
            "whoiam"
        return @(Get-HaravanTableIds -Lines $output)
    } catch {
        return @()
    }
}

function Ensure-HaravanOrganizationLogin {
    param(
        [Parameter(Mandatory = $true)][string]$OrgId,
        [Parameter(Mandatory = $true)][string]$SourceUrl
    )

    while ($true) {
        $loggedInOrgIds = @(Get-LoggedInOrganizationIds)
        if ($OrgId -in $loggedInOrgIds) {
            Write-Host "Đã xác nhận đăng nhập Organization $OrgId." -ForegroundColor Green
            return $true
        }

        Write-Host ""
        Write-Warning (
            "Chưa thấy Organization {0} trong phiên Haravan hiện tại cho {1}." -f
                $OrgId, $SourceUrl
        )
        $answer = Read-Host (
            "Nhấn Enter để mở Haravan login; đăng nhập đúng tài khoản quản lý org " +
            "này rồi chờ kiểm tra lại. Nhập S để bỏ qua"
        )
        if ($answer -match '^(?i:s|skip|no)$') {
            return $false
        }

        Write-Host "Mở Haravan login..."
        Invoke-HaravanAt -WorkingDirectory $script:ProjectRoot "login"
    }
}

function Get-HaravanAccountEmail {
    param([Parameter(Mandatory = $true)][string]$OrgId)

    $authPath = [Environment]::GetEnvironmentVariable("haravan-cli_config_auth")
    if ([string]::IsNullOrWhiteSpace($authPath)) {
        $authPath = Join-Path $env:USERPROFILE ".haravan-cli.json"
    }
    if (-not (Test-Path -LiteralPath $authPath -PathType Leaf)) {
        return $null
    }

    try {
        $auth = Get-Content -LiteralPath $authPath -Raw | ConvertFrom-Json
        $orgRecord = $auth.PSObject.Properties[$OrgId].Value
        if ($orgRecord -and $orgRecord.email) {
            return [string]$orgRecord.email
        }
    } catch {
        return $null
    }
    return $null
}

function Get-ShopProjects {
    $shopsDirectory = Join-Path $script:ProjectRoot "shops"
    if (-not (Test-Path -LiteralPath $shopsDirectory -PathType Container)) {
        return @()
    }

    $projects = @()
    foreach ($directory in Get-ChildItem -LiteralPath $shopsDirectory -Directory) {
        if ($directory.Name.StartsWith(".")) {
            continue
        }
        $localConfig = Join-Path $directory.FullName ".haravan-cli_local.json"
        if (-not (Test-Path -LiteralPath $localConfig -PathType Leaf)) {
            continue
        }

        try {
            $config = Get-Content -LiteralPath $localConfig -Raw | ConvertFrom-Json
            if (-not $config.theme_id) {
                continue
            }
            $projects += [PSCustomObject]@{
                Path = $directory.FullName
                OrgId = [string]$config.org_id
                ThemeId = [string]$config.theme_id
                ThemeName = [string]$config.theme_name
                Email = Get-HaravanAccountEmail -OrgId ([string]$config.org_id)
            }
        } catch {
            Write-Warning "Ignoring invalid connection file: $localConfig"
        }
    }
    return @($projects | Sort-Object ThemeName, OrgId)
}

function Resolve-ShopSelection {
    param(
        [Parameter(Mandatory = $true)][object[]]$Projects,
        [Parameter(Mandatory = $true)][string]$Selection
    )

    $shopByOrgId = @($Projects | Where-Object { $_.OrgId -eq $Selection })
    if ($shopByOrgId.Count -eq 1) {
        return $shopByOrgId[0]
    }
    if ($shopByOrgId.Count -gt 1) {
        Write-Host ""
        Write-Host "Themes in Organization $Selection`:"
        for ($index = 0; $index -lt $shopByOrgId.Count; $index++) {
            $shop = $shopByOrgId[$index]
            Write-Host ("[{0}] {1} | theme {2}" -f (
                $index + 1
            ), $shop.ThemeName, $shop.ThemeId)
        }
        $themeSelection = Read-Host "Theme number or Theme ID [1]"
        if ([string]::IsNullOrWhiteSpace($themeSelection)) {
            $themeSelection = "1"
        }
        return Resolve-ShopSelection -Projects $shopByOrgId -Selection $themeSelection
    }

    $shopByThemeId = @($Projects | Where-Object { $_.ThemeId -eq $Selection })
    if ($shopByThemeId.Count -gt 0) {
        return $shopByThemeId[0]
    }

    $selectedIndex = 0
    if ([int]::TryParse($Selection, [ref]$selectedIndex) -and
        $selectedIndex -ge 1 -and $selectedIndex -le $Projects.Count) {
        return $Projects[$selectedIndex - 1]
    }

    throw "Invalid shop number, Organization ID, or Theme ID: $Selection"
}

function Select-ShopProject {
    $projects = @(Get-ShopProjects)
    if ($projects.Count -eq 0) {
        throw "No shop is configured. Run the VS Code task: Haravan: Login new shop"
    }
    if ($projects.Count -eq 1) {
        return $projects[0]
    }

    Write-Host ""
    Write-Host "Available shops:"
    for ($index = 0; $index -lt $projects.Count; $index++) {
        $project = $projects[$index]
        Write-Host ("[{0}] {1} | org {2} | theme {3}" -f (
            $index + 1
        ), $project.ThemeName, $project.OrgId, $project.ThemeId)
    }

    $selection = Read-Host "Shop number, Organization ID, or Theme ID [1]"
    if ([string]::IsNullOrWhiteSpace($selection)) {
        $selection = "1"
    }
    return Resolve-ShopSelection -Projects $projects -Selection $selection
}

function Get-ThemeContentDirectoryNames {
    return @(
        "assets",
        "config",
        "layout",
        "locales",
        "snippets",
        "templates"
    )
}

function Get-ThemeBackupDirectory {
    param([Parameter(Mandatory = $true)]$Shop)

    $backupRoot = Join-Path $script:ProjectRoot "backups"
    return Join-Path $backupRoot ("{0} - {1}" -f $Shop.OrgId, $Shop.ThemeId)
}

function Invoke-HaravanDailyBackupCleanup {
    [CmdletBinding()]
    param(
        [datetime]$ReferenceTime = (Get-Date),
        [string[]]$ProtectedPaths = @()
    )

    $projectRoot = [System.IO.Path]::GetFullPath($script:ProjectRoot).
        TrimEnd(
            [System.IO.Path]::DirectorySeparatorChar,
            [System.IO.Path]::AltDirectorySeparatorChar
        )
    $backupRoot = [System.IO.Path]::GetFullPath(
        (Join-Path $script:ProjectRoot "backups")
    ).TrimEnd(
        [System.IO.Path]::DirectorySeparatorChar,
        [System.IO.Path]::AltDirectorySeparatorChar
    )
    $backupParent = [System.IO.Path]::GetFullPath(
        (Split-Path -Parent $backupRoot)
    ).TrimEnd(
        [System.IO.Path]::DirectorySeparatorChar,
        [System.IO.Path]::AltDirectorySeparatorChar
    )

    if ($backupParent -ne $projectRoot -or
        (Split-Path -Leaf $backupRoot) -ne "backups") {
        throw "Unsafe backup cleanup root: $backupRoot"
    }

    $cutoff = $ReferenceTime.AddDays(-1)
    if (-not (Test-Path -LiteralPath $backupRoot -PathType Container)) {
        return [PSCustomObject]@{
            Root              = $backupRoot
            Cutoff            = $cutoff
            DeletedFiles      = 0
            DeletedDirectories = 0
            DeletedBytes      = 0L
            FailedFiles       = 0
            FailedDirectories = 0
            SkippedLinks      = 0
        }
    }

    $protected = New-Object 'System.Collections.Generic.HashSet[string]' (
        [System.StringComparer]::OrdinalIgnoreCase
    )
    foreach ($path in @($ProtectedPaths)) {
        if ([string]::IsNullOrWhiteSpace([string]$path)) {
            continue
        }
        $fullProtectedPath = [System.IO.Path]::GetFullPath([string]$path)
        if (-not (Test-HaravanPathWithinRoot `
            -Path $fullProtectedPath `
            -AllowedRoot $backupRoot)) {
            throw "Protected backup path is outside backups/: $fullProtectedPath"
        }
        [void]$protected.Add($fullProtectedPath)
    }

    $deletedFiles = 0
    $deletedDirectories = 0
    $deletedBytes = 0L
    $failedFiles = 0
    $failedDirectories = 0
    $skippedLinks = 0
    $pendingDirectories = New-Object 'System.Collections.Generic.Stack[string]'
    $directoryRecords = New-Object 'System.Collections.Generic.List[object]'
    [void]$directoryRecords.Add([PSCustomObject]@{
        Path = $backupRoot
        LastWriteTime = $ReferenceTime
    })
    $pendingDirectories.Push($backupRoot)

    while ($pendingDirectories.Count -gt 0) {
        $directory = $pendingDirectories.Pop()
        try {
            $children = @(Get-ChildItem `
                -LiteralPath $directory `
                -Force `
                -ErrorAction Stop)
        } catch {
            Write-Warning (
                "Không thể đọc thư mục backup khi dọn hằng ngày: {0}. {1}" -f `
                    $directory,
                    $_.Exception.Message
            )
            continue
        }

        foreach ($child in $children) {
            $isReparsePoint = (
                $child.Attributes -band [System.IO.FileAttributes]::ReparsePoint
            ) -ne 0
            if ($child.PSIsContainer) {
                if ($isReparsePoint) {
                    $skippedLinks++
                    Write-Warning "Bỏ qua thư mục liên kết trong backups/: $($child.FullName)"
                    continue
                }
                [void]$directoryRecords.Add([PSCustomObject]@{
                    Path = $child.FullName
                    LastWriteTime = $child.LastWriteTime
                })
                $pendingDirectories.Push($child.FullName)
                continue
            }

            if ($isReparsePoint) {
                $skippedLinks++
                Write-Warning "Bỏ qua file liên kết trong backups/: $($child.FullName)"
                continue
            }
            if ($child.LastWriteTime -ge $cutoff -or
                $protected.Contains($child.FullName)) {
                continue
            }
            if (-not (Test-HaravanPathWithinRoot `
                -Path $child.FullName `
                -AllowedRoot $backupRoot)) {
                throw "Unsafe backup cleanup target outside backups/: $($child.FullName)"
            }

            $removed = $false
            $lastError = $null
            for ($attempt = 1; $attempt -le 4; $attempt++) {
                try {
                    Remove-Item `
                        -LiteralPath $child.FullName `
                        -Force `
                        -ErrorAction Stop
                    $removed = $true
                    break
                } catch [System.UnauthorizedAccessException] {
                    $lastError = $_
                } catch [System.IO.IOException] {
                    $lastError = $_
                } catch [System.Management.Automation.ItemNotFoundException] {
                    $removed = $true
                    break
                } catch {
                    $lastError = $_
                }

                if ($attempt -lt 4) {
                    Start-Sleep -Milliseconds (150 * $attempt)
                }
            }

            if ($removed) {
                $deletedFiles++
                $deletedBytes += [long]$child.Length
            } else {
                $failedFiles++
                Write-Warning (
                    "Không thể xóa backup cũ: {0}. {1}" -f `
                        $child.FullName,
                        $lastError.Exception.Message
                )
            }
        }
    }

    foreach ($directoryRecord in @(
        $directoryRecords | Sort-Object { ([string]$_.Path).Length } -Descending
    )) {
        $directoryPath = [string]$directoryRecord.Path
        if ($directoryPath -eq $backupRoot -or
            $protected.Contains($directoryPath) -or
            $directoryRecord.LastWriteTime -ge $cutoff) {
            continue
        }
        if (-not (Test-HaravanPathWithinRoot `
            -Path $directoryPath `
            -AllowedRoot $backupRoot)) {
            throw "Unsafe backup cleanup target outside backups/: $directoryPath"
        }

        try {
            $remainingItems = @(Get-ChildItem `
                -LiteralPath $directoryPath `
                -Force `
                -ErrorAction Stop)
        } catch {
            $failedDirectories++
            Write-Warning (
                "Không thể kiểm tra thư mục backup cũ: {0}. {1}" -f `
                    $directoryPath,
                    $_.Exception.Message
            )
            continue
        }
        if ($remainingItems.Count -gt 0) {
            continue
        }

        $removed = $false
        $lastError = $null
        for ($attempt = 1; $attempt -le 4; $attempt++) {
            try {
                Remove-Item `
                    -LiteralPath $directoryPath `
                    -Force `
                    -ErrorAction Stop
                $removed = $true
                break
            } catch [System.UnauthorizedAccessException] {
                $lastError = $_
            } catch [System.IO.IOException] {
                $lastError = $_
            } catch [System.Management.Automation.ItemNotFoundException] {
                $removed = $true
                break
            } catch {
                $lastError = $_
            }

            if ($attempt -lt 4) {
                Start-Sleep -Milliseconds (150 * $attempt)
            }
        }

        if ($removed) {
            $deletedDirectories++
        } else {
            $failedDirectories++
            Write-Warning (
                "Không thể xóa thư mục backup cũ: {0}. {1}" -f `
                    $directoryPath,
                    $lastError.Exception.Message
            )
        }
    }

    if ($deletedFiles -gt 0 -or $deletedDirectories -gt 0) {
        $deletedMb = [Math]::Round($deletedBytes / 1MB, 2)
        Write-Host (
            (
                "Dọn backup hằng ngày: đã xóa {0} file cũ ({1} MB) và {2} thư mục rỗng; " +
                "giữ dữ liệu mới hơn {3}."
            ) -f `
                $deletedFiles,
                $deletedMb,
                $deletedDirectories,
                $cutoff.ToString("dd/MM/yyyy HH:mm")
        )
    }

    return [PSCustomObject]@{
        Root              = $backupRoot
        Cutoff            = $cutoff
        DeletedFiles      = $deletedFiles
        DeletedDirectories = $deletedDirectories
        DeletedBytes      = $deletedBytes
        FailedFiles       = $failedFiles
        FailedDirectories = $failedDirectories
        SkippedLinks      = $skippedLinks
    }
}

function Invoke-HaravanDailyShopCleanup {
    [CmdletBinding()]
    param(
        [datetime]$ReferenceTime = (Get-Date),
        [string[]]$ProtectedPaths = @()
    )

    $projectRoot = [System.IO.Path]::GetFullPath($script:ProjectRoot).TrimEnd(
        [System.IO.Path]::DirectorySeparatorChar,
        [System.IO.Path]::AltDirectorySeparatorChar
    )
    $shopsRoot = [System.IO.Path]::GetFullPath(
        (Join-Path $script:ProjectRoot "shops")
    ).TrimEnd(
        [System.IO.Path]::DirectorySeparatorChar,
        [System.IO.Path]::AltDirectorySeparatorChar
    )
    $shopsParent = [System.IO.Path]::GetFullPath(
        (Split-Path -Parent $shopsRoot)
    ).TrimEnd(
        [System.IO.Path]::DirectorySeparatorChar,
        [System.IO.Path]::AltDirectorySeparatorChar
    )

    if ($shopsParent -ne $projectRoot -or
        (Split-Path -Leaf $shopsRoot) -ne "shops") {
        throw "Unsafe shop cleanup root: $shopsRoot"
    }

    $cutoff = $ReferenceTime.AddDays(-1)
    if (-not (Test-Path -LiteralPath $shopsRoot -PathType Container)) {
        return [PSCustomObject]@{
            Root = $shopsRoot
            Cutoff = $cutoff
            DeletedDirectories = 0
            FailedDirectories = 0
            SkippedLinks = 0
        }
    }

    $protected = New-Object 'System.Collections.Generic.HashSet[string]' (
        [System.StringComparer]::OrdinalIgnoreCase
    )
    foreach ($path in @($ProtectedPaths)) {
        if ([string]::IsNullOrWhiteSpace([string]$path)) {
            continue
        }
        $fullProtectedPath = [System.IO.Path]::GetFullPath([string]$path)
        if (-not (Test-HaravanPathWithinRoot `
            -Path $fullProtectedPath `
            -AllowedRoot $shopsRoot)) {
            throw "Protected shop path is outside shops/: $fullProtectedPath"
        }
        [void]$protected.Add($fullProtectedPath)
    }

    $deletedDirectories = 0
    $failedDirectories = 0
    $skippedLinks = 0
    $shopDirectories = @(Get-ChildItem `
        -LiteralPath $shopsRoot `
        -Directory `
        -Force `
        -ErrorAction Stop)

    foreach ($shopDirectory in $shopDirectories) {
        $isReparsePoint = (
            $shopDirectory.Attributes -band [System.IO.FileAttributes]::ReparsePoint
        ) -ne 0
        if ($isReparsePoint) {
            $skippedLinks++
            Write-Warning "Bỏ qua thư mục shop liên kết: $($shopDirectory.FullName)"
            continue
        }
        if ($protected.Contains($shopDirectory.FullName) -or
            $shopDirectory.LastWriteTime -ge $cutoff) {
            continue
        }
        if (-not (Test-HaravanPathWithinRoot `
            -Path $shopDirectory.FullName `
            -AllowedRoot $shopsRoot)) {
            throw "Unsafe shop cleanup target outside shops/: $($shopDirectory.FullName)"
        }

        $removed = Remove-HaravanDirectorySafely `
            -Path $shopDirectory.FullName `
            -AllowedRoot $shopsRoot
        if ($removed) {
            $deletedDirectories++
        } else {
            $failedDirectories++
            Write-Warning "Không thể xóa theme quá hạn trong shops/: $($shopDirectory.FullName)"
        }
    }

    if ($deletedDirectories -gt 0) {
        Write-Host (
            "Dọn shops hằng ngày: đã xóa {0} theme quá 24 giờ; giữ theme mới hơn {1}." -f `
                $deletedDirectories,
                $cutoff.ToString("dd/MM/yyyy HH:mm")
        )
    }

    return [PSCustomObject]@{
        Root = $shopsRoot
        Cutoff = $cutoff
        DeletedDirectories = $deletedDirectories
        FailedDirectories = $failedDirectories
        SkippedLinks = $skippedLinks
    }
}

function Get-ThemeBackups {
    param([Parameter(Mandatory = $true)]$Shop)

    $backupDirectory = Get-ThemeBackupDirectory -Shop $Shop
    if (-not (Test-Path -LiteralPath $backupDirectory -PathType Container)) {
        return @()
    }

    return @(Get-ChildItem -LiteralPath $backupDirectory -File -Filter "*.zip" |
        Sort-Object LastWriteTime -Descending)
}

function Get-ThemeBackupManifest {
    param([Parameter(Mandatory = $true)][string]$BackupPath)

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [System.IO.Compression.ZipFile]::OpenRead($BackupPath)
    try {
        $manifestEntry = $archive.Entries | Where-Object {
            $_.FullName -eq "_haravan-backup.json"
        } | Select-Object -First 1
        if (-not $manifestEntry) {
            return $null
        }

        $reader = New-Object System.IO.StreamReader($manifestEntry.Open())
        try {
            return ($reader.ReadToEnd() | ConvertFrom-Json)
        } finally {
            $reader.Dispose()
        }
    } finally {
        $archive.Dispose()
    }
}

function Get-ThemeContentFingerprint {
    param([Parameter(Mandatory = $true)][hashtable]$FileHashMap)

    $builder = New-Object System.Text.StringBuilder
    foreach ($relativePath in @($FileHashMap.Keys | Sort-Object)) {
        [void]$builder.Append($relativePath)
        [void]$builder.Append("|")
        [void]$builder.Append($FileHashMap[$relativePath])
        [void]$builder.Append("`n")
    }

    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($builder.ToString())
        $hashBytes = $sha256.ComputeHash($bytes)
        return ([System.BitConverter]::ToString($hashBytes) -replace "-", "")
    } finally {
        $sha256.Dispose()
    }
}

function New-ThemeBackup {
    param(
        [Parameter(Mandatory = $true)]$Shop,
        [string]$Reason = "manual",
        [string[]]$RelativePaths,
        [switch]$Force
    )

    $backupOperationTime = Get-Date

    if (-not (Test-HaravanPathWithRetry `
        -Path $Shop.Path `
        -PathType Container `
        -MaxAttempts 8)) {
        throw "Theme directory does not exist: $($Shop.Path)"
    }

    $themeDirectories = @(Get-ThemeContentDirectoryNames | Where-Object {
        Test-HaravanPathWithRetry `
            -Path (Join-Path $Shop.Path $_) `
            -PathType Container `
            -MaxAttempts 8
    })
    if ($themeDirectories.Count -eq 0) {
        throw "No Haravan theme directories were found in: $($Shop.Path)"
    }

    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem

    $backupDirectory = Get-ThemeBackupDirectory -Shop $Shop
    New-Item -ItemType Directory -Path $backupDirectory -Force | Out-Null

    $isSelectedBackup = @(
        $RelativePaths |
            Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) }
    ).Count -gt 0
    $selectedRelativePaths = @()
    if ($isSelectedBackup) {
        $selectedRelativePaths = @(
            $RelativePaths |
                ForEach-Object { ([string]$_ -replace '\\', '/').TrimStart('/') } |
                Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
                Sort-Object -Unique
        )
        $invalidPaths = @($selectedRelativePaths | Where-Object {
            $candidatePath = Join-Path $Shop.Path ($_ -replace '/', [System.IO.Path]::DirectorySeparatorChar)
            $_ -match '(^|/)\.\.(/|$)' -or
                -not (Test-HaravanPathWithinRoot -Path $candidatePath -AllowedRoot $Shop.Path) -or
                -not (Test-Path -LiteralPath $candidatePath -PathType Leaf)
        })
        if ($invalidPaths.Count -gt 0) {
            throw "Selected backup contains invalid or missing theme files: $($invalidPaths -join ', ')"
        }
        $fileHashMap = @{}
        foreach ($relativePath in $selectedRelativePaths) {
            $filePath = Join-Path $Shop.Path (
                $relativePath -replace '/', [System.IO.Path]::DirectorySeparatorChar
            )
            $fileHashMap[$relativePath] = Get-HaravanFileSha256 -Path $filePath
        }
    } else {
        $fileHashMap = Get-ThemeFileHashMap -RootPath $Shop.Path
    }
    $contentFingerprint = Get-ThemeContentFingerprint -FileHashMap $fileHashMap
    if (-not $Force) {
        $latestBackup = @(Get-ThemeBackups -Shop $Shop | Select-Object -First 1)
        if ($latestBackup.Count -eq 1) {
            try {
                $latestManifest = Get-ThemeBackupManifest -BackupPath $latestBackup[0].FullName
                if ($latestManifest -and
                    [string]$latestManifest.orgId -eq [string]$Shop.OrgId -and
                    [string]$latestManifest.themeId -eq [string]$Shop.ThemeId -and
                    $latestBackup[0].LastWriteTime -ge $backupOperationTime.AddDays(-1) -and
                    $latestBackup[0].LastWriteTime -le $backupOperationTime -and
                    [string]$latestManifest.contentFingerprint -eq $contentFingerprint) {
                    $dailyCleanup = Invoke-HaravanDailyBackupCleanup `
                        -ReferenceTime $backupOperationTime `
                        -ProtectedPaths @($latestBackup[0].FullName)
                    $dailyShopCleanup = Invoke-HaravanDailyShopCleanup `
                        -ReferenceTime $backupOperationTime `
                        -ProtectedPaths @($Shop.Path)
                    return [PSCustomObject]@{
                        Path = $latestBackup[0].FullName
                        CreatedAt = $latestBackup[0].LastWriteTime
                        FileCount = [int]$latestManifest.fileCount
                        SizeBytes = $latestBackup[0].Length
                        WasCreated = $false
                        DailyCleanup = $dailyCleanup
                        DailyShopCleanup = $dailyShopCleanup
                    }
                }
            } catch {
                Write-Warning "Could not inspect the latest backup. Creating a new one."
            }
        }
    }

    $safeReason = $Reason -replace '[^\p{L}\p{N}._-]+', '-'
    $timestamp = $backupOperationTime.ToString("yyyyMMdd-HHmmss-fff")
    $backupPath = Join-Path $backupDirectory "$timestamp-$safeReason.zip"
    $createdAt = $backupOperationTime
    $fileCount = 0
    $stream = $null
    $archive = $null

    try {
        $stream = [System.IO.File]::Open(
            $backupPath,
            [System.IO.FileMode]::CreateNew,
            [System.IO.FileAccess]::ReadWrite,
            [System.IO.FileShare]::None
        )
        $archive = New-Object System.IO.Compression.ZipArchive(
            $stream,
            [System.IO.Compression.ZipArchiveMode]::Create,
            $false
        )

        if ($isSelectedBackup) {
            $filesToArchive = @($selectedRelativePaths | ForEach-Object {
                Join-Path $Shop.Path ($_ -replace '/', [System.IO.Path]::DirectorySeparatorChar)
            } | ForEach-Object { Get-Item -LiteralPath $_ -Force })
        } else {
            $filesToArchive = @(
                foreach ($directoryName in $themeDirectories) {
                    $directoryPath = Join-Path $Shop.Path $directoryName
                    foreach ($file in Get-ChildItem -LiteralPath $directoryPath -File -Recurse) {
                        $file
                    }
                }
            )
        }

        foreach ($file in $filesToArchive) {
                $relativePath = $file.FullName.Substring($Shop.Path.Length).
                    TrimStart([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar) -replace '\\', '/'
                [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
                    $archive,
                    $file.FullName,
                    $relativePath,
                    [System.IO.Compression.CompressionLevel]::Optimal
                ) | Out-Null
                $fileCount++
        }

        $manifest = [PSCustomObject]@{
            formatVersion = 2
            createdAt = $createdAt.ToString("o")
            reason = $Reason
            scope = if ($isSelectedBackup) { "selected" } else { "full" }
            orgId = [string]$Shop.OrgId
            themeId = [string]$Shop.ThemeId
            themeName = [string]$Shop.ThemeName
            fileCount = $fileCount
            contentFingerprint = $contentFingerprint
            relativePaths = if ($isSelectedBackup) { @($selectedRelativePaths) } else { @() }
            fileHashes = $fileHashMap
        } | ConvertTo-Json

        $manifestEntry = $archive.CreateEntry(
            "_haravan-backup.json",
            [System.IO.Compression.CompressionLevel]::Optimal
        )
        $writer = New-Object System.IO.StreamWriter($manifestEntry.Open())
        try {
            $writer.Write($manifest)
        } finally {
            $writer.Dispose()
        }
    } catch {
        if ($archive) {
            $archive.Dispose()
            $archive = $null
        }
        if ($stream) {
            $stream.Dispose()
            $stream = $null
        }
        if (Test-Path -LiteralPath $backupPath -PathType Leaf) {
            Remove-Item -LiteralPath $backupPath
        }
        throw
    } finally {
        if ($archive) {
            $archive.Dispose()
        }
        if ($stream) {
            $stream.Dispose()
        }
    }

    $backupFile = Get-Item -LiteralPath $backupPath
    $dailyCleanup = Invoke-HaravanDailyBackupCleanup `
        -ReferenceTime $backupOperationTime `
        -ProtectedPaths @($backupFile.FullName)
    $dailyShopCleanup = Invoke-HaravanDailyShopCleanup `
        -ReferenceTime $backupOperationTime `
        -ProtectedPaths @($Shop.Path)
    return [PSCustomObject]@{
        Path = $backupFile.FullName
        CreatedAt = $createdAt
        FileCount = $fileCount
        SizeBytes = $backupFile.Length
        WasCreated = $true
        DailyCleanup = $dailyCleanup
        DailyShopCleanup = $dailyShopCleanup
    }
}

function Get-HaravanFileSha256 {
    param([Parameter(Mandatory = $true)][string]$Path)

    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    $stream = $null
    try {
        $stream = [System.IO.File]::OpenRead($Path)
        $hashBytes = $sha256.ComputeHash($stream)
        return ([System.BitConverter]::ToString($hashBytes) -replace "-", "")
    } finally {
        if ($stream) {
            $stream.Dispose()
        }
        $sha256.Dispose()
    }
}

function Get-ThemeFileHashMap {
    param([Parameter(Mandatory = $true)][string]$RootPath)

    $files = @{}
    foreach ($directoryName in Get-ThemeContentDirectoryNames) {
        $directoryPath = Join-Path $RootPath $directoryName
        if (-not (Test-HaravanPathWithRetry `
            -Path $directoryPath `
            -PathType Container `
            -MaxAttempts 8)) {
            continue
        }

        foreach ($file in Get-ChildItem -LiteralPath $directoryPath -File -Recurse) {
            $relativePath = $file.FullName.Substring($RootPath.Length).
                TrimStart([System.IO.Path]::DirectorySeparatorChar) -replace '\\', '/'
            $files[$relativePath] = Get-HaravanFileSha256 -Path $file.FullName
        }
    }
    return $files
}

function Test-ThemeTextFile {
    param([Parameter(Mandatory = $true)][string]$RelativePath)

    $extension = [System.IO.Path]::GetExtension($RelativePath).ToLowerInvariant()
    return $extension -in @(
        ".css",
        ".csv",
        ".html",
        ".js",
        ".json",
        ".liquid",
        ".map",
        ".md",
        ".scss",
        ".svg",
        ".txt",
        ".xml"
    )
}

function Get-ShopIdsFromUrl {
    param([Parameter(Mandatory = $true)][string]$Url)

    Write-Host "Đang fetch source: $Url"
    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 15
    } catch {
        throw "Không thể kết nối tới $Url : $($_.Exception.Message)"
    }

    $html = $response.Content

    # Haravan storefronts may expose either the CDN theme path or the theme
    # asset host path, for example: //theme.hstatic.net/{org_id}/{theme_id}/14/...
    $match = [regex]::Match(
        $html,
        '(?i)(?:cdn\.hstatic\.net/themes/|theme\.hstatic\.net/)(\d+)/(\d+)/'
    )
    if (-not $match.Success) {
        throw (
            "Không tìm thấy org_id / theme_id trong source của: $Url`n" +
            "Hãy chắc chắn URL trả về HTML chứa link dạng " +
            "cdn.hstatic.net/themes/{org_id}/{theme_id}/... hoặc " +
            "theme.hstatic.net/{org_id}/{theme_id}/..."
        )
    }

    $orgId   = $match.Groups[1].Value
    $themeId = $match.Groups[2].Value
    Write-Host "Tìm thấy: org_id = $orgId | theme_id = $themeId"
    return [PSCustomObject]@{
        OrgId   = $orgId
        ThemeId = $themeId
    }
}

function Get-HaravanGitCommand {
    $command = Get-Command "git.exe" -ErrorAction SilentlyContinue
    if (-not $command) {
        $command = Get-Command "git" -ErrorAction SilentlyContinue
    }
    if ($command) {
        return $command.Source
    }
    return $null
}

function Invoke-HaravanGitCommand {
    param(
        [Parameter(Mandatory = $true)][string]$WorkingDirectory,
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [switch]$AllowNonZero
    )

    $gitCommand = Get-HaravanGitCommand
    if (-not $gitCommand) {
        throw "Git chưa được cài đặt hoặc không có trong PATH."
    }
    if (-not (Test-Path -LiteralPath $WorkingDirectory -PathType Container)) {
        throw "Không tìm thấy thư mục chạy Git: $WorkingDirectory"
    }

    $previousErrorPreference = $ErrorActionPreference
    Push-Location -LiteralPath $WorkingDirectory
    try {
        # Capture output so a failed push cannot leak credentials embedded in a
        # remote URL into the workflow log.
        $ErrorActionPreference = "Continue"
        $output = @(& $gitCommand @Arguments 2>&1)
        $exitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousErrorPreference
        Pop-Location
    }

    $lines = @($output | ForEach-Object { [string]$_ })
    if ($exitCode -ne 0 -and -not $AllowNonZero) {
        $commandException = [System.Exception]::new(
            "Git command failed with exit code $exitCode."
        )
        $commandException.Data["GitOutput"] = $lines
        $commandException.Data["GitExitCode"] = $exitCode
        throw $commandException
    }

    return [PSCustomObject]@{
        ExitCode = $exitCode
        Output   = $lines
    }
}

function ConvertTo-HaravanGitBoolean {
    param(
        [AllowNull()][object]$Value,
        [Parameter(Mandatory = $true)][bool]$Default
    )

    if ($null -eq $Value) {
        return $Default
    }
    if ($Value -is [bool]) {
        return [bool]$Value
    }

    switch (([string]$Value).Trim().ToLowerInvariant()) {
        "true" { return $true }
        "1"    { return $true }
        "yes"  { return $true }
        "on"   { return $true }
        "false" { return $false }
        "0"     { return $false }
        "no"    { return $false }
        "off"   { return $false }
        default { return $Default }
    }
}

function Get-HaravanGitSettings {
    param(
        [string]$RepositoryPathOverride,
        [string]$RemoteOverride,
        [string]$BranchOverride,
        [string]$CommitMessageOverride
    )

    $configPath = Join-Path $script:ProjectRoot ".haravan-workflow.json"
    $workflowConfig = $null
    if (Test-Path -LiteralPath $configPath -PathType Leaf) {
        try {
            $workflowConfig = Get-Content -LiteralPath $configPath -Raw |
                ConvertFrom-Json -ErrorAction Stop
        } catch {
            throw "Không đọc được cấu hình workflow: $configPath. $($_.Exception.Message)"
        }
    }

    $gitConfig = $null
    if ($workflowConfig) {
        $gitProperty = $workflowConfig.PSObject.Properties["git"]
        if ($gitProperty) {
            $gitConfig = $gitProperty.Value
        }
    }

    $enabled = $true
    $pushToRemote = $true
    $repositoryPath = ""
    $remote = "origin"
    $branch = ""
    $commitPrefix = "Haravan theme"

    if ($gitConfig) {
        $property = $gitConfig.PSObject.Properties["enabled"]
        if ($property) {
            $enabled = ConvertTo-HaravanGitBoolean `
                -Value $property.Value `
                -Default $enabled
        }
        $property = $gitConfig.PSObject.Properties["push"]
        if ($property) {
            $pushToRemote = ConvertTo-HaravanGitBoolean `
                -Value $property.Value `
                -Default $pushToRemote
        }
        $property = $gitConfig.PSObject.Properties["repositoryPath"]
        if (-not $property) {
            $property = $gitConfig.PSObject.Properties["repoPath"]
        }
        if ($property -and $null -ne $property.Value) {
            $repositoryPath = ([string]$property.Value).Trim()
        }
        $property = $gitConfig.PSObject.Properties["remote"]
        if ($property -and $null -ne $property.Value) {
            $remote = ([string]$property.Value).Trim()
        }
        $property = $gitConfig.PSObject.Properties["branch"]
        if ($property -and $null -ne $property.Value) {
            $branch = ([string]$property.Value).Trim()
        }
        $property = $gitConfig.PSObject.Properties["commitMessagePrefix"]
        if ($property -and $null -ne $property.Value) {
            $commitPrefix = ([string]$property.Value).Trim()
        }
    }

    if (-not [string]::IsNullOrWhiteSpace($RepositoryPathOverride)) {
        $repositoryPath = $RepositoryPathOverride.Trim()
    }
    if (-not [string]::IsNullOrWhiteSpace($RemoteOverride)) {
        $remote = $RemoteOverride.Trim()
    }
    if (-not [string]::IsNullOrWhiteSpace($BranchOverride)) {
        $branch = $BranchOverride.Trim()
    }
    if (-not [string]::IsNullOrWhiteSpace($CommitMessageOverride)) {
        $commitPrefix = $CommitMessageOverride.Trim()
    }

    return [PSCustomObject]@{
        ConfigPath       = $configPath
        Enabled          = $enabled
        PushToRemote     = $pushToRemote
        RepositoryPath   = $repositoryPath
        Remote           = $remote
        Branch           = $branch
        CommitPrefix     = $commitPrefix
    }
}

function Test-HaravanPathWithinOrEqual {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$AllowedRoot
    )

    $fullPath = [System.IO.Path]::GetFullPath($Path).TrimEnd('\', '/')
    $fullRoot = [System.IO.Path]::GetFullPath($AllowedRoot).TrimEnd('\', '/')
    return $fullPath.Equals(
        $fullRoot,
        [System.StringComparison]::OrdinalIgnoreCase
    ) -or $fullPath.StartsWith(
        $fullRoot + [System.IO.Path]::DirectorySeparatorChar,
        [System.StringComparison]::OrdinalIgnoreCase
    )
}

function Resolve-HaravanGitRepository {
    param(
        [Parameter(Mandatory = $true)][string]$ShopPath,
        [string]$ConfiguredPath
    )

    $probePath = $ShopPath
    if (-not [string]::IsNullOrWhiteSpace($ConfiguredPath)) {
        $probePath = $ConfiguredPath
        if (-not [System.IO.Path]::IsPathRooted($probePath)) {
            $probePath = Join-Path $script:ProjectRoot $probePath
        }
        if (-not (Test-Path -LiteralPath $probePath -PathType Container)) {
            throw "Không tìm thấy Git repository đã cấu hình: $probePath"
        }
    }

    $probe = Invoke-HaravanGitCommand `
        -WorkingDirectory $probePath `
        -Arguments @("rev-parse", "--show-toplevel") `
        -AllowNonZero
    if ($probe.ExitCode -ne 0) {
        if (-not [string]::IsNullOrWhiteSpace($ConfiguredPath)) {
            throw "Đường dẫn đã cấu hình không phải Git repository: $probePath"
        }
        return ""
    }

    $repositoryRoot = @(
        $probe.Output |
            ForEach-Object { ([string]$_).Trim() } |
            Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    ) | Select-Object -First 1
    if ([string]::IsNullOrWhiteSpace([string]$repositoryRoot)) {
        return ""
    }
    return [System.IO.Path]::GetFullPath([string]$repositoryRoot)
}

function Get-HaravanGitFailureDetail {
    param([Parameter(Mandatory = $true)]$ErrorRecord)

    $details = @()
    $exception = $ErrorRecord.Exception
    if ($exception -and $exception.Data.Contains("GitOutput")) {
        $details = @($exception.Data["GitOutput"] | ForEach-Object {
            # Avoid logging credentials if a Git remote contains user:token@host.
            ([string]$_) -replace `
                '(?i)(https?://)([^\s/:@]+):([^\s/@]+)@', '$1***:***@'
        } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
            Select-Object -First 3)
    }
    if ($details.Count -eq 0) {
        return $ErrorRecord.Exception.Message
    }
    return ($ErrorRecord.Exception.Message + " " + ($details -join " ")).Trim()
}

function Invoke-HaravanGitArchive {
    param(
        [Parameter(Mandatory = $true)]$Shop,
        [AllowEmptyCollection()][string[]]$RelativePaths,
        [string]$RepositoryPath,
        [string]$Remote,
        [string]$Branch,
        [string]$CommitMessage,
        [switch]$SkipPush
    )

    $requestedPaths = @(
        $RelativePaths |
            ForEach-Object { ([string]$_ -replace '\\', '/').TrimStart('/') } |
            Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
            Sort-Object -Unique
    )

    $baseResult = @{
        Repository = ""
        Remote     = ""
        Branch     = ""
        CommitId   = ""
        Paths      = @($requestedPaths)
    }

    if ($requestedPaths.Count -eq 0) {
        return [PSCustomObject]($baseResult + @{ Status = "NoPaths" })
    }

    try {
        $settings = Get-HaravanGitSettings `
            -RepositoryPathOverride $RepositoryPath `
            -RemoteOverride $Remote `
            -BranchOverride $Branch `
            -CommitMessageOverride $CommitMessage
    } catch {
        $detail = Get-HaravanGitFailureDetail -ErrorRecord $_
        Write-Warning "Không đọc được cấu hình lưu Git; code Haravan vẫn đã push thành công. $detail"
        return [PSCustomObject]($baseResult + @{ Status = "Failed"; Error = $detail })
    }

    if (-not $settings.Enabled) {
        return [PSCustomObject]($baseResult + @{ Status = "Disabled" })
    }

    if (-not (Get-HaravanGitCommand)) {
        Write-Warning "Bỏ qua lưu Git: máy chưa có Git trong PATH."
        return [PSCustomObject]($baseResult + @{ Status = "GitUnavailable" })
    }

    try {
        $repositoryRoot = Resolve-HaravanGitRepository `
            -ShopPath $Shop.Path `
            -ConfiguredPath $settings.RepositoryPath
        if ([string]::IsNullOrWhiteSpace($repositoryRoot)) {
            Write-Warning (
                "Bỏ qua lưu Git: không tìm thấy Git repository từ shop. " +
                "Hãy cấu hình git.repositoryPath trong {0} hoặc git init tại workspace root." -f `
                    $settings.ConfigPath
            )
            return [PSCustomObject]($baseResult + @{ Status = "NoRepository" })
        }

        $shopRoot = [System.IO.Path]::GetFullPath($Shop.Path).TrimEnd('\', '/')
        if (-not (Test-HaravanPathWithinOrEqual `
            -Path $shopRoot `
            -AllowedRoot $repositoryRoot)) {
            throw (
                "Shop không nằm trong Git repository; không stage file ngoài repo: " +
                $Shop.Path
            )
        }

        $gitPaths = @()
        foreach ($relativePath in $requestedPaths) {
            if ($relativePath -match '(^|/)\.\.(/|$)') {
                throw "Đường dẫn Git không hợp lệ: $relativePath"
            }
            $localPath = Join-Path $shopRoot (
                $relativePath -replace '/', [System.IO.Path]::DirectorySeparatorChar
            )
            $fullLocalPath = [System.IO.Path]::GetFullPath($localPath)
            if (-not (Test-HaravanPathWithinRoot `
                -Path $fullLocalPath `
                -AllowedRoot $shopRoot) -or
                -not (Test-Path -LiteralPath $fullLocalPath -PathType Leaf)) {
                throw "Không tìm thấy file theme để lưu Git: $localPath"
            }

            $gitPath = $fullLocalPath.Substring($repositoryRoot.Length).
                TrimStart('\', '/') -replace '\\', '/'
            if ([string]::IsNullOrWhiteSpace($gitPath)) {
                throw "Không xác định được đường dẫn tương đối trong Git: $localPath"
            }
            $gitPaths += $gitPath
        }
        $gitPaths = @($gitPaths | Sort-Object -Unique)

        $statusArguments = @(
            "status",
            "--porcelain=v1",
            "--untracked-files=all",
            "--"
        )
        $statusArguments += $gitPaths
        $status = Invoke-HaravanGitCommand `
            -WorkingDirectory $repositoryRoot `
            -Arguments $statusArguments
        $statusLines = @($status.Output | Where-Object {
            -not [string]::IsNullOrWhiteSpace([string]$_)
        })
        if ($statusLines.Count -eq 0) {
            Write-Host "Git archive: các file đã push không có thay đổi mới."
            return [PSCustomObject]($baseResult + @{
                Status     = "NoChanges"
                Repository = $repositoryRoot
                Paths      = @($gitPaths)
            })
        }

        $addArguments = @("add", "--")
        $addArguments += $gitPaths
        Invoke-HaravanGitCommand `
            -WorkingDirectory $repositoryRoot `
            -Arguments $addArguments | Out-Null

        $prefix = ([string]$settings.CommitPrefix).Trim()
        if ([string]::IsNullOrWhiteSpace($prefix)) {
            $prefix = "Haravan theme"
        }
        $themeLabel = ([string]$Shop.ThemeName).Trim()
        if ([string]::IsNullOrWhiteSpace($themeLabel)) {
            $themeLabel = [string]$Shop.ThemeId
        }
        $message = (
            "{0}: {1} (org {2}, theme {3}) - {4} file(s)" -f
            $prefix,
            $themeLabel,
            $Shop.OrgId,
            $Shop.ThemeId,
            $gitPaths.Count
        )

        $commitArguments = @("commit", "--only", "-m", $message, "--")
        $commitArguments += $gitPaths
        Invoke-HaravanGitCommand `
            -WorkingDirectory $repositoryRoot `
            -Arguments $commitArguments | Out-Null
        $commitIdResult = Invoke-HaravanGitCommand `
            -WorkingDirectory $repositoryRoot `
            -Arguments @("rev-parse", "--short", "HEAD")
        $commitId = @(
            $commitIdResult.Output |
                ForEach-Object { ([string]$_).Trim() } |
                Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
        ) | Select-Object -First 1

        $baseResult.Repository = $repositoryRoot
        $baseResult.CommitId = [string]$commitId
        $baseResult.Paths = @($gitPaths)

        if ($SkipPush -or -not $settings.PushToRemote) {
            Write-Host "Git commit OK ($commitId); bỏ qua git push theo cấu hình."
            return [PSCustomObject]($baseResult + @{ Status = "CommittedNoPush" })
        }

        $remoteName = ([string]$settings.Remote).Trim()
        if ([string]::IsNullOrWhiteSpace($remoteName)) {
            $branchProbe = Invoke-HaravanGitCommand `
                -WorkingDirectory $repositoryRoot `
                -Arguments @("branch", "--show-current")
            $currentBranch = @(
                $branchProbe.Output |
                    ForEach-Object { ([string]$_).Trim() } |
                    Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
            ) | Select-Object -First 1
            if (-not [string]::IsNullOrWhiteSpace([string]$currentBranch)) {
                $upstreamProbe = Invoke-HaravanGitCommand `
                    -WorkingDirectory $repositoryRoot `
                    -Arguments @("config", "--get", "branch.$currentBranch.remote") `
                    -AllowNonZero
                $remoteName = @(
                    $upstreamProbe.Output |
                        ForEach-Object { ([string]$_).Trim() } |
                        Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
                ) | Select-Object -First 1
            }
        }
        if ([string]::IsNullOrWhiteSpace($remoteName)) {
            $remoteName = "origin"
        }

        $remoteCheck = Invoke-HaravanGitCommand `
            -WorkingDirectory $repositoryRoot `
            -Arguments @("remote", "get-url", $remoteName) `
            -AllowNonZero
        if ($remoteCheck.ExitCode -ne 0) {
            Write-Warning (
                "Git commit {0} đã tạo nhưng chưa push: chưa có remote '{1}'. " +
                "Thêm remote bằng git remote add {1} <URL> rồi chạy lại agent:push." -f
                $commitId,
                $remoteName
            )
            $baseResult.Remote = $remoteName
            return [PSCustomObject]($baseResult + @{ Status = "CommittedNoRemote" })
        }

        $branchName = ([string]$settings.Branch).Trim()
        if ([string]::IsNullOrWhiteSpace($branchName)) {
            $branchResult = Invoke-HaravanGitCommand `
                -WorkingDirectory $repositoryRoot `
                -Arguments @("branch", "--show-current")
            $branchName = @(
                $branchResult.Output |
                    ForEach-Object { ([string]$_).Trim() } |
                    Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
            ) | Select-Object -First 1
        }
        if ([string]::IsNullOrWhiteSpace([string]$branchName)) {
            Write-Warning (
                "Git commit {0} đã tạo nhưng chưa push: repository đang ở detached HEAD; " +
                "cấu hình git.branch trong {1}." -f $commitId, $settings.ConfigPath
            )
            $baseResult.Remote = $remoteName
            return [PSCustomObject]($baseResult + @{ Status = "CommittedNoBranch" })
        }
        if ($remoteName -match '(^\s|\s)') {
            throw "Tên Git remote không hợp lệ: $remoteName"
        }

        $pushArguments = @("push", $remoteName, ("HEAD:{0}" -f $branchName))
        Invoke-HaravanGitCommand `
            -WorkingDirectory $repositoryRoot `
            -Arguments $pushArguments | Out-Null
        Write-Host "Git push OK: $commitId -> $remoteName/$branchName" -ForegroundColor Green
        $baseResult.Remote = $remoteName
        $baseResult.Branch = [string]$branchName
        return [PSCustomObject]($baseResult + @{ Status = "Pushed" })
    } catch {
        $detail = Get-HaravanGitFailureDetail -ErrorRecord $_
        Write-Warning "Lưu/push Git thất bại; commit local có thể đã được tạo. $detail"
        return [PSCustomObject]($baseResult + @{ Status = "Failed"; Error = $detail })
    }
}
