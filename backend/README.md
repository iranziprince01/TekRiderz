# TekRiders Backend API

A robust Node.js/Express.js backend API for the TekRiders e-learning platform, built with TypeScript and CouchDB. This backend supports offline-first PWA functionality, comprehensive authentication, course management, and role-based access control.

## 🚀 Features

- **Authentication & Authorization**
  - JWT-based authentication with refresh tokens
  - OTP verification for signup
  - Role-based access control (Admin, Tutor, Learner)
  - Password hashing with bcrypt

- **Course Management**
  - Course creation and moderation workflow
  - Video/text content support
  - Progress tracking and analytics
  - Review and rating system

- **User Management**
  - Profile management
  - Multi-language support (English/Kinyarwanda)
  - Accessibility features
  - User analytics and statistics

- **PWA & Offline Support**
  - Background sync endpoints
  - Offline data synchronization
  - Push notifications support

- **Security**
  - Rate limiting
  - Input validation
  - CORS configuration
  - Comprehensive error handling

## 🛠 Tech Stack

- **Runtime**: Node.js 16+
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: CouchDB
- **Authentication**: JWT (jsonwebtoken)
- **Security**: Helmet, bcryptjs
- **Email**: Nodemailer
- **File Upload**: Multer + Sharp
- **Logging**: Winston
- **Testing**: Jest
- **Validation**: Joi

## 📦 Installation

### Prerequisites

- Node.js 16.0.0 or higher
- CouchDB 3.0 or higher
- npm or yarn

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd tekriders/backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your configuration:
   ```env
   # Server Configuration
   PORT=3001
   NODE_ENV=development
   
   # Database Configuration
   COUCHDB_URL=http://localhost:5984
   COUCHDB_USERNAME=admin
   COUCHDB_PASSWORD=password
   COUCHDB_NAME=tekriders
   
   # JWT Configuration
   JWT_SECRET=your-super-secret-jwt-key-here
   JWT_REFRESH_SECRET=your-refresh-secret-key-here
   
   # Email Configuration (for OTP)
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASSWORD=your-app-password
   ```

