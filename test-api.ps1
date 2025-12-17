# Test script for /api/app-users/register endpoint
# Make sure your dev server is running: npm run dev

$baseUrl = "http://localhost:3000"
$endpoint = "$baseUrl/api/app-users/register"

# Replace with your actual API key from the admin panel
$apiKey = "ahc_live_sk_ee4f0bfbaf8e315a553b2d01f324f8cb76ebf9103cbb766c8ad6306fd11d9b28"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Testing App Users Register API" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Without API key (should fail)
Write-Host "Test 1: Request WITHOUT API key (should fail with 401)" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray
try {
    $body = @{
        wpUserId = "123"
        email = "test@example.com"
        name = "Test User"
        displayName = "Test"
    } | ConvertTo-Json

    $response = Invoke-WebRequest -Uri $endpoint `
        -Method POST `
        -ContentType "application/json" `
        -Body $body `
        -ErrorAction Stop

    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host $response.Content
} catch {
    Write-Host "Status: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    $responseBody = $reader.ReadToEnd()
    Write-Host $responseBody
}
Write-Host ""
Write-Host ""

# Test 2: With invalid API key (should fail)
Write-Host "Test 2: Request WITH INVALID API key (should fail with 401)" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray
try {
    $body = @{
        wpUserId = "123"
        email = "test@example.com"
        name = "Test User"
        displayName = "Test"
    } | ConvertTo-Json

    $headers = @{
        "X-API-Key" = "ahc_live_sk_invalid_key_12345"
    }

    $response = Invoke-WebRequest -Uri $endpoint `
        -Method POST `
        -ContentType "application/json" `
        -Headers $headers `
        -Body $body `
        -ErrorAction Stop

    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host $response.Content
} catch {
    Write-Host "Status: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    $responseBody = $reader.ReadToEnd()
    Write-Host $responseBody
}
Write-Host ""
Write-Host ""

# Test 3: With valid API key using X-API-Key header (should succeed)
Write-Host "Test 3: Request WITH VALID API key (X-API-Key header)" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray
Write-Host "NOTE: Replace YOUR_API_KEY_HERE with your actual API key!" -ForegroundColor Magenta
try {
    $body = @{
        wpUserId = "123"
        email = "test@example.com"
        name = "Test User"
        displayName = "Test User Display"
        phone = "+1234567890"
        age = 30
        height = "175cm"
        weight = "75kg"
        goal = "70kg"
        initialWeight = "80kg"
        weightSet = $true
    } | ConvertTo-Json

    $headers = @{
        "X-API-Key" = $apiKey
    }

    $response = Invoke-WebRequest -Uri $endpoint `
        -Method POST `
        -ContentType "application/json" `
        -Headers $headers `
        -Body $body `
        -ErrorAction Stop

    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Status: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    $responseBody = $reader.ReadToEnd()
    Write-Host $responseBody
}
Write-Host ""
Write-Host ""

# Test 4: With valid API key using Authorization Bearer header (should succeed)
Write-Host "Test 4: Request WITH VALID API key (Authorization Bearer header)" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray
Write-Host "NOTE: Replace YOUR_API_KEY_HERE with your actual API key!" -ForegroundColor Magenta
try {
    $body = @{
        wpUserId = "456"
        email = "test2@example.com"
        name = "Test User 2"
        displayName = "Test User 2 Display"
        phone = "+1234567891"
        age = 25
        height = "165cm"
        weight = "65kg"
        goal = "60kg"
        initialWeight = "70kg"
        weightSet = $true
    } | ConvertTo-Json

    $headers = @{
        "Authorization" = "Bearer $apiKey"
    }

    $response = Invoke-WebRequest -Uri $endpoint `
        -Method POST `
        -ContentType "application/json" `
        -Headers $headers `
        -Body $body `
        -ErrorAction Stop

    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Status: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    $responseBody = $reader.ReadToEnd()
    Write-Host $responseBody
}
Write-Host ""
Write-Host ""

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Testing Complete" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

