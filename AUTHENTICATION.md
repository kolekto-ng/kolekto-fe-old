# Authentication System Documentation

## Overview

Kolekto uses a cross-origin cookies authentication system with Bearer token headers for secure API communication. This system provides:

- **Cross-origin cookie support** for seamless authentication across domains
- **Bearer token headers** for API authorization
- **Automatic session management** with Zustand state management
- **Secure token storage** in localStorage with expiration handling
- **Automatic logout** on authentication failures

## Architecture

### 1. API Configuration (`src/utils/axios.tsx`)

The axios instance is configured with:
- `withCredentials: true` for cross-origin cookie support
- Automatic Bearer token injection from localStorage
- Response interceptors for 401 handling
- Environment-based API URL configuration

### 2. Authentication Store (`src/store/useAuthStore.ts`)

Zustand store managing:
- User session state
- Authentication methods (signIn, signUp, signOut)
- Session validation and cleanup
- Loading states and error handling

### 3. API Utilities (`src/utils/api.ts`)

Helper functions for authenticated API calls:
- `authenticatedFetch()` - Generic authenticated fetch wrapper
- `handleApiResponse()` - Standardized response handling
- Domain-specific API functions (collections, transactions, users, etc.)

## Usage Examples

### Basic Authentication

```typescript
import { useAuthStore } from '@/store';

const { user, signIn, signOut, isLoading } = useAuthStore();

// Sign in
const handleSignIn = async (email: string, password: string) => {
  const { user, error } = await signIn(email, password);
  if (user) {
    // Redirect to dashboard
    navigate('/dashboard');
  } else {
    // Handle error
    console.error(error.message);
  }
};

// Sign out
const handleSignOut = async () => {
  await signOut();
  navigate('/');
};
```

### Making Authenticated API Calls

```typescript
import { collectionAPI } from '@/utils/api';

// Create a collection
const createCollection = async (data: any) => {
  try {
    const result = await collectionAPI.create(data);
    return result;
  } catch (error) {
    console.error('Failed to create collection:', error.message);
    throw error;
  }
};

// Get all collections
const getCollections = async () => {
  try {
    const collections = await collectionAPI.getAll();
    return collections;
  } catch (error) {
    console.error('Failed to fetch collections:', error.message);
    throw error;
  }
};
```

### Custom Authenticated Requests

```typescript
import { authenticatedFetch, handleApiResponse } from '@/utils/api';

const customApiCall = async (data: any) => {
  try {
    const response = await authenticatedFetch('/custom-endpoint', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    
    return await handleApiResponse(response);
  } catch (error) {
    console.error('API call failed:', error.message);
    throw error;
  }
};
```

## Environment Configuration

### Required Environment Variables

```bash
# Development
VITE_API_BASE_URL=http://localhost:5000/api

# Production
VITE_API_URL=https://api.kolekto.com.ng/api
```

### Backend Requirements

Your backend must support:

1. **CORS Configuration**
```javascript
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true, // CRUCIAL for cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
```

2. **Cookie Settings**
```javascript
res.cookie('auth-token', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
});
```

3. **Authentication Endpoints**
- `POST /api/auth/signin` - User login
- `POST /api/auth/signup` - User registration
- `POST /api/auth/signout` - User logout
- `GET /api/auth/me` - Get current user

## Security Features

### 1. Automatic Token Management
- Tokens are automatically included in API requests
- Invalid tokens are removed from localStorage
- Session expiration is handled automatically

### 2. Cross-Origin Security
- Cookies are sent with `credentials: 'include'`
- CORS is properly configured for cross-domain requests
- Secure cookie settings in production

### 3. Error Handling
- 401 responses automatically clear authentication state
- Network errors are handled gracefully
- User-friendly error messages

### 4. Session Persistence
- Sessions persist across browser tabs
- Automatic session validation on app load
- Cross-tab session synchronization

## Migration from Previous System

### 1. Update Imports
```typescript
// Old
import { useAuth } from '@/context/AuthContext';

// New
import { useAuthStore } from '@/store';
```

### 2. Update API Calls
```typescript
// Old
const response = await axiosInstance.post('/endpoint', data);

// New
const response = await collectionAPI.create(data);
// or
const response = await authenticatedFetch('/endpoint', {
  method: 'POST',
  body: JSON.stringify(data),
});
```

### 3. Update Error Handling
```typescript
// Old
catch (error) {
  toast.error(error.response?.data?.message);
}

// New
catch (error) {
  toast.error(error.message);
}
```

## Best Practices

### 1. Always Use the API Utilities
- Use `collectionAPI`, `transactionAPI`, etc. for domain-specific calls
- Use `authenticatedFetch` for custom endpoints
- Avoid direct axios calls for authenticated requests

### 2. Handle Loading States
```typescript
const { isLoading } = useAuthStore();

if (isLoading) {
  return <LoadingSpinner />;
}
```

### 3. Check Authentication Status
```typescript
const { user } = useAuthStore();

if (!user) {
  return <Navigate to="/login" />;
}
```

### 4. Use Error Boundaries
```typescript
try {
  const data = await apiCall();
} catch (error) {
  if (error.message === 'Authentication required') {
    // Redirect to login
    navigate('/login');
  } else {
    // Handle other errors
    toast.error(error.message);
  }
}
```

## Troubleshooting

### Common Issues

1. **CORS Errors**
   - Ensure backend has `credentials: true` in CORS config
   - Check that frontend URL is in allowed origins

2. **Cookies Not Sent**
   - Verify `withCredentials: true` is set
   - Check cookie domain and path settings

3. **401 Errors**
   - Check token expiration
   - Verify token format in localStorage
   - Ensure backend validates tokens correctly

4. **Session Not Persisting**
   - Check localStorage for valid session data
   - Verify `checkAuth()` is called on app load
   - Check for JavaScript errors in console

### Debug Mode

Enable debug logging by setting:
```javascript
localStorage.setItem('debug', 'true');
```

This will log authentication events to the console.

## API Reference

### Auth Store Methods

- `signIn(email, password)` - Authenticate user
- `signUp(email, password, fullName, phoneNumber?)` - Register user
- `signOut()` - Logout user
- `checkAuth()` - Validate current session
- `sendMagicLink(email)` - Send magic link
- `forgotPassword(email)` - Send password reset
- `resetPassword(token, newPassword)` - Reset password

### API Utilities

- `authenticatedFetch(endpoint, options)` - Generic authenticated fetch
- `handleApiResponse(response)` - Standardized response handling
- `collectionAPI.*` - Collection-related API calls
- `transactionAPI.*` - Transaction-related API calls
- `userAPI.*` - User profile API calls
- `withdrawalAPI.*` - Withdrawal-related API calls

