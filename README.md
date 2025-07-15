# TekRiderz E-Learning Platform 🎓

A modern, full-stack e-learning platform built with React, TypeScript, Node.js, and CouchDB. TekRiderz provides a comprehensive online learning experience with course management, progress tracking, automated certificate generation, and role-based access control.

## 🌟 Features

### For Learners
- **Course Enrollment & Progress Tracking** - Enroll in courses and track your learning journey
- **Interactive Learning Experience** - Video lessons, quizzes, and interactive content
- **Automated Certificate Generation** - Beautiful PDF certificates with QR code verification
- **Personal Dashboard** - Track progress, achievements, and learning statistics
- **Multi-language Support** - Available in English and Kinyarwanda
- **Offline PWA Support** - Continue learning even without internet connection

### For Instructors/Tutors
- **Course Creation & Management** - Create rich, multimedia courses
- **Student Progress Monitoring** - Track learner engagement and completion
- **Quiz & Assessment Tools** - Create interactive assessments with auto-grading
- **Content Upload & Organization** - Upload videos, documents, and course materials
- **Analytics Dashboard** - Detailed insights into course performance

### For Administrators
- **User Management** - Manage learners, instructors, and system users
- **Course Moderation** - Review and approve course content
- **System Analytics** - Platform-wide statistics and reporting
- **Certificate Management** - Oversee certificate generation and verification

## 🛠 Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for responsive, modern UI
- **React Router** for navigation
- **PWA Support** with service workers
- **Framer Motion** for animations

### Backend
- **Node.js** with Express.js
- **TypeScript** for type safety
- **CouchDB** for document-based storage
- **JWT Authentication** with refresh tokens
- **PDFKit** for certificate generation
- **Nodemailer** for email services
- **Winston** for logging

### Additional Tools
- **QR Code** generation for certificate verification
- **Sharp** for image processing
- **Multer** for file uploads
- **Helmet** for security headers
- **Rate Limiting** for API protection

## 📋 Prerequisites

Before setting up TekRiderz, ensure you have the following installed:

- **Node.js** (v16.0.0 or higher)
- **npm** or **yarn** package manager
- **CouchDB** (v3.0 or higher)
- **Git** for version control

### System Requirements
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 2GB free space
- **OS**: Windows 10+, macOS 10.14+, or Linux

## 🚀 Quick Start

### Automated Setup (Recommended)

For the fastest setup experience, use the automated setup script:

```bash
# Clone the repository
git clone https://github.com/yourusername/TekRiderz.git
cd TekRiderz

# Make the setup script executable
chmod +x setup.sh

# Run the automated setup
./setup.sh
```

The script will:
- ✅ Check prerequisites (Node.js, npm, Git, CouchDB)
- ✅ Install all dependencies
- ✅ Create environment files from examples
- ✅ Set up directory structure
- ✅ Initialize database (if scripts exist)
- ✅ Build the application
- ✅ Provide next steps

### Manual Setup

If you prefer manual setup or the script doesn't work on your system:

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/TekRiderz.git
cd TekRiderz
```

### 2. Install Dependencies

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../client
npm install
```

### 3. Database Setup

#### Install CouchDB

**macOS (using Homebrew):**
```bash
brew install couchdb
brew services start couchdb
```

**Ubuntu/Debian:**
```bash
sudo apt-get install couchdb
sudo systemctl start couchdb
sudo systemctl enable couchdb
```

