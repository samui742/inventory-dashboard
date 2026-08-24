param(
    [string]$OutputPath = (Join-Path $PSScriptRoot '..\Inventory_Dashboard.html')
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$template = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $root 'standalone\dashboard-template.html')
$styles = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $root 'site\app\globals.css')
$styles = $styles -replace '^@import\s+"tailwindcss";\s*', ''
$records = @(Import-Csv -LiteralPath (Join-Path $root 'consolidated\inventory.csv') | ForEach-Object {
    [pscustomobject][ordered]@{
        id = [string]$_.id; status = $_.status; assignedTo = $_.assignedTo; displayName = $_.displayName; recordDate = $_.recordDate
        category = $_.category; location = $_.location; partNumber = $_.partNumber; serialNumber = $_.serialNumber
        quantity = [int]$_.quantity; vendor = $_.vendor; notes = $_.notes
    }
})
$available = @($records | Where-Object status -eq 'available')
$infrastructure = @($records | Where-Object status -eq 'infrastructure')
$checkedOut = @($records | Where-Object status -eq 'checked-out')
$payload = [ordered]@{
    summary = [ordered]@{
        generatedAt = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
        recordCount = $records.Count
        availableRecordCount = $available.Count
        infrastructureRecordCount = $infrastructure.Count
        checkedOutRecordCount = $checkedOut.Count
        availableUnits = [int](($available | Measure-Object quantity -Sum).Sum)
        infrastructureUnits = [int](($infrastructure | Measure-Object quantity -Sum).Sum)
        checkedOutUnits = [int](($checkedOut | Measure-Object quantity -Sum).Sum)
    }
    records = $records
}
$data = ConvertTo-Json -InputObject $payload -Depth 6 -Compress
$data = $data -replace '</script', '<\/script'
$document = $template.Replace('/*__STYLES__*/', $styles).Replace('/*__DATA__*/', $data)
Set-Content -LiteralPath $OutputPath -Value $document -Encoding utf8
Get-Item -LiteralPath $OutputPath | Select-Object FullName, Length, LastWriteTime
