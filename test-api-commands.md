# Test API Commands for /api/app-users/register

## Prerequisites
1. Make sure your dev server is running: `npm run dev`
2. Get your API key from the admin panel (Settings → API Keys)
3. Replace `YOUR_API_KEY_HERE` with your actual API key

## Test Commands

### Test 1: Without API Key (Should Fail - 401)
```powershell
curl -X POST http://localhost:3000/api/app-users/register `
  -H "Content-Type: application/json" `
  -d '{\"wpUserId\":\"123\",\"email\":\"test@example.com\",\"name\":\"Test User\",\"displayName\":\"Test\"}'
```

### Test 2: With Invalid API Key (Should Fail - 401)
```powershell
curl -X POST http://localhost:3000/api/app-users/register `
  -H "Content-Type: application/json" `
  -H "X-API-Key: ahc_live_sk_invalid_key_12345" `
  -d '{\"wpUserId\":\"123\",\"email\":\"test@example.com\",\"name\":\"Test User\",\"displayName\":\"Test\"}'
```

### Test 3: With Valid API Key - X-API-Key Header (Should Succeed - 201)
```powershell
curl -X POST http://localhost:3000/api/app-users/register `
  -H "Content-Type: application/json" `
  -H "X-API-Key: YOUR_API_KEY_HERE" `
  -d '{\"wpUserId\":\"123\",\"email\":\"test@example.com\",\"name\":\"Test User\",\"displayName\":\"Test User Display\",\"phone\":\"+1234567890\",\"age\":30,\"height\":\"175cm\",\"weight\":\"75kg\",\"goal\":\"70kg\",\"initialWeight\":\"80kg\",\"weightSet\":true}'
```

### Test 4: With Valid API Key - Authorization Bearer Header (Should Succeed - 201)
```powershell
curl -X POST http://localhost:3000/api/app-users/register `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer YOUR_API_KEY_HERE" `
  -d '{\"wpUserId\":\"456\",\"email\":\"test2@example.com\",\"name\":\"Test User 2\",\"displayName\":\"Test User 2 Display\",\"phone\":\"+1234567891\",\"age\":25,\"height\":\"165cm\",\"weight\":\"65kg\",\"goal\":\"60kg\",\"initialWeight\":\"70kg\",\"weightSet\":true}'
```

## Expected Responses

### Success Response (201):
```json
{
  "success": true,
  "message": "User registered successfully",
  "user": {
    "id": "...",
    "wpUserId": "123",
    "email": "test@example.com",
    ...
  }
}
```

### Error Response - No API Key (401):
```json
{
  "error": "Unauthorized. Valid API key required."
}
```

### Error Response - Invalid API Key (401):
```json
{
  "error": "Unauthorized. Valid API key required."
}
```

