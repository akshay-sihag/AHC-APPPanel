# WooCommerce API Test Script for PowerShell
# Redis Cache Performance Testing with Stale-While-Revalidate
# Tests: Products, Blogs, Orders, Subscriptions, Billing Address
# Replace the variables below with your actual values

# Configuration
$BASE_URL = "https://appanel.alternatehealthclub.com"  # Change to your server URL
$API_KEY = "ahc_live_sk_cbcd8c5bf9aa070654fa1e2eda4ca7ca96f5f275b574960ab4b883296a9f5354"  # Replace with your actual API key
$TEST_EMAIL = "akshay@devgraphix.com"  # Replace with a valid test email from your WooCommerce store

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "WooCommerce API Test Script" -ForegroundColor Cyan
Write-Host "Redis Cache Performance Testing" -ForegroundColor Cyan
Write-Host "All Endpoints: Products, Blogs, Orders," -ForegroundColor Cyan
Write-Host "Subscriptions, Billing Address" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Testing against: $BASE_URL" -ForegroundColor Gray
Write-Host ""
Write-Host "Cache Strategy:" -ForegroundColor Yellow
Write-Host "  - Products: 5 min TTL (2 min for search)" -ForegroundColor Gray
Write-Host "  - Blogs: 30 min TTL" -ForegroundColor Gray
Write-Host "  - Orders: 3 min TTL" -ForegroundColor Gray
Write-Host "  - Subscriptions: 5 min TTL" -ForegroundColor Gray
Write-Host "  - Billing Address: 10 min TTL" -ForegroundColor Gray
Write-Host "  - API Keys: 2 min TTL" -ForegroundColor Gray
Write-Host ""
Write-Host "Stale-While-Revalidate:" -ForegroundColor Yellow
Write-Host "  - Stale threshold: 30 seconds before expiration" -ForegroundColor Gray
Write-Host "  - Stale data served immediately (<50ms)" -ForegroundColor Gray
Write-Host "  - Background refresh updates cache" -ForegroundColor Gray
Write-Host ""

# Start overall timer
$overallStart = Get-Date

# Hash table to store timings and statuses
$timings = @{}
$statuses = @{}
$cacheHits = @{}
$staleFlags = @{}
$refreshingFlags = @{}

# Function to measure request time
function Measure-Request {
    param(
        [string]$TestName,
        [string]$Method,
        [string]$Uri,
        [string]$Body = $null,
        [switch]$ExpectCache
    )
    
    Write-Host $TestName -ForegroundColor Yellow
    Write-Host "Endpoint: $Method $Uri"
    if ($ExpectCache) {
        Write-Host "Expected: Cache Hit" -ForegroundColor Cyan
    }
    Write-Host ""
    
    $startTime = Get-Date
    $httpStatus = $null
    $response = $null
    $fromCache = $false
    $isStale = $false
    $isRefreshing = $false
    $responseTime = $null
    
    try {
        $headers = @{
            "X-API-Key" = $API_KEY
            "Content-Type" = "application/json"
        }
        
        if ($Body) {
            $response = Invoke-RestMethod -Uri $Uri `
                -Method $Method `
                -Headers $headers `
                -Body $Body
        } else {
            $response = Invoke-RestMethod -Uri $Uri `
                -Method $Method `
                -Headers $headers
        }
        
        # Check cache status
        if ($response.fromCache -ne $null) {
            $fromCache = $response.fromCache
            $responseTime = $response.responseTime
        }
        
        # Check stale and refreshing flags
        if ($response.stale -ne $null) {
            $isStale = $response.stale
        }
        if ($response.refreshing -ne $null) {
            $isRefreshing = $response.refreshing
        }
        
        # Display response summary
        if ($response.success) {
            Write-Host "Success: true" -ForegroundColor Green
            if ($response.count -ne $null) {
                Write-Host "Items returned: $($response.count)"
            }
            if ($response.products -ne $null) {
                Write-Host "Products: $($response.products.Count)"
            }
            if ($response.blogs -ne $null) {
                Write-Host "Blogs: $($response.blogs.Count)"
            }
            if ($response.orders -ne $null) {
                Write-Host "Orders: $($response.orders.Count)"
            }
            if ($response.subscriptions -ne $null) {
                Write-Host "Subscriptions: $($response.subscriptions.Count)"
            }
            if ($response.billing -ne $null) {
                Write-Host "Billing Address: Found" -ForegroundColor Green
            }
        }
        
        # Display cache status with stale information
        if ($fromCache) {
            if ($isStale) {
                Write-Host "Cache: STALE (served immediately, refreshing in background)" -ForegroundColor Yellow
            } else {
                Write-Host "Cache: HIT (fresh from Redis)" -ForegroundColor Green
            }
        } else {
            Write-Host "Cache: MISS (fresh fetch)" -ForegroundColor Yellow
        }
        
        if ($isRefreshing) {
            Write-Host "Background Refresh: ACTIVE" -ForegroundColor Cyan
        }
        
        if ($responseTime) {
            Write-Host "Server Response Time: $responseTime" -ForegroundColor Cyan
        }
        
        $httpStatus = 200
        Write-Host "HTTP Status: 200 OK" -ForegroundColor Green
    } catch {
        $httpStatus = if ($_.Exception.Response) { 
            $_.Exception.Response.StatusCode.value__ 
        } else { 
            "Error" 
        }
        
        Write-Host "Error: $_" -ForegroundColor Red
        if ($_.Exception.Response) {
            Write-Host "HTTP Status: $httpStatus" -ForegroundColor Red
            try {
                $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                $responseBody = $reader.ReadToEnd()
                $reader.Close()
                
                try {
                    $errorJson = $responseBody | ConvertFrom-Json
                    if ($errorJson.error) {
                        Write-Host "Error Message: $($errorJson.error)" -ForegroundColor Yellow
                        if ($errorJson.details) {
                            Write-Host "Details: $($errorJson.details)" -ForegroundColor Gray
                        }
                    }
                } catch {
                    if ($responseBody -match "<!DOCTYPE|Page Not Found|404") {
                        Write-Host "`nRoute not found (404)" -ForegroundColor Yellow
                    }
                }
            } catch {}
        }
    }
    
    $endTime = Get-Date
    $duration = ($endTime - $startTime).TotalSeconds
    
    $timings[$TestName] = $duration
    $statuses[$TestName] = $httpStatus
    $cacheHits[$TestName] = $fromCache
    $staleFlags[$TestName] = $isStale
    $refreshingFlags[$TestName] = $isRefreshing
    
    Write-Host "Total Round-Trip Time: $([math]::Round($duration, 3))s" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "----------------------------------------"
    Write-Host ""
}

