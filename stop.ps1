$ErrorActionPreference = 'Stop'
$pidFile = Join-Path $PSScriptRoot '.server-pid'
if (-not (Test-Path -LiteralPath $pidFile)) { Write-Host 'Server is not running through start.cmd.'; exit 0 }
$serverPid = [int](Get-Content -LiteralPath $pidFile)
$serverProcess = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $serverPid)
if ($serverProcess -and $serverProcess.Name -eq 'node.exe' -and $serverProcess.CommandLine.Contains((Join-Path $PSScriptRoot 'server.js'))) {
    # Stop only this server and its SQL worker; never terminate unrelated Node processes.
    $sqlWorkers = Get-CimInstance Win32_Process -Filter ('ParentProcessId=' + $serverPid)
    $sqlWorkers | Where-Object { $_.CommandLine -match 'sql-worker\.ps1' } | ForEach-Object { Stop-Process -Id $_.ProcessId -ErrorAction SilentlyContinue }
    Stop-Process -Id $serverPid -ErrorAction SilentlyContinue
}
Remove-Item -LiteralPath $pidFile
Write-Host 'RelaxCaps stopped.'
