# Backend Final Project - Group 6

A comprehensive inventory and asset management system with role-based access control, dual authentication methods (web + API), and multi-database support (MongoDB & Supabase).

## Overview

This is a full-stack backend application built with **Express.js** that provides:

- **User Authentication & Authorization** - JWT-based login, registration, and role management
- **Inventory Management** - Full CRUD operations for items with history tracking
- **Check-in/Check-out System** - Track item transactions with timestamps
- **Admin Dashboard** - User management, API key management, and reporting
- **Dual Interfaces** - Web UI (Handlebars templating) + RESTful API
- **Multi-Database Support** - Switch between MongoDB and Supabase seamlessly

## Getting Started

### Prerequisites

- **Node.js** v18+ and npm
- **MongoDB** (local or cloud URI) OR **Supabase** account with credentials
- **Git** for version control

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/TANGHuyming/backend-final-project-group-6.git
   cd backend-final-project-group-6
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**
   - Copy `.env.example` to `.env`
   - Fill in your configuration (see [Configuration](#configuration) below)

   ```bash
   cp .env.example .env
   ```

4. **Start the application**

   ```bash
   # Development (with hot-reload via nodemon)
   npm run dev

   # Production
   npm start
   ```

The application will be available at `http://localhost:3000` (or your configured port/domain).

## Configuration

Create a `.env` file in the project root with the following variables:

```env
# Server Configuration
PORT=3000                              # Server port (default: 3000)
DOMAIN=localhost                       # Domain name for local development
BASE_URL=http://localhost:3000         # Full base URL (used in production)
NODE_ENV=development                   # Environment: development or production

# Database Configuration
DB_PROVIDER=mongodb                    # Database provider: mongodb or supabase
MONGO_URI=mongodb://...                # MongoDB connection string (if using MongoDB)
SUPABASE_URL=https://...               # Supabase project URL (if using Supabase)
SUPABASE_SERVICE_ROLE_KEY=...          # Supabase service role key (if using Supabase)

# Security
JWT_SECRET=your-jwt-secret-key         # Secret for JWT token signing
SESSION_SECRET=your-session-secret     # Secret for session management
```

### Database Provider Selection

The application supports two database backends:

#### MongoDB

- Set `DB_PROVIDER=mongodb`
- Provide a valid `MONGO_URI` (e.g., `mongodb://localhost:27017/inventory`)
- Supports local MongoDB or MongoDB Atlas

#### Supabase (PostgreSQL)

- Set `DB_PROVIDER=supabase`
- Provide `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- Full PostgreSQL support with Supabase Auth integration

## Project Structure

```
backend-final-project-group-6/
├── app.js                          # Main Express application
├── config/
│   └── app.config.js               # Configuration loader
├── controllers/                    # Request handlers
│   ├── auth.controller.js          # Authentication logic
│   ├── public.controller.js        # Web UI controllers
│   ├── api.controller.js           # API endpoint handlers
│   ├── admin.controller.js         # Admin functions
│   └── key.controller.js           # API key management
├── routes/                         # Express route definitions
│   ├── auth.routes.js              # Authentication routes
│   ├── public.routes.js            # Web UI routes
│   ├── api.routes.js               # API routes
│   └── admin.routes.js             # Admin routes (optional)
├── middleware/                     # Custom middleware
│   ├── authMiddleware.js           # JWT verification & auth
│   ├── apiAuthMiddleware.js        # API key verification
│   ├── roleCheck.js                # Role-based access control
│   └── rateLimiter.js              # Rate limiting
├── services/                       # Business logic
│   ├── itemService.js              # Item operations
│   ├── userService.js              # User operations
│   └── adminService.js             # Admin operations
├── data/                           # Database providers & models
│   ├── MongoDBProvider.js          # MongoDB implementation
│   ├── SupabaseProvider.js         # Supabase implementation
│   ├── databaseProvider.js         # Base interface
│   ├── models/                     # Data models/schemas
│   └── databaseSchema/             # Schema definitions
├── utils/                          # Utility functions
│   ├── createDBProvider.js         # Database provider factory
│   └── dbProviderShared.js         # Shared DB context
├── views/                          # Handlebars templates
│   ├── layouts/                    # Layout templates
│   └── partials/                   # Reusable partial components
├── public/                         # Static assets (CSS, JS, images)
├── test/                           # Test files
├── package.json                    # Dependencies & scripts
└── .env.example                    # Environment variable template
```

## Key Features

### 1. **Authentication & Authorization**

#### Web Authentication

- **Login** (`POST /login`) - JWT-based authentication
- **Register** (`POST /register`) - Create new user accounts
- **Logout** (`GET /logout`) - Clear session and JWT
- **Rate Limiting** - Login attempts limited to prevent brute force

#### API Authentication

- **API Login** (`POST /api/login`) - Generate JWT for API use
- **API Keys** - Generate and manage persistent API keys for long-lived access
- **Header-based Auth** - `Authorization: Bearer <token>` for API requests

#### Role-Based Access Control (RBAC)

- **User Roles**
  - `Admin` - Full system access, user/key management
  - `Standard` - Regular user, item access
- **Protected Routes** - All sensitive endpoints require authentication
- **Role Enforcement** - Admin-only routes check role status

### 2. **Inventory Management**

#### Items CRUD

- **View Items** (`GET /items`) - List all items with optional filtering
- **Item Details** (`GET /items/:id`) - View full item information
- **Create Item** (`POST /items`) - Add new items to inventory
- **Update Item** (`PUT /items/:id`) - Modify existing items
- **Delete Item** (`DELETE /items/:id`) - Remove items (Admin only)
- **Item History** (`GET /items/:id/history`) - View transaction history

#### Transaction System

- **Check-In** (`POST /transactions/checkin`) - User checks in an item
- **Check-Out** (`POST /transactions/checkout`) - User checks out an item
- **Admin Check-Out** (`POST /transactions/adminCheckout`) - Force check-out as Admin
- **Transaction Logging** - All transactions tracked with timestamps

### 3. **Admin Dashboard**

#### User Management

- **List Users** (`GET /users`) - View all system users
- **Change Role** (`POST /users/:id/role`) - Promote/demote users
- **Toggle Status** (`POST /users/:id/status`) - Enable/disable user accounts

#### API Key Management

- **List Keys** (`GET /keys`) - View active API keys
- **Generate Key** (`POST /keys/generate`) - Create new API keys
- **Revoke Key** (`POST /keys/revoke/:id`) - Deactivate API keys

#### Reporting

- **Dashboard** (`GET /`) - Home overview with user's activity
- **Report Page** (`GET /report`) - Generate inventory reports
- **Activity Logs** (`GET /logs`) - View system activity

### 4. **Web Interface**

Built with **Express Handlebars** templating:

- Responsive HTML pages for all major features
- Dynamic navigation based on user roles
- Form handling for create/update operations
- Error pages (404, 500)

### 5. **API Interface**

RESTful API with JSON request/response:

- All functionality accessible via `/api/*` routes
- API key and JWT authentication
- Proper HTTP status codes and error messages
- Rate limiting on login endpoints

## PUBLIC-facing Endpoints

### Authentication

```
POST   /login                      - Web login
GET    /login                      - Show login form
POST   /register                   - Web registration
GET    /register                   - Show registration form
GET    /logout                     - Clear session
```

### Items

```
GET    /items                      - List all items
GET    /items/:id                  - Get item details
GET    /items/:id/history          - Get item transaction history
POST   /items                      - Create item
PUT    /items/:id                  - Update item
DELETE /items/:id                  - Delete item (Admin)
```

### Transactions

```
POST   /transactions/checkin       - Check in item
POST   /transactions/checkout      - Check out item
POST   /transactions/adminCheckout - Admin force checkout
POST   /transactions/adminCheckin - Admin force checkout
```

### Admin - Users

```
GET    /users                      - List all users (Admin)
POST   /users/:id/role             - Change user role (Admin)
POST   /users/:id/status           - Toggle user status (Admin)
POST   /api/users                  - Create user (Admin)
PATCH  /api/users/:id/role         - Change user role via API (Admin)
PATCH  /api/users/:id/status       - Toggle user status via API (Admin)
```

### Admin - API Keys

```
GET    /keys                       - List API keys (Admin)
POST   /keys/generate              - Generate new key (Admin)
POST   /keys/revoke/:id            - Revoke key (Admin)
POST   /api/keys                   - Create key via API (Admin)
DELETE /api/keys/:id               - Revoke key via API (Admin)
```

### Other

```
GET    /                           - Dashboard home
GET    /home                       - Home page
GET    /owned                      - User's owned items
GET    /report                     - Reports page
GET    /logs                       - Activity logs
GET    /files/:bucket/:id          - Reference/Image file
```

## API Endpoints

### Auth

#### Login

Authenticates a user and provides a session token.

- **Endpoint:** `POST /api/login`
- **Inputs:** `email` and `password` (JSON).
- **Outputs:** A success message, a **JWT token** for session management, and a **user object** containing the `id`, `email`, and `role`.

```bash
curl -X POST http://localhost:3000/api/login \
     -H "Content-Type: application/json" \
     -d '{"email": "admin@gmail.com", "password": "admin"}'
```

---

### User Management

#### List Users (Admin)

Retrieves a complete list of all users in the system.

- **Endpoint:** `GET /api/users`
- **Inputs:** None (requires Bearer Token in Header).
- **Outputs:** A success flag, user count, and an array of **user objects** containing detailed profile and status information (id, email, name, role, status, createdAt, disabledAt).
- **Role Requirement:** Admin-only

```bash
curl -X GET http://localhost:3000/api/users \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer [your_token]"
```

---

#### Create User (Admin)

Registers a new user account within the system.

- **Endpoint:** `POST /api/users`
- **Inputs:** `email`, `name`, `password`, and `role` (Admin/Technician).
- **Outputs:** The newly created user object and a success status.
- **Role Requirement:** Admin-only

```bash
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

---

#### Update User Role (Admin)

Modifies the access level assigned to a specific user.

- **Endpoint:** `PATCH /api/users/[USER_ID]/role`
- **Inputs:** `role` (Admin/Technician) (JSON) and `USER_ID` (URL Parameter).
- **Outputs:** Success confirmation and the updated user object.
- **Role Requirement:** Admin-only

```bash
curl -X PATCH http://localhost:3000/api/users/[USER_ID]/role \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer [your_token]" \
     -d '{
       "role": "Admin"
     }'
```

---

#### Update User Status (Admin)

Changes a user's account status (e.g., to "Disabled" or "Active").

- **Endpoint:** `PATCH /api/users/[USER_ID]/status`
- **Inputs:** `status` (Disabled/Active) and `USER_ID` (URL Parameter).
- **Outputs:** Success confirmation and updated status details.
- **Role Requirement:** Admin-only

```bash
curl -X PATCH http://localhost:3000/api/users/[USER_ID]/status \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer [your_token]" \
     -d '{
       "status": "Disabled"
     }'
```

---

### Key Management

#### List API Keys (Admin)

Retrieves all generated API keys in the system.

- **Endpoint:** `GET /api/keys`
- **Inputs:** None (requires Admin Bearer Token in Header).
- **Outputs:** A success flag and an array containing all API key objects.
- **Role Requirement:** Admin-only

```bash
curl -X GET http://localhost:3000/api/keys \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer [your_token]"
```

---

#### Create API Key (Admin)

Generates a new API key for a specific user. **Note:** This is the only time the raw key is visible.

- **Endpoint:** `POST /api/keys`
- **Inputs:** `name` (label for the key) and `userId` (the owner of the key).
- **Outputs:** A success flag and the `raw` API key string.
- **Role Requirement:** Admin-only

```bash
curl -X POST http://localhost:3000/api/keys \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer [your_token]" \
     -d '{"name": "My Key", "userId": "123"}'
```

---

#### Revoke API Key (Admin)

Permanently deletes/invalidates an existing API key.

- **Endpoint:** `DELETE /api/keys/[KEY_ID]`
- **Inputs:** `KEY_ID` (URL Parameter).
- **Outputs:** A success flag and a confirmation message.
- **Role Requirement:** Admin-only

```bash
curl -X DELETE http://localhost:3000/api/keys/[KEY_ID] \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer [your_token]"
```

---

## Security Features

- **Password Hashing** - bcryptjs for secure password storage
- **JWT Tokens** - Stateless authentication with signed tokens
- **CORS Protection** - Whitelist-based origin validation
- **Rate Limiting** - Prevents brute force on login endpoints
- **Role-Based Access** - Fine-grained authorization per endpoint
- **Secure Headers** - Disables `X-Powered-By` header
- **Cookie Security** - HTTP-only cookies for sessions

### CORS Whitelist

Configure allowed origins in `app.js`:

- `http://localhost:3000`
- `http://127.0.0.1:3000`
- `http://localhost:5173`
- `https://websitename.com` (update for production)

## Dependencies

### Core

- **express** - Web framework
- **mongoose** - MongoDB ODM
- **@supabase/supabase-js** - Supabase client
- **express-handlebars** - Template engine
- **jsonwebtoken** - JWT authentication
- **bcryptjs** - Password hashing

### Middleware & Utils

- **cors** - Cross-origin resource sharing
- **cookie-parser** - Cookie parsing
- **morgan** - HTTP request logging
- **express-rate-limit** - Rate limiting
- **dotenv** - Environment variables
- **multiparty** - File upload parsing

### Development

- **nodemon** - Auto-reload development server

## Scripts

```bash
npm start          # Run production server
npm run dev        # Run development server with hot-reload
npm test           # Run tests
```

## Known Issues & TODOs

- [ ] Report page integration incomplete (needs frontend work)
- [ ] Admin routes file commented out (functionality in public.routes.js)
- [ ] Navigation system pending finalization
- [ ] CloudFlare hosting configuration needed
- [ ] API checkout/checkin endpoints commented out (routes/api.routes.js)

## Environment Notes

- **Node.js v22** - Requires DNS workaround for MongoDB connections
- **Development** - Uses `nodemon` for auto-reload on file changes
- **Database Switching** - Change `DB_PROVIDER` environment variable to switch providers

## Database Providers

Both database providers implement the same interface (see `databaseProvider.js`):

### MongoDB Provider

- File: `data/MongoDBProvider.js`
- Uses Mongoose for schema management
- Supports local and Atlas deployments

### Supabase Provider

- File: `data/SupabaseProvider.js`
- Uses PostgreSQL backend
- Includes auth integration
- Note: Supabase is deprecated and is no longer updated (the design is left here in case anyone wants to build upon it)

## License

ISC License

## Repository

- **GitHub**: https://github.com/TANGHuyming/backend-final-project-group-6
- **Issues**: https://github.com/TANGHuyming/backend-final-project-group-6/issues

## Support

For issues or questions:

1. Check the [Known Issues](#-known-issues--todos) section
2. Review the code comments in `app.js` and routes
3. Open an issue on GitHub

---

**Last Updated**: 2026-04-27  
**Node Version**: v18+  
**Status**: Active Development
