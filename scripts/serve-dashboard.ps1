param(
    [int]$Port = 4173
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$inventoryCsvPath = Join-Path $root 'consolidated\inventory.csv'
$equipmentTypesPath = Join-Path $root 'config\equipment-types.json'
$equipmentNamesPath = Join-Path $root 'config\equipment-names.json'
$locationsPath = Join-Path $root 'config\locations.json'

function Get-EquipmentTypes {
    return @(Get-Content -Raw -LiteralPath $equipmentTypesPath | ConvertFrom-Json)
}

function Get-EquipmentNames {
    return @(Get-Content -Raw -LiteralPath $equipmentNamesPath | ConvertFrom-Json)
}

function Get-Locations {
    return @(Get-Content -Raw -LiteralPath $locationsPath | ConvertFrom-Json)
}

function Send-Response {
    param($Stream, [string]$Status, [string]$ContentType, [byte[]]$Body)
    $header = "HTTP/1.1 $Status`r`nContent-Type: $ContentType`r`nContent-Length: $($Body.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
    $headerBytes = [Text.Encoding]::ASCII.GetBytes($header)
    try {
        $Stream.Write($headerBytes, 0, $headerBytes.Length)
        $Stream.Write($Body, 0, $Body.Length)
        $Stream.Flush()
    }
    catch [IO.IOException] {
        # The browser closed or refreshed the connection before the response finished.
    }
    catch [ObjectDisposedException] {
        # The client disconnected while the response was being sent.
    }
}

function Json-Bytes($Value) {
    return [Text.Encoding]::UTF8.GetBytes((ConvertTo-Json -InputObject $Value -Depth 6 -Compress))
}

function Get-InventoryRecords {
    if (-not (Test-Path -LiteralPath $inventoryCsvPath)) { return @() }
    return @(Import-Csv -LiteralPath $inventoryCsvPath | ForEach-Object {
        [pscustomobject][ordered]@{
            id = $_.id; status = $_.status; assignedTo = $_.assignedTo; displayName = $_.displayName; recordDate = $_.recordDate
            category = $_.category; partNumber = $_.partNumber; serialNumber = $_.serialNumber
            location = $_.location
            quantity = [int]$_.quantity; vendor = $_.vendor
            notes = $_.notes
        }
    })
}

$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $Port)
$listener.Start()
Write-Output "Dashboard available at http://127.0.0.1:$Port/"

