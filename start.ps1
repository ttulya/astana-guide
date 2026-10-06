param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$sitePath = $PSScriptRoot
$config = Get-Content -LiteralPath (Join-Path $sitePath 'config.json') -Raw | ConvertFrom-Json
$siteUrl = 'http://localhost:' + $config.port
$healthUrl = 'http://127.0.0.1:' + $config.port + '/api/health'
try {
    $health = Invoke-RestMethod $healthUrl -TimeoutSec 2
    if ($health.ok -and $health.database -eq $config.database) { if (-not $NoBrowser) { Start-Process ($siteUrl + '/profile.html') }; exit 0 }
} catch {}
$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
if ($nodeCommand) { $nodePath = $nodeCommand.Source }
else {
    $nodePath = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
    if (-not (Test-Path -LiteralPath $nodePath)) { throw 'Install Node.js 22 or newer from https://nodejs.org and run start.cmd again.' }
}
if (-not (Test-Path -LiteralPath (Join-Path $sitePath 'node_modules\bcryptjs'))) { throw 'Run npm install in the relaxcaps folder first.' }
$outLog = Join-Path $sitePath 'server.out.log'
$errLog = Join-Path $sitePath 'server.err.log'
$serverFile = Join-Path $sitePath 'server.js'
$process = Start-Process -FilePath $nodePath -ArgumentList ('"' + $serverFile + '"') -WorkingDirectory $sitePath -WindowStyle Hidden -PassThru -RedirectStandardOutput $outLog -RedirectStandardError $errLog
Set-Content -LiteralPath (Join-Path $sitePath '.server-pid') -Value $process.Id
for ($attempt = 0; $attempt -lt 20; $attempt++) {
    Start-Sleep -Milliseconds 500
    $process.Refresh()
    if ($process.HasExited) { throw ('Server stopped. Read server.err.log: ' + (Get-Content -LiteralPath $errLog -Raw)) }
    try {
        $health = Invoke-RestMethod $healthUrl -TimeoutSec 1
        if ($health.ok -and $health.database -eq $config.database) {
            if (-not $NoBrowser) { Start-Process ($siteUrl + '/profile.html') }
            Write-Host ('RelaxCaps started: ' + $siteUrl)
            exit 0
        }
    } catch {}
}
throw 'Server did not respond. Read server.err.log.'