# ==========================================
# CACHE MISS TESTS (First requests)
# ==========================================
Write-Host "==========================================" -ForegroundColor Magenta
Write-Host "Phase 1: First Requests (Cache Miss Expected)" -ForegroundColor Magenta
Write-Host "==========================================" -ForegroundColor Magenta
Write-Host ""

# Test 1: Get Products (First - Cache Miss)
Measure-Request `
    -TestName "Test 1: Products (First Request)" `
    -Method "GET" `
    -Uri "$BASE_URL/api/woocommerce/products?page=1&per_page=10"

# Test 2: Get Blogs (First - Cache Miss)
Measure-Request `
    -TestName "Test 2: Blogs (First Request)" `
    -Method "GET" `
    -Uri "$BASE_URL/api/woocommerce/blogs"

# Test 2a: Get Orders (First - Cache Miss)
Measure-Request `
    -TestName "Test 2a: Orders (First Request)" `
    -Method "GET" `
    -Uri "$BASE_URL/api/woocommerce/orders?email=$TEST_EMAIL"

# Test 2b: Get Subscriptions (First - Cache Miss)
Measure-Request `
    -TestName "Test 2b: Subscriptions (First Request)" `
    -Method "GET" `
    -Uri "$BASE_URL/api/woocommerce/subscriptions?email=$TEST_EMAIL"

# Test 2c: Get Billing Address (First - Cache Miss)
Measure-Request `
    -TestName "Test 2c: Billing Address (First Request)" `
    -Method "GET" `
    -Uri "$BASE_URL/api/woocommerce/billing-address?email=$TEST_EMAIL"

# ==========================================
# CACHE HIT TESTS (Repeated requests)
# ==========================================
Write-Host "==========================================" -ForegroundColor Magenta
Write-Host "Phase 2: Repeated Requests (Cache Hit Expected)" -ForegroundColor Magenta
Write-Host "==========================================" -ForegroundColor Magenta
Write-Host ""

# Test 3: Get Products (Second - Cache Hit)
Measure-Request `
    -TestName "Test 3: Products (Cached)" `
    -Method "GET" `
    -Uri "$BASE_URL/api/woocommerce/products?page=1&per_page=10" `
    -ExpectCache

# Test 4: Get Blogs (Second - Cache Hit)
Measure-Request `
    -TestName "Test 4: Blogs (Cached)" `
    -Method "GET" `
    -Uri "$BASE_URL/api/woocommerce/blogs" `
    -ExpectCache

# Test 4a: Get Orders (Second - Cache Hit)
Measure-Request `
    -TestName "Test 4a: Orders (Cached)" `
    -Method "GET" `
    -Uri "$BASE_URL/api/woocommerce/orders?email=$TEST_EMAIL" `
    -ExpectCache

# Test 4b: Get Subscriptions (Second - Cache Hit)
Measure-Request `
    -TestName "Test 4b: Subscriptions (Cached)" `
    -Method "GET" `
    -Uri "$BASE_URL/api/woocommerce/subscriptions?email=$TEST_EMAIL" `
    -ExpectCache

# Test 4c: Get Billing Address (Second - Cache Hit)
Measure-Request `
    -TestName "Test 4c: Billing Address (Cached)" `
    -Method "GET" `
    -Uri "$BASE_URL/api/woocommerce/billing-address?email=$TEST_EMAIL" `
    -ExpectCache

# ==========================================
# DIFFERENT PARAMETERS (Cache Miss)
# ==========================================
Write-Host "==========================================" -ForegroundColor Magenta
Write-Host "Phase 3: Different Parameters (Cache Miss)" -ForegroundColor Magenta
Write-Host "==========================================" -ForegroundColor Magenta
Write-Host ""

# Test 5: Search Products (Cache Miss - different query)
Measure-Request `
    -TestName "Test 5: Products Search" `
    -Method "GET" `
    -Uri "$BASE_URL/api/woocommerce/products?search=health"

