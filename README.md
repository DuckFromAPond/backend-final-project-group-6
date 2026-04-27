# API CLIs

## User Management

### Login

```
curl -X POST http://localhost:3000/api/login \
     -H "Content-Type: application/json" \
     -d '{"email": "user@example.com", "password": "superStrongPassword"}'
```

### List Users

```
curl -X GET http://localhost:3000/api/users \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer [your_token]"
```

### Create Users

```
curl -X POST http://localhost:3000/api/users \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer [your_token]" \
     -d '{
       "email": "user@example.com",
       "name": "John Doe",
       "password": "superStrongPassword",
       "role": "Technician"
     }'
```

### Update User's Role

```
curl -X PATCH http://localhost:3000/api/users/[USER_ID]/role \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer [your_token]" \
     -d '{
       "role": "Admin"
     }'
```

### Update User's Status

```
curl -X PATCH http://localhost:3000/api/users/[USER_ID]/status \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer [your_token]" \
     -d '{
       "status": "Disabled"
     }'
```

## Key Management

### List API Keys

```
curl -X GET http://localhost:3000/api/keys \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer [your_token]"
```

### Create API Key

```
curl -X POST http://localhost:3000/api/keys \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer [your_token]" \
     -d '{"name": "John Doe", "userId": "123"}'
```

### Delete API Key

```
curl -X DELETE http://localhost:3000/api/keys/[KEY_ID] \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer [your_token]"
```