try {
    while ($true) {
        $client = $listener.AcceptTcpClient()
        try {
            $stream = $client.GetStream()
            $reader = [IO.StreamReader]::new($stream, [Text.Encoding]::UTF8, $false, 4096, $true)
            $requestLine = $reader.ReadLine()
            $headers = @{}
            while ($line = $reader.ReadLine()) {
                $separator = $line.IndexOf(':')
                if ($separator -gt 0) { $headers[$line.Substring(0, $separator).Trim().ToLowerInvariant()] = $line.Substring($separator + 1).Trim() }
            }
            if ($requestLine -notmatch '^([A-Z]+)\s+([^\s]+)') {
                Send-Response $stream '400 Bad Request' 'application/json; charset=utf-8' (Json-Bytes @{ error = 'Invalid request' })
                continue
            }

            $method = $Matches[1]
            $requestPath = $Matches[2]
            $pathOnly = ([Uri]("http://localhost" + $requestPath)).AbsolutePath

            if ($method -eq 'GET' -and $pathOnly -eq '/api/inventory') {
                Send-Response $stream '200 OK' 'application/json; charset=utf-8' (Json-Bytes @(Get-InventoryRecords))
                continue
            }

            if ($method -eq 'GET' -and $pathOnly -eq '/api/equipment-types') {
                Send-Response $stream '200 OK' 'application/json; charset=utf-8' ([Text.Encoding]::UTF8.GetBytes((Get-Content -Raw -LiteralPath $equipmentTypesPath)))
                continue
            }

            if ($method -eq 'GET' -and $pathOnly -eq '/api/equipment-names') {
                Send-Response $stream '200 OK' 'application/json; charset=utf-8' ([Text.Encoding]::UTF8.GetBytes((Get-Content -Raw -LiteralPath $equipmentNamesPath)))
                continue
            }

            if ($method -eq 'GET' -and $pathOnly -eq '/api/locations') {
                Send-Response $stream '200 OK' 'application/json; charset=utf-8' ([Text.Encoding]::UTF8.GetBytes((Get-Content -Raw -LiteralPath $locationsPath)))
                continue
            }

            if ($method -eq 'POST' -and $pathOnly -eq '/api/equipment') {
                try {
                    $contentLength = if ($headers.ContainsKey('content-length')) { [int]$headers['content-length'] } else { 0 }
                    if ($contentLength -le 0 -or $contentLength -gt 65536) { throw 'Invalid request body' }
                    $buffer = [char[]]::new($contentLength)
                    $charactersRead = $reader.Read($buffer, 0, $contentLength)
                    $inputData = ((-join $buffer[0..($charactersRead - 1)]) | ConvertFrom-Json)

                    $category = ([string]$inputData.category).Trim()
                    $status = ([string]$inputData.status).Trim().ToLowerInvariant()
                    $assignedTo = ([string]$inputData.assignedTo).Trim()
                    $displayName = ([string]$inputData.displayName).Trim()
                    $recordDate = ([string]$inputData.recordDate).Trim()
                    $partNumber = ([string]$inputData.partNumber).Trim()
                    $serialNumber = ([string]$inputData.serialNumber).Trim()
                    $location = ([string]$inputData.location).Trim()
                    $vendor = ([string]$inputData.vendor).Trim()
                    $notes = ([string]$inputData.notes).Trim()
                    $quantity = [int]$inputData.quantity

                    if ((Get-EquipmentTypes) -notcontains $category) { throw 'Select a valid equipment type' }
                    if ((Get-EquipmentNames) -notcontains $displayName) { throw 'Select a valid equipment name' }
                    if ((Get-Locations) -notcontains $location) { throw 'Select a valid location' }
                    if (@('available', 'infrastructure', 'checked-out') -notcontains $status) { throw 'Select a valid availability status' }
                    if ($status -eq 'checked-out' -and -not $assignedTo) { throw 'Enter the user assigned to this equipment' }
                    if ($status -in @('infrastructure', 'checked-out') -and $location -ieq 'Stockroom') { throw 'Infrastructure and checked-out equipment cannot remain in Stockroom' }
                    if ($status -ne 'checked-out') { $assignedTo = '' }
                    if (-not $displayName -or -not $location) { throw 'Complete every required field' }
                    if ($quantity -lt 1 -or $quantity -gt 10000) { throw 'Quantity must be between 1 and 10,000' }
                    $validDate = [datetime]::MinValue
                    if (-not [datetime]::TryParseExact($recordDate, 'yyyy-MM-dd', [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::None, [ref]$validDate)) { throw 'Enter a valid record date' }

                    $existing = @(Get-InventoryRecords)
                    $nextId = if ($existing.Count) { 1 + [int](($existing | ForEach-Object { [int]$_.id } | Measure-Object -Maximum).Maximum) } else { 1 }
                    $record = [pscustomobject][ordered]@{
                        id = [string]$nextId
                        status = $status; assignedTo = $assignedTo; displayName = $displayName; recordDate = $recordDate
                        category = $category; location = $location; partNumber = $partNumber; serialNumber = $serialNumber
                        quantity = $quantity; vendor = $vendor; notes = $notes
                    }
                    $csvRecord = $record | Select-Object id,status,assignedTo,displayName,recordDate,category,location,partNumber,serialNumber,quantity,vendor,notes
                    $csvRecord | Export-Csv -LiteralPath $inventoryCsvPath -NoTypeInformation -Append -Encoding utf8
                    Send-Response $stream '201 Created' 'application/json; charset=utf-8' (Json-Bytes @{ record = $record })
                }
                catch {
                    Send-Response $stream '400 Bad Request' 'application/json; charset=utf-8' (Json-Bytes @{ error = $_.Exception.Message })
                }
                continue
            }

            if ($method -eq 'PUT' -and $pathOnly -match '^/api/equipment/([^/]+)$') {
                try {
                    $recordId = [Uri]::UnescapeDataString($Matches[1])
                    $contentLength = if ($headers.ContainsKey('content-length')) { [int]$headers['content-length'] } else { 0 }
                    if ($contentLength -le 0 -or $contentLength -gt 65536) { throw 'Invalid request body' }
                    $buffer = [char[]]::new($contentLength)
                    $charactersRead = $reader.Read($buffer, 0, $contentLength)
                    $inputData = ((-join $buffer[0..($charactersRead - 1)]) | ConvertFrom-Json)

                    $category = ([string]$inputData.category).Trim()
                    $status = ([string]$inputData.status).Trim().ToLowerInvariant()
                    $assignedTo = ([string]$inputData.assignedTo).Trim()
                    $displayName = ([string]$inputData.displayName).Trim()
                    $recordDate = ([string]$inputData.recordDate).Trim()
                    $partNumber = ([string]$inputData.partNumber).Trim()
                    $serialNumber = ([string]$inputData.serialNumber).Trim()
                    $location = ([string]$inputData.location).Trim()
                    $vendor = ([string]$inputData.vendor).Trim()
                    $notes = ([string]$inputData.notes).Trim()
                    $quantity = [int]$inputData.quantity

                    if ((Get-EquipmentTypes) -notcontains $category) { throw 'Select a valid equipment type' }
                    if ((Get-EquipmentNames) -notcontains $displayName) { throw 'Select a valid equipment name' }
                    if ((Get-Locations) -notcontains $location) { throw 'Select a valid location' }
                    if (@('available', 'infrastructure', 'checked-out') -notcontains $status) { throw 'Select a valid availability status' }
                    if ($status -eq 'checked-out' -and -not $assignedTo) { throw 'Enter the user assigned to this equipment' }
                    if ($status -in @('infrastructure', 'checked-out') -and $location -ieq 'Stockroom') { throw 'Infrastructure and checked-out equipment cannot remain in Stockroom' }
                    if ($status -ne 'checked-out') { $assignedTo = '' }
                    if (-not $displayName -or -not $location) { throw 'Complete every required field' }
                    if ($quantity -lt 1 -or $quantity -gt 10000) { throw 'Quantity must be between 1 and 10,000' }
                    $validDate = [datetime]::MinValue
                    if (-not [datetime]::TryParseExact($recordDate, 'yyyy-MM-dd', [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::None, [ref]$validDate)) { throw 'Enter a valid record date' }

                    $existing = @(Get-InventoryRecords)
                    $original = @($existing | Where-Object id -eq $recordId)
                    if ($original.Count -ne 1) { throw 'Equipment record was not found' }
                    $updatedRecord = [pscustomobject][ordered]@{
                        id = $original[0].id; status = $status; assignedTo = $assignedTo; displayName = $displayName; recordDate = $recordDate
                        category = $category; location = $location; partNumber = $partNumber; serialNumber = $serialNumber
                        quantity = $quantity; vendor = $vendor; notes = $notes
                    }
                    $updatedRecords = @($existing | ForEach-Object { if ($_.id -eq $recordId) { $updatedRecord } else { $_ } })
                    $updatedRecords | Select-Object id,status,assignedTo,displayName,recordDate,category,location,partNumber,serialNumber,quantity,vendor,notes | Export-Csv -LiteralPath $inventoryCsvPath -NoTypeInformation -Encoding utf8
                    Send-Response $stream '200 OK' 'application/json; charset=utf-8' (Json-Bytes @{ record = $updatedRecord })
                }
                catch {
                    Send-Response $stream '400 Bad Request' 'application/json; charset=utf-8' (Json-Bytes @{ error = $_.Exception.Message })
                }
                continue
            }

            if ($method -ne 'GET') {
                Send-Response $stream '405 Method Not Allowed' 'application/json; charset=utf-8' (Json-Bytes @{ error = 'Method not allowed' })
                continue
            }

            $relativePath = [Uri]::UnescapeDataString($pathOnly.TrimStart('/'))
            if (-not $relativePath) { $relativePath = 'Inventory_Dashboard.html' }
            $candidate = [IO.Path]::GetFullPath((Join-Path $root $relativePath.Replace('/', [IO.Path]::DirectorySeparatorChar)))
            if (-not $candidate.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $candidate -PathType Leaf)) {
                Send-Response $stream '404 Not Found' 'text/plain; charset=utf-8' ([Text.Encoding]::UTF8.GetBytes('Not found'))
                continue
            }

            $contentType = switch ([IO.Path]::GetExtension($candidate).ToLowerInvariant()) {
                '.html' { 'text/html; charset=utf-8' }
                '.css'  { 'text/css; charset=utf-8' }
                '.js'   { 'text/javascript; charset=utf-8' }
                '.json' { 'application/json; charset=utf-8' }
                '.csv'  { 'text/csv; charset=utf-8' }
                '.png'  { 'image/png' }
                default { 'application/octet-stream' }
            }
            Send-Response $stream '200 OK' $contentType ([IO.File]::ReadAllBytes($candidate))
        }
        catch [IO.IOException] {
            # A disconnected client must not stop the dashboard server.
        }
        catch [ObjectDisposedException] {
            # A disconnected client must not stop the dashboard server.
        }
        catch {
            Write-Warning "Request failed: $($_.Exception.Message)"
        }
        finally { $client.Dispose() }
    }
}
finally { $listener.Stop() }
