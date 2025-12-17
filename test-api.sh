#!/bin/bash

# Test script for /api/app-users/register endpoint
# Make sure your dev server is running: npm run dev

BASE_URL="http://localhost:3000"
ENDPOINT="${BASE_URL}/api/app-users/register"

# Replace with your actual API key from the admin panel
API_KEY="ahc_live_sk_YOUR_API_KEY_HERE"

echo "=========================================="
echo "Testing App Users Register API"
echo "=========================================="
echo ""

# Test 1: Without API key (should fail)
echo "Test 1: Request WITHOUT API key (should fail with 401)"
echo "----------------------------------------"
curl -X POST "${ENDPOINT}" \
  -H "Content-Type: application/json" \
  -d '{
    "wpUserId": "123",
    "email": "test@example.com",
    "name": "Test User",
    "displayName": "Test"
  }' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | jq '.' 2>/dev/null || cat
echo ""
echo ""

# Test 2: With invalid API key (should fail)
echo "Test 2: Request WITH INVALID API key (should fail with 401)"
echo "----------------------------------------"
curl -X POST "${ENDPOINT}" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ahc_live_sk_invalid_key_12345" \
  -d '{
    "wpUserId": "123",
    "email": "test@example.com",
    "name": "Test User",
    "displayName": "Test"
  }' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | jq '.' 2>/dev/null || cat
echo ""
echo ""

# Test 3: With valid API key using X-API-Key header (should succeed)
echo "Test 3: Request WITH VALID API key (X-API-Key header)"
echo "----------------------------------------"
curl -X POST "${ENDPOINT}" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{
    "wpUserId": "123",
    "email": "test@example.com",
    "name": "Test User",
    "displayName": "Test User Display",
    "phone": "+1234567890",
    "age": 30,
    "height": "175cm",
    "weight": "75kg",
    "goal": "70kg",
    "initialWeight": "80kg",
    "weightSet": true
  }' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | jq '.' 2>/dev/null || cat
echo ""
echo ""

# Test 4: With valid API key using Authorization Bearer header (should succeed)
echo "Test 4: Request WITH VALID API key (Authorization Bearer header)"
echo "----------------------------------------"
curl -X POST "${ENDPOINT}" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${API_KEY}" \
  -d '{
    "wpUserId": "456",
    "email": "test2@example.com",
    "name": "Test User 2",
    "displayName": "Test User 2 Display",
    "phone": "+1234567891",
    "age": 25,
    "height": "165cm",
    "weight": "65kg",
    "goal": "60kg",
    "initialWeight": "70kg",
    "weightSet": true
  }' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | jq '.' 2>/dev/null || cat
echo ""
echo ""

echo "=========================================="
echo "Testing Complete"
echo "=========================================="

