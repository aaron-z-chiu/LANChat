[CmdletBinding()]
param(
    [ValidatePattern('^[a-zA-Z0-9_-]{1,40}$')]
    [string]$Profile = 'default',
    [ValidateSet('Start', 'Dev')]
    [string]$Mode = 'Start',
    [switch]$Build
)

$ErrorActionPreference = 'Stop'
$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
if (!$nodeCommand) { throw 'Node.js 24 or newer is required. Install Node.js, then reopen PowerShell.' }
$launcherArgs = @((Join-Path $PSScriptRoot 'start-windows.mjs'), '--profile', $Profile, '--mode', $Mode)
if ($Build) { $launcherArgs += '--build' }
& $nodeCommand.Source @launcherArgs
exit $LASTEXITCODE
