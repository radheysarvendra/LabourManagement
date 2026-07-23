## Auth APIs

Base route examples below assume the app is mounted at the backend root.

### 1. `POST /auth/check-phone`
Check whether a phone number already exists.

Request body:
```json
{
  "phone": "9876543210"
}
```

Success response:
```json
{
  "success": true,
  "exists": true,
  "isRegistered": true,
  "phone": "9876543210",
  "userId": 1,
  "userType": "labour",
  "roles": ["LABOUR"],
  "flow": "new",
  "message": "User is already registered"
}
```

Not registered response:
```json
{
  "success": true,
  "exists": false,
  "isRegistered": false,
  "phone": "9876543210",
  "userType": null,
  "message": "User not registered. Registration required."
}
```

### 2. `POST /auth/request-otp`
Send login OTP.

Request body:
```json
{
  "phone": "9876543210"
}
```

Optional legacy body:
```json
{
  "phone": "9876543210",
  "userType": "labour"
}
```

Success response:
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "isRegistered": true,
  "roles": ["LABOUR", "OWNER"],
  "requiresRoleSelection": true,
  "flow": "new",
  "testOtp": "1234"
}
```

### 3. `POST /auth/verify-otp`
Verify OTP and create a session token.

Request body:
```json
{
  "phone": "9876543210",
  "otp": "1234",
  "activeRole": "LABOUR"
}
```

Optional legacy body:
```json
{
  "phone": "9876543210",
  "otp": "1234",
  "userType": "labour"
}
```

New flow success response:
```json
{
  "success": true,
  "message": "Login successful",
  "token": "jwt-token-here",
  "userId": 1,
  "globalUserId": 1,
  "isRegistered": true,
  "roles": ["LABOUR", "OWNER"],
  "permissions": [],
  "userType": "labour",
  "type": "labour",
  "activeRole": "LABOUR",
  "labourId": 5,
  "ownerId": null,
  "contractorId": null,
  "profile": {
    "id": 1,
    "phone": "9876543210",
    "name": "Rahul",
    "email": ""
  },
  "user": {
    "id": 1,
    "phone": "9876543210",
    "name": "Rahul",
    "email": ""
  }
}
```

### 4. `POST /auth/login`
Backward-compatible wrapper for OTP login.

Request body:
```json
{
  "phone": "9876543210",
  "otp": "1234",
  "activeRole": "LABOUR"
}
```

Response:
Same as `POST /auth/verify-otp`.

### 5. `POST /auth/login-password`
Password-based login.

Request body:
```json
{
  "phone": "9876543210",
  "password": "myPassword123",
  "activeRole": "LABOUR"
}
```

Optional alternative fields:
```json
{
  "phone": "9876543210",
  "password": "myPassword123",
  "userType": "labour",
  "role": "LABOUR"
}
```

Success response:
```json
{
  "success": true,
  "message": "Login successful",
  "token": "jwt-token-here",
  "userId": 1,
  "globalUserId": 1,
  "isRegistered": true,
  "roles": ["LABOUR", "OWNER"],
  "permissions": [],
  "userType": "labour",
  "type": "labour",
  "activeRole": "LABOUR",
  "labourId": 5,
  "ownerId": null,
  "contractorId": null,
  "profile": {
    "id": 1,
    "phone": "9876543210",
    "name": "Rahul",
    "email": ""
  },
  "user": {
    "id": 1,
    "phone": "9876543210",
    "name": "Rahul",
    "email": ""
  }
}
```

### 6. `POST /auth/request-password-reset`
Send password-reset OTP.

Request body:
```json
{
  "phone": "9876543210"
}
```

Success response:
```json
{
  "success": true,
  "message": "Password reset OTP sent successfully",
  "testOtp": "1234"
}
```

### 7. `POST /auth/verify-password-reset-otp`
Verify password-reset OTP and return a short-lived reset token.

Request body:
```json
{
  "phone": "9876543210",
  "otp": "1234"
}
```

Success response:
```json
{
  "success": true,
  "resetToken": "jwt-reset-token-here"
}
```

### 8. `POST /auth/reset-password`
Set a new password using a reset token.

Request body:
```json
{
  "resetToken": "jwt-reset-token-here",
  "newPassword": "newpass123"
}
```

Success response:
```json
{
  "success": true,
  "message": "Password updated successfully."
}
```

### 9. `POST /auth/switch-role`
Switch active role for an authenticated user.

Auth header:
```http
Authorization: Bearer <token>
```

Request body:
```json
{
  "activeRole": "OWNER"
}
```

Success response:
```json
{
  "success": true,
  "message": "Switched to OWNER",
  "token": "new-jwt-token-here",
  "activeRole": "OWNER"
}
```

### 10. `POST /auth/logout`
Logout and revoke the current session.

Auth header:
```http
Authorization: Bearer <token>
```

No request body required.

Success response:
```json
{
  "success": true,
  "message": "Logout successful"
}
```

### 11. `POST /api/auth/register`
Register a new user and create the first session.

Request body example:
```json
{
  "name": "Rahul",
  "phone": "9876543210",
  "password": "123456",
  "role": "labour",
  "age": 28,
  "gender": "male",
  "skills": [1, 2],
  "city": "Noida",
  "state": "Uttar Pradesh",
  "district": "Gautam Buddha Nagar",
  "pincode": "201301",
  "area": "Sector 62",
  "address": "House 12"
}
```

Success response:
```json
{
  "success": true,
  "message": "Registration successful",
  "token": "jwt-token-here",
  "type": "labour",
  "userType": "labour",
  "userId": 1,
  "labourId": 5,
  "ownerId": null,
  "globalUserId": 1,
  "activeRole": "LABOUR",
  "user": {
    "id": 1,
    "name": "Rahul",
    "phone": "9876543210",
    "registeredAs": "labour"
  },
  "profile": {},
  "roles": ["labour"],
  "isRegistered": true
}
```

## Notes

- OTP expiry is controlled by `OTP_EXPIRY_MINUTES`.
- Session token expiry is controlled by `SESSION_TTL_DAYS`.
- In test mode, responses may include `testOtp`.
- `login-password`, `request-password-reset`, `verify-password-reset-otp`, and `reset-password` already exist in the current backend code.