# Test 6: Products Page 2 (Cache Miss - different page)
Measure-Request `
    -TestName "Test 6: Products Page 2" `
    -Method "GET" `
    -Uri "$BASE_URL/api/woocommerce/products?page=2&per_page=10"

# ==========================================
# FORCE REFRESH (nocache parameter)
# ==========================================
Write-Host "==========================================" -ForegroundColor Magenta
Write-Host "Phase 4: Force Refresh (Skip Cache)" -ForegroundColor Magenta
Write-Host "==========================================" -ForegroundColor Magenta
Write-Host ""

# Test 7: Products with nocache
Measure-Request `
    -TestName "Test 7: Products (Force Refresh)" `
    -Method "GET" `
    -Uri "$BASE_URL/api/woocommerce/products?page=1&per_page=10&nocache=1"

# Test 7a: Orders with nocache
Measure-Request `
    -TestName "Test 7a: Orders (Force Refresh)" `
    -Method "GET" `
    -Uri "$BASE_URL/api/woocommerce/orders?email=$TEST_EMAIL&nocache=1"

# Test 7b: Subscriptions with nocache
Measure-Request `
    -TestName "Test 7b: Subscriptions (Force Refresh)" `
    -Method "GET" `
    -Uri "$BASE_URL/api/woocommerce/subscriptions?email=$TEST_EMAIL&nocache=1"

