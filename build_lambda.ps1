$ErrorActionPreference = "Stop"

$RootDir = (Resolve-Path ".\").Path
$BackendDir = Join-Path $RootDir "backend"
$BuildDir = Join-Path $RootDir "build"
$PkgDir = Join-Path $BuildDir "lambda_pkg"
$ZipFile = Join-Path $BuildDir "poolsy_lambda.zip"

Write-Host "Cleaning up old build..."
if (Test-Path $BuildDir) {
    Remove-Item -Recurse -Force $BuildDir
}
New-Item -ItemType Directory -Force -Path $PkgDir | Out-Null

Write-Host "Installing dependencies for Python 3.12 x86_64 Linux..."
# We must download Linux wheels because we are on Windows, but the target is Lambda.
python -m pip install -r "$BackendDir\requirements.txt" --target $PkgDir --platform manylinux2014_x86_64 --python-version 3.12 --only-binary=:all:

Write-Host "Copying application code..."
Copy-Item -Path "$BackendDir\app.py" -Destination $PkgDir
Copy-Item -Path "$BackendDir\models.py" -Destination $PkgDir
if (Test-Path "$BackendDir\.env") {
    Copy-Item -Path "$BackendDir\.env" -Destination $PkgDir
}

Write-Host "Cleaning up unnecessary files..."
# Remove __pycache__ and other bloat
Get-ChildItem -Path $PkgDir -Recurse -Include "__pycache__", "*.pyc", "*.pyo" | Remove-Item -Recurse -Force

# Ensure no SQLite DB is included
if (Test-Path "$PkgDir\instance") {
    Remove-Item -Recurse -Force "$PkgDir\instance"
}
if (Test-Path "$PkgDir\poolsy.db") {
    Remove-Item -Force "$PkgDir\poolsy.db"
}

Write-Host "Creating ZIP archive..."
Compress-Archive -Path "$PkgDir\*" -DestinationPath $ZipFile -Force

Write-Host "Deployment package created at: $ZipFile"