**Windows:**
- Download from [Apache CouchDB](https://couchdb.apache.org/)
- Follow the installation wizard
- Start the CouchDB service

#### Configure CouchDB
1. Open CouchDB admin interface: `http://localhost:5984/_utils/`
2. Create an admin user
3. Note down the credentials for environment configuration

### 4. Environment Configuration

#### Backend Environment Setup

Create `backend/.env` file:

```bash
cd backend
cp env.example .env
```

Edit `backend/.env` with your configuration:

```env
# Server Configuration
PORT=3000
NODE_ENV=development
API_URL=http://localhost:3000
FRONTEND_URL=http://localhost:5173

# Database Configuration
COUCHDB_URL=http://localhost:5984
COUCHDB_USERNAME=your_admin_username
COUCHDB_PASSWORD=your_admin_password
COUCHDB_NAME=tekriders

# JWT Configuration
JWT_SECRET=your-super-secure-jwt-secret-key-here
JWT_REFRESH_SECRET=your-refresh-secret-key-here
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Email Configuration (for OTP and notifications)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=true
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
FROM_EMAIL=noreply@tekriders.com
FROM_NAME=TekRiders Team

# Security
BCRYPT_ROUNDS=12
COOKIE_SECRET=your-cookie-secret-here
SESSION_SECRET=your-session-secret-here

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

#### Frontend Environment Setup

Create `client/.env` file:

```bash
cd client
cp env.example .env
```

Edit `client/.env`:

```env
VITE_API_URL=http://localhost:3000
VITE_APP_NAME=TekRiderz
VITE_NODE_ENV=development
```

### 5. Database Initialization

Set up the database structure:

```bash
cd backend
npm run setup-db
```

### 6. Start the Application

#### Development Mode

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd client
npm run dev
```

#### Production Mode

```bash
# Build and start backend
cd backend
npm run build
npm start

# Build and serve frontend
cd client
npm run build
npm run preview
```

### 7. Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **API Documentation**: http://localhost:3000/api/v1/docs
- **CouchDB Admin**: http://localhost:5984/_utils/

## 📁 Project Structure

```
TekRiderz/
├── backend/                    # Node.js/Express backend
│   ├── src/
│   │   ├── config/            # Database and app configuration
│   │   ├── controllers/       # Request handlers
│   │   ├── middleware/        # Authentication, validation, etc.
│   │   ├── models/           # Data models and database logic
│   │   ├── routes/           # API routes
│   │   ├── services/         # Business logic services
│   │   ├── utils/            # Utility functions
│   │   └── types/            # TypeScript type definitions
│   ├── uploads/              # File upload directory (git-ignored)
│   ├── logs/                 # Application logs (git-ignored)
│   └── package.json
├── client/                    # React frontend
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   ├── contexts/         # React contexts (Auth, Theme, etc.)
│   │   ├── dashboards/       # Role-specific dashboards
│   │   ├── hooks/            # Custom React hooks
│   │   ├── pages/            # Main application pages
│   │   ├── stores/           # State management
│   │   ├── types/            # TypeScript types
│   │   └── utils/            # Utility functions
│   ├── public/               # Static assets
│   └── package.json
├── .gitignore                # Git ignore rules
├── package.json              # Root package.json
└── README.md                 # This file
```

## 🔧 Development

### Available Scripts

#### Backend
```bash
npm run dev          # Start development server with nodemon
npm run build        # Build TypeScript to JavaScript
npm start           # Start production server
npm test            # Run tests
npm run lint        # Run ESLint
npm run setup-db    # Initialize database
```

#### Frontend
```bash
npm run dev         # Start development server
npm run build       # Build for production
npm run preview     # Preview production build
npm run lint        # Run ESLint
npm test           # Run tests
```

### Code Style

The project uses:
- **ESLint** for code linting
- **Prettier** for code formatting
- **TypeScript** for type checking
- **Husky** for git hooks (if configured)

## 🎯 Default User Accounts

For testing purposes, the system creates default accounts:

### Administrator
- **Email**: admin@tekriders.com
- **Password**: admin123
- **Role**: Admin

### Instructor
- **Email**: instructor@tekriders.com
- **Password**: instructor123
- **Role**: Tutor

### Learner
- **Email**: learner@tekriders.com
- **Password**: learner123
- **Role**: Learner

**⚠️ Important**: Change these default passwords in production!

## 🔐 Security Features

- **JWT Authentication** with refresh tokens
- **Rate Limiting** to prevent abuse
- **Input Validation** and sanitization
- **CORS Protection** with configurable origins
- **Helmet.js** for security headers
- **File Upload Validation** with type and size restrictions
- **SQL Injection Protection** (via parameterized queries)
- **XSS Protection** with content sanitization

## 🌍 Multi-language Support

TekRiderz supports multiple languages:
- **English** (default)
- **Kinyarwanda** (rw)

To add a new language:
1. Create translation files in `client/src/locales/`
2. Update the `LanguageContext` provider
3. Add language selection in the UI

## 📱 PWA Features

The platform includes Progressive Web App capabilities:
- **Offline Support** - Continue learning without internet
- **Service Worker** for caching and background sync
- **Installable** - Add to home screen on mobile devices
- **Push Notifications** - Get notified about course updates
- **Background Sync** - Sync data when connection is restored

## 📊 Monitoring & Analytics

### Logging
- **Winston** for structured logging
- **Log Levels**: error, warn, info, debug
- **Log Files**: 
  - `logs/error.log` - Error logs only
  - `logs/combined.log` - All logs
  - Console output in development

### Analytics
- **User Engagement** tracking
- **Course Performance** metrics
- **Learning Progress** analytics
- **Certificate Generation** statistics

## 🧪 Testing

### Backend Testing
```bash
cd backend
npm test                # Run all tests
npm run test:watch      # Watch mode
npm run test:coverage   # Coverage report
```

### Frontend Testing
```bash
cd client
npm test                # Run all tests
npm run test:ui         # Test UI with Vitest
npm run test:coverage   # Coverage report
```

### E2E Testing
```bash
# If Cypress is configured
npm run test:e2e        # Run end-to-end tests
```

## 🚀 Deployment

### Environment Setup
1. Set `NODE_ENV=production`
2. Configure production database
3. Set secure JWT secrets
4. Configure production email service
5. Set up SSL certificates

### Database Migration
```bash
# Production database setup
npm run setup-db:prod
```

### Docker Deployment (Optional)
```bash
# Build containers
docker-compose build

# Start services
docker-compose up -d

# View logs
docker-compose logs -f
```

### PM2 Process Manager
```bash
# Install PM2 globally
npm install -g pm2

# Start application
pm2 start ecosystem.config.js

# Monitor
pm2 monit

# Auto-restart on system reboot
pm2 startup
pm2 save
```

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add some amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Development Guidelines
- Follow the existing code style
- Write tests for new features
- Update documentation as needed
- Ensure all tests pass before submitting

## 📝 API Documentation

The API documentation is available at:
- **Development**: http://localhost:3000/api/v1/docs
- **Production**: https://your-domain.com/api/v1/docs

### Key API Endpoints
- **Authentication**: `/api/v1/auth/*`
- **Users**: `/api/v1/users/*`
- **Courses**: `/api/v1/courses/*`
- **Certificates**: `/api/v1/certificates/*`
- **Admin**: `/api/v1/admin/*`

## 🔧 Troubleshooting

### Common Issues

#### Database Connection Issues
```bash
# Check CouchDB status
curl http://localhost:5984/

# Restart CouchDB
sudo systemctl restart couchdb
```

#### Port Already in Use
```bash
# Kill process using port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 npm run dev
```

#### File Upload Issues
- Check `backend/uploads/` directory permissions
- Verify file size limits in configuration
- Ensure correct MIME types are allowed

#### Certificate Generation Issues
- Verify PDFKit installation
- Check file permissions in uploads directory
- Ensure QR code generation is working

### Getting Help
- **Issues**: Report bugs via GitHub Issues
- **Discussions**: Join GitHub Discussions
- **Documentation**: Check the `/docs` folder
- **Email**: support@tekriders.com

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Apache CouchDB** for the document database
- **React Team** for the amazing frontend framework
- **Node.js Community** for the backend ecosystem
- **Tailwind CSS** for the beautiful UI framework
- **All Contributors** who helped build this platform

## 📞 Support

For support and questions:
- **Email**: support@tekriders.com
- **GitHub Issues**: [Report a bug](https://github.com/yourusername/TekRiderz/issues)
- **Documentation**: [Project Wiki](https://github.com/yourusername/TekRiderz/wiki)

---

**Happy Learning! 🎓✨**

Built with ❤️ by the TekRiderz Team 