# Test 7c: Billing Address with nocache
Measure-Request `
    -TestName "Test 7c: Billing Address (Force Refresh)" `
    -Method "GET" `
    -Uri "$BASE_URL/api/woocommerce/billing-address?email=$TEST_EMAIL&nocache=1"

# ==========================================
# CACHE HIT VERIFICATION
# ==========================================
Write-Host "==========================================" -ForegroundColor Magenta
Write-Host "Phase 5: Final Cache Hit Verification" -ForegroundColor Magenta
Write-Host "==========================================" -ForegroundColor Magenta
Write-Host ""

# Test 8: Products Final (Should be cached from Test 7's response)
Measure-Request `
    -TestName "Test 8: Products (Final Cache Test)" `
    -Method "GET" `
    -Uri "$BASE_URL/api/woocommerce/products?page=1&per_page=10" `
    -ExpectCache

# Test 8a: Orders Final (Should be cached from Test 7a's response)
Measure-Request `
    -TestName "Test 8a: Orders (Final Cache Test)" `
    -Method "GET" `
    -Uri "$BASE_URL/api/woocommerce/orders?email=$TEST_EMAIL" `
    -ExpectCache

# Test 8b: Subscriptions Final (Should be cached from Test 7b's response)
Measure-Request `
    -TestName "Test 8b: Subscriptions (Final Cache Test)" `
    -Method "GET" `
    -Uri "$BASE_URL/api/woocommerce/subscriptions?email=$TEST_EMAIL" `
    -ExpectCache

# Test 8c: Billing Address Final (Should be cached from Test 7c's response)
Measure-Request `
    -TestName "Test 8c: Billing Address (Final Cache Test)" `
    -Method "GET" `
    -Uri "$BASE_URL/api/woocommerce/billing-address?email=$TEST_EMAIL" `
    -ExpectCache

# Calculate total time
$overallEnd = Get-Date
$totalTime = ($overallEnd - $overallStart).TotalSeconds

# ==========================================
# Performance Summary
# ==========================================
Write-Host ""
Write-Host "==========================================" -ForegroundColor Blue
Write-Host "Performance Summary" -ForegroundColor Blue
Write-Host "==========================================" -ForegroundColor Blue
Write-Host ""

# Calculate metrics
$cacheHitCount = ($cacheHits.Values | Where-Object { $_ -eq $true }).Count
$totalTests = $timings.Count
$cacheHitRate = if ($totalTests -gt 0) { [math]::Round(($cacheHitCount / $totalTests) * 100, 1) } else { 0 }

# Separate cache hit and miss times
$cacheHitTimes = @()
$cacheMissTimes = @()

foreach ($testName in $timings.Keys) {
    if ($cacheHits[$testName]) {
        $cacheHitTimes += $timings[$testName]
    } else {
        $cacheMissTimes += $timings[$testName]
    }
}

$avgCacheHitTime = if ($cacheHitTimes.Count -gt 0) { 
    ($cacheHitTimes | Measure-Object -Average).Average 
} else { 0 }

$avgCacheMissTime = if ($cacheMissTimes.Count -gt 0) { 
    ($cacheMissTimes | Measure-Object -Average).Average 
} else { 0 }

Write-Host "Individual Test Results:" -ForegroundColor Cyan
foreach ($testName in $timings.Keys | Sort-Object) {
    $time = $timings[$testName]
    $status = $statuses[$testName]
    $cached = $cacheHits[$testName]
    $stale = $staleFlags[$testName]
    $refreshing = $refreshingFlags[$testName]
    
    $cacheLabel = if ($cached) { 
        if ($stale) { "[STALE CACHE]" } else { "[CACHE HIT]" }
    } else { "[CACHE MISS]" }
    
    $color = if ($cached -and $time -lt 0.5) { "Green" } 
             elseif ($time -lt 1.0) { "Green" }
             elseif ($time -lt 2.0) { "Yellow" }
             else { "Red" }
    
    $staleInfo = if ($stale) { " [STALE]" } else { "" }
    $refreshInfo = if ($refreshing) { " [REFRESHING]" } else { "" }
    
    Write-Host "  $cacheLabel$staleInfo$refreshInfo $testName : $([math]::Round($time, 3))s (Status: $status)" -ForegroundColor $color
}

Write-Host ""
Write-Host "Cache Performance Metrics:" -ForegroundColor Cyan
$staleCount = ($staleFlags.Values | Where-Object { $_ -eq $true }).Count
$refreshingCount = ($refreshingFlags.Values | Where-Object { $_ -eq $true }).Count

Write-Host "  Cache Hit Rate: $cacheHitRate% ($cacheHitCount of $totalTests requests)"
if ($staleCount -gt 0) {
    Write-Host "  Stale Data Served: $staleCount requests (ultra-fast <50ms)" -ForegroundColor Yellow
}
if ($refreshingCount -gt 0) {
    Write-Host "  Background Refreshes: $refreshingCount requests" -ForegroundColor Cyan
}
Write-Host "  Avg Cache Hit Time: $([math]::Round($avgCacheHitTime * 1000, 0))ms"
Write-Host "  Avg Cache Miss Time: $([math]::Round($avgCacheMissTime * 1000, 0))ms"

if ($avgCacheHitTime -gt 0 -and $avgCacheMissTime -gt 0) {
    $speedup = [math]::Round($avgCacheMissTime / $avgCacheHitTime, 1)
    Write-Host "  Speed Improvement: ${speedup}x faster with cache" -ForegroundColor Green
}

Write-Host ""
Write-Host "Overall Metrics:" -ForegroundColor Cyan
Write-Host "  Total Execution Time: $([math]::Round($totalTime, 3))s"
Write-Host "  Number of Tests: $totalTests"
Write-Host ""

# Performance Analysis
Write-Host "Performance Analysis:" -ForegroundColor Cyan
if ($avgCacheHitTime -lt 0.3) {
    Write-Host "  [EXCELLENT] Cache hits under 300ms - Redis caching working perfectly!" -ForegroundColor Green
} elseif ($avgCacheHitTime -lt 0.5) {
    Write-Host "  [GOOD] Cache hits under 500ms - Good Redis performance" -ForegroundColor Green
} elseif ($avgCacheHitTime -lt 1.0) {
    Write-Host "  [OK] Cache hits under 1s - Consider checking Redis latency" -ForegroundColor Yellow
} else {
    Write-Host "  [SLOW] Cache hits over 1s - Redis connection may need optimization" -ForegroundColor Red
}

if ($staleCount -gt 0) {
    Write-Host "  [STALE-WHILE-REVALIDATE] $staleCount stale requests served instantly with background refresh" -ForegroundColor Green
}

Write-Host ""
Write-Host "All tests completed!" -ForegroundColor Green
Write-Host ""
