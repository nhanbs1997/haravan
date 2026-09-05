. "$PSScriptRoot/common.ps1"

if ([version](node --version).TrimStart("v") -lt [version]"16.0.0") {
    throw "Node.js 16 or newer is required."
}

$npmCommand = (Get-Command "npm.cmd" -ErrorAction Stop).Source
$haravanInstalled = $true
try {
    $null = Get-HaravanCommand
} catch {
    $haravanInstalled = $false
}
if (-not $haravanInstalled) {
    Write-Host "Installing the latest Haravan CLI..."
    & $npmCommand install --global "@haravan/cli@latest"
    if ($LASTEXITCODE -ne 0) {
        throw "Could not install Haravan CLI. Open Terminal as Administrator and retry."
    }
}

Write-Host ""
Write-Host "Haravan CLI:"
Invoke-Haravan "-v"
Write-Host ""
Write-Host "Setup complete. Next run: npm.cmd start"