4. **Setup CouchDB**
   
   Install CouchDB:
   ```bash
   # macOS
   brew install couchdb
   
   # Ubuntu/Debian
   sudo apt-get install couchdb
   
   # Windows - Download from https://couchdb.apache.org/
   ```
   
   Start CouchDB:
   ```bash
   # macOS/Linux
   sudo systemctl start couchdb
   # or
   couchdb
   
   # Access CouchDB admin at http://localhost:5984/_utils/
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Build for production**
   ```bash
   npm run build
   npm start
   ```

## 🏗 Project Structure

```
backend/
├── src/
│   ├── config/          # Configuration files
│   │   ├── config.ts    # Environment configuration
│   │   └── database.ts  # CouchDB connection
│   ├── controllers/     # Route controllers
│   ├── middleware/      # Express middleware
│   │   ├── auth.ts      # Authentication middleware
│   │   ├── errorHandler.ts
│   │   └── notFoundHandler.ts
│   ├── models/          # Database models
│   │   ├── BaseModel.ts # Base model class
│   │   └── User.ts      # User model
│   ├── routes/          # API routes
│   │   ├── auth.ts      # Authentication routes
│   │   ├── users.ts     # User management
│   │   ├── courses.ts   # Course management
│   │   ├── admin.ts     # Admin endpoints
│   │   └── pwa.ts       # PWA sync endpoints
│   ├── services/        # Business logic services
│   ├── types/           # TypeScript type definitions
│   │   └── index.ts     # All type definitions
│   ├── utils/           # Utility functions
│   │   ├── jwt.ts       # JWT utilities
│   │   ├── otp.ts       # OTP utilities
│   │   └── logger.ts    # Logging configuration
│   └── index.ts         # Application entry point
├── logs/               # Log files
├── uploads/            # File uploads
├── package.json
├── tsconfig.json
└── .env
```

## 🔌 API Endpoints

### Authentication

```http
POST   /api/v1/auth/login           # User login
POST   /api/v1/auth/register        # User registration
POST   /api/v1/auth/verify-otp      # OTP verification
POST   /api/v1/auth/resend-otp      # Resend OTP
POST   /api/v1/auth/refresh         # Refresh token
GET    /api/v1/auth/me              # Get current user
POST   /api/v1/auth/logout          # Logout user
```

### Users

```http
GET    /api/v1/users/profile        # Get user profile
PUT    /api/v1/users/profile        # Update user profile
GET    /api/v1/users/courses        # Get user's courses
POST   /api/v1/users/enroll/:id     # Enroll in course
PUT    /api/v1/users/progress/:id   # Update course progress
GET    /api/v1/users/certificates   # Get certificates
```

### Courses

```http
GET    /api/v1/courses              # Get courses (with filters)
POST   /api/v1/courses              # Create course (tutor only)
GET    /api/v1/courses/:id          # Get course details
PUT    /api/v1/courses/:id          # Update course (tutor/admin)
DELETE /api/v1/courses/:id          # Delete course (tutor/admin)
```

### Admin

```http
GET    /api/v1/admin/stats          # Admin statistics
GET    /api/v1/admin/users          # Get all users
PUT    /api/v1/admin/users/:id/status # Update user status
GET    /api/v1/admin/courses        # Get all courses
PUT    /api/v1/admin/courses/:id/status # Approve/reject course
```

### PWA

```http
POST   /api/v1/pwa/sync             # Sync offline data
```

### Health Check

```http
GET    /health                   # Health check endpoint
```

## 🔐 Authentication

The API uses JWT tokens for authentication:

1. **Login/Register** - Receive access token and refresh token
2. **Include token** in requests: `Authorization: Bearer <token>`
3. **Refresh token** when access token expires
4. **Role-based access** - Different endpoints require different roles

### Roles

- **Admin** - Full system access
- **Tutor** - Can create and manage courses
- **Learner** - Can enroll in and access courses

## 📊 Database Design

The application uses CouchDB with the following document types:

- **Users** - User accounts and profiles
- **Courses** - Course content and metadata
- **Enrollments** - User course enrollments
- **Progress** - Learning progress tracking
- **OTP** - One-time passwords for verification
- **Reviews** - Course reviews and ratings
- **Achievements** - User achievements and badges

## 🔧 Development

### Running Tests

```bash
npm test                # Run all tests
npm run test:watch      # Run tests in watch mode
```

### Code Quality

```bash
npm run lint           # Run ESLint
npm run lint:fix       # Fix linting issues
```

### Database Management

```bash
# Access CouchDB admin interface
open http://localhost:5984/_utils/

# Backup database
curl -X GET http://admin:password@localhost:5984/tekriders/_all_docs?include_docs=true > backup.json

# Restore database
curl -X POST http://admin:password@localhost:5984/tekriders/_bulk_docs -H "Content-Type: application/json" -d @backup.json
```

## 🌐 Deployment

### Production Environment

1. **Set environment variables**
   ```bash
   NODE_ENV=production
   JWT_SECRET=<strong-secret>
   JWT_REFRESH_SECRET=<another-strong-secret>
   COUCHDB_URL=<production-couchdb-url>
   ```

2. **Build and start**
   ```bash
   npm run build
   npm start
   ```

### Docker Deployment

```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3001
CMD ["npm", "start"]
```

### PM2 Process Manager

```bash
npm install -g pm2
pm2 start dist/index.js --name tekriders-api
pm2 startup
pm2 save
```

## 📝 Logging

Logs are written to:
- `logs/combined.log` - All logs
- `logs/error.log` - Error logs only
- Console - Development mode

Log levels: `error`, `warn`, `info`, `debug`

## 🚨 Error Handling

The API returns consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error info (development only)"
}
```

HTTP Status Codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Run linting and tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Review the API endpoints above

## 🔄 API Versioning

Current API version: `v1`

All endpoints are prefixed with `/api/v1` and version information is included in headers.

---

**Happy coding! 🚀** 