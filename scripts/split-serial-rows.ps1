param(
    [string]$CsvPath = (Join-Path $PSScriptRoot '..\consolidated\inventory.csv')
)

$ErrorActionPreference = 'Stop'
$resolvedPath = (Resolve-Path -LiteralPath $CsvPath).Path
$rows = @(Import-Csv -LiteralPath $resolvedPath)
$expanded = [Collections.Generic.List[object]]::new()
$splitSourceRows = 0

foreach ($row in $rows) {
    $serials = @($row.serialNumber -split '\r?\n' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
    if ($serials.Count -le 1) {
        $expanded.Add($row)
        continue
    }

    $splitSourceRows++
    for ($serialIndex = 0; $serialIndex -lt $serials.Count; $serialIndex++) {
        $copy = [ordered]@{}
        foreach ($property in $row.psobject.Properties) { $copy[$property.Name] = $property.Value }
        $copy.id = '{0}-serial-{1:d2}' -f $row.id, ($serialIndex + 1)
        $copy.serialNumber = $serials[$serialIndex]
        $copy.quantity = 1
        $expanded.Add([pscustomobject]$copy)
    }
}

$temporaryPath = "$resolvedPath.tmp"
$nextId = 1
foreach ($record in $expanded) {
    $record.id = [string]$nextId
    $nextId++
}
$expanded | Export-Csv -LiteralPath $temporaryPath -NoTypeInformation -Encoding utf8
Move-Item -LiteralPath $temporaryPath -Destination $resolvedPath -Force

[pscustomobject]@{
    InputRows = $rows.Count
    SplitSourceRows = $splitSourceRows
    OutputRows = $expanded.Count
    AddedRows = $expanded.Count - $rows.Count
    CsvPath = $resolvedPath
}
