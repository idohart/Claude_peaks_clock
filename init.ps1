$ErrorActionPreference = 'Stop'

if (!(Test-Path node_modules) -or ((Get-Item package.json).LastWriteTime -gt (Get-Item node_modules).LastWriteTime)) {
  npm install
}

npm run check
