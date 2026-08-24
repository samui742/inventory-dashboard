$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$consolidatedDirectory = Join-Path $root 'consolidated'
$inventoryPath = Join-Path $consolidatedDirectory 'inventory.csv'
$recordHeader = '"id","status","assignedTo","displayName","recordDate","category","location","partNumber","serialNumber","quantity","vendor","notes"'

if (-not ([IO.Path]::GetFullPath($inventoryPath)).StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to write outside workspace: $inventoryPath"
}
New-Item -ItemType Directory -Force -Path $consolidatedDirectory | Out-Null

$generatedAt = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
Set-Content -LiteralPath $inventoryPath -Value $recordHeader -Encoding utf8

& (Join-Path $PSScriptRoot 'build-standalone-dashboard.ps1') | Out-Null

[pscustomobject]@{
    InventoryRecords = 0
    Dashboard = Join-Path $root 'Inventory_Dashboard.html'
    ClearedAt = $generatedAt
}
