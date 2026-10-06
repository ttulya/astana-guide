$ErrorActionPreference = 'Stop'
$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
if ($nodeCommand) { $nodePath = $nodeCommand.Source }
else { $nodePath = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' }
if (-not (Test-Path -LiteralPath $nodePath)) { throw 'Node.js was not found.' }
$accountLogin = Read-Host 'Administrator login (register this account on the website first)'
& $nodePath (Join-Path $PSScriptRoot 'manage-admin.js') $accountLogin
exit $LASTEXITCODE
