param(
    [ValidateSet('Backend', 'Frontend')]
    [string]$Service
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$backend = Join-Path $root 'backend'
$frontend = Join-Path $root 'frontend'
$backendPython = Join-Path $backend '.venv\Scripts\python.exe'
$frontendUrl = 'http://localhost:5173'
$backendHealthUrl = 'http://localhost:8000/api/health'

if ($Service -eq 'Backend') {
    Set-Location -LiteralPath $backend
    & $backendPython -m uvicorn app.main:app --reload --port 8000
    exit $LASTEXITCODE
}

if ($Service -eq 'Frontend') {
    Set-Location -LiteralPath $frontend
    & npm.cmd run dev -- --host 127.0.0.1
    exit $LASTEXITCODE
}

$pythonCommand = Get-Command python -ErrorAction SilentlyContinue
if (-not $pythonCommand) {
    throw 'Python was not found. Install Python 3.11 or newer and try again.'
}
if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    throw 'npm was not found. Install Node.js 18 or newer and try again.'
}

if (-not (Test-Path $backendPython)) {
    & $pythonCommand.Source -m venv (Join-Path $backend '.venv')
    if ($LASTEXITCODE -ne 0) {
        throw 'Could not create the backend Python environment.'
    }
}

$null = & $backendPython -c 'import fastapi, uvicorn, sqlalchemy' 2>$null
if ($LASTEXITCODE -ne 0) {
    & $backendPython -m pip install -r (Join-Path $backend 'requirements.txt')
    if ($LASTEXITCODE -ne 0) {
        throw 'Could not install backend dependencies.'
    }
}

if (-not (Test-Path (Join-Path $backend '.env'))) {
    Copy-Item (Join-Path $backend '.env.example') (Join-Path $backend '.env')
}

if (-not (Test-Path (Join-Path $frontend 'node_modules'))) {
    Push-Location $frontend
    try {
        & npm.cmd install
        if ($LASTEXITCODE -ne 0) {
            throw 'Could not install frontend dependencies.'
        }
    }
    finally {
        Pop-Location
    }
}

function Test-Endpoint([string]$Url) {
    try {
        $null = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 15
        return $true
    }
    catch {
        return $false
    }
}

function Test-Port([int]$Port) {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $connection = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
        if (-not $connection.AsyncWaitHandle.WaitOne(1000)) {
            return $false
        }
        $client.EndConnect($connection)
        return $true
    }
    catch {
        return $false
    }
    finally {
        $client.Close()
    }
}

function Start-ServiceWindow([string]$Name) {
    $powershell = Join-Path $PSHOME 'powershell.exe'
    $arguments = '-NoExit -ExecutionPolicy Bypass -File "{0}" -Service {1}' -f $PSCommandPath, $Name
    Start-Process -FilePath $powershell -ArgumentList $arguments
}

function Wait-ForEndpoint([string]$Url, [string]$Name, [int]$TimeoutSeconds) {
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-Endpoint $Url) {
            return
        }
        Start-Sleep -Seconds 1
    }
    throw "$Name did not start in time. Check its PowerShell window for errors."
}

if (Test-Endpoint $backendHealthUrl) {
    Write-Host 'Backend is already running.'
}
elseif (Test-Port 8000) {
    Write-Host 'Backend is starting.'
    Wait-ForEndpoint $backendHealthUrl 'Backend' 180
}
else {
    Start-ServiceWindow 'Backend'
    Wait-ForEndpoint $backendHealthUrl 'Backend' 180
}

if (Test-Endpoint $frontendUrl) {
    Write-Host 'Frontend is already running.'
}
elseif (Test-Port 5173) {
    Write-Host 'Frontend is starting.'
    Wait-ForEndpoint $frontendUrl 'Frontend' 60
}
else {
    Start-ServiceWindow 'Frontend'
    Wait-ForEndpoint $frontendUrl 'Frontend' 60
}

Write-Host "Opening SmartLearn AI at $frontendUrl"
Start-Process $frontendUrl
