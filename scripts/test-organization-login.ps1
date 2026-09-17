. "$PSScriptRoot/../scripts/common.ps1"
function Start-Sleep { param($Seconds) }
function Invoke-HaravanAt { $script:loginCalls++ }
function Read-Host { param($Prompt) $script:promptCalls++; return $script:answer }
function Get-LoggedInOrganizationIds {
    $script:checks++
    if ($script:checks -ge $script:availableAt) { return @('200001207989') }
    return @('200000000001')
}
foreach ($case in @(
    @{ Name='Existing session'; At=1; Answer=''; Expected=$true; Logins=0 },
    @{ Name='Session changes at prompt'; At=2; Answer=''; Expected=$true; Logins=0 },
    @{ Name='Login succeeds'; At=3; Answer=''; Expected=$true; Logins=1 },
    @{ Name='Delayed session'; At=5; Answer=''; Expected=$true; Logins=1 },
    @{ Name='Recheck without second login'; At=9; Answer=''; Expected=$true; Logins=1 },
    @{ Name='Wrong org skipped'; At=99; Answer='S'; Expected=$false; Logins=0 },
    @{ Name='Manual recheck'; At=2; Answer='R'; Expected=$true; Logins=0 }
)) {
    $script:checks=0; $script:loginCalls=0; $script:promptCalls=0
    $script:availableAt=$case.At; $script:answer=$case.Answer
    $result=Ensure-HaravanOrganizationLogin -OrgId '200001207989' -SourceUrl 'https://example.com'
    if ($result -ne $case.Expected -or $script:loginCalls -ne $case.Logins) { throw "FAIL: $($case.Name)" }
    Write-Output "PASS: $($case.Name)"
}
foreach ($file in @('scripts/common.ps1','scripts/add-shop.ps1')) {
    $errors=$null; $tokens=$null
    $null=[System.Management.Automation.Language.Parser]::ParseFile((Join-Path $script:ProjectRoot $file),[ref]$tokens,[ref]$errors)
    if ($errors.Count) { throw ($errors | Out-String) }
    Write-Output "PASS syntax: $file"
}
