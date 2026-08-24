param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [int]$PreviewRows = 12
)

Add-Type -AssemblyName System.IO.Compression.FileSystem

function Read-ZipXml {
    param($Zip, [string]$EntryName)
    $entry = $Zip.GetEntry($EntryName)
    if (-not $entry) { return $null }
    $reader = [System.IO.StreamReader]::new($entry.Open())
    try { return [xml]$reader.ReadToEnd() } finally { $reader.Dispose() }
}

function Get-ColumnIndex([string]$CellReference) {
    $letters = ($CellReference -replace '[^A-Z]', '')
    $index = 0
    foreach ($character in $letters.ToCharArray()) {
        $index = ($index * 26) + ([int]$character - [int][char]'A') + 1
    }
    return $index - 1
}

$resolved = (Resolve-Path -LiteralPath $Path).Path
$zip = [System.IO.Compression.ZipFile]::OpenRead($resolved)
try {
    $sharedStrings = @()
    $sharedXml = Read-ZipXml $zip 'xl/sharedStrings.xml'
    if ($sharedXml) {
        foreach ($item in $sharedXml.sst.si) {
            if ($item.t -is [string]) { $sharedStrings += $item.t }
            elseif ($item.t) { $sharedStrings += $item.t.'#text' }
            else { $sharedStrings += (($item.r | ForEach-Object { $_.t.'#text' }) -join '') }
        }
    }

    $workbook = Read-ZipXml $zip 'xl/workbook.xml'
    $relationships = Read-ZipXml $zip 'xl/_rels/workbook.xml.rels'
    $relationshipMap = @{}
    foreach ($relationship in $relationships.Relationships.Relationship) {
        $relationshipMap[$relationship.Id] = $relationship.Target
    }

    Write-Output "FILE: $([IO.Path]::GetFileName($resolved))"
    foreach ($sheet in $workbook.workbook.sheets.sheet) {
        $relationshipId = $sheet.GetAttribute('id', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')
        $target = $relationshipMap[$relationshipId]
        $entryName = if ($target.StartsWith('/')) { $target.TrimStart('/') } else { "xl/$target" }
        $sheetXml = Read-ZipXml $zip $entryName
        $rows = @($sheetXml.worksheet.sheetData.row)
        Write-Output "SHEET: $($sheet.name) ($($rows.Count) rows)"
        foreach ($row in ($rows | Select-Object -First $PreviewRows)) {
            $values = @{}
            foreach ($cell in @($row.c)) {
                $columnIndex = Get-ColumnIndex $cell.r
                $value = $cell.v
                if ($cell.t -eq 's' -and $null -ne $value) { $value = $sharedStrings[[int]$value] }
                elseif ($cell.t -eq 'inlineStr') { $value = $cell.is.t }
                elseif ($cell.t -eq 'b') { $value = if ($value -eq '1') { 'TRUE' } else { 'FALSE' } }
                if ($value -isnot [string] -and $null -ne $value) { $value = $value.'#text' }
                $values[$columnIndex] = $value
            }
            $lastIndex = if ($values.Count) { ($values.Keys | Measure-Object -Maximum).Maximum } else { -1 }
            $ordered = for ($i = 0; $i -le $lastIndex; $i++) { if ($values.ContainsKey($i)) { $values[$i] } else { $null } }
            Write-Output ("  R{0}: {1}" -f $row.r, ($ordered | ConvertTo-Json -Compress))
        }
    }
}
finally {
    $zip.Dispose()
}
