## API CLIs

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
