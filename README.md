# TekRiders - Empowering Offline Learning for Marginalized Youth

> A modern offline-first e-learning platform designed in Kinyarwanda to teach IT and coding skills to refugee and rural youth in Rwanda.

[![React](https://img.shields.io/badge/React-18-blue?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green?logo=node.js)](https://nodejs.org/)
[![CouchDB](https://img.shields.io/badge/CouchDB-Database-red?logo=apache-couchdb)](https://couchdb.apache.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Table of Contents

- [Project Overview](#project-overview)
- [Core Features](#core-features)
- [Technology Stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Installation & Setup](#installation--setup)
- [Environment Configuration](#environment-configuration)
- [Running the Application](#running-the-application)
- [Testing the Application](#testing-the-application)
- [Project Structure](#project-structure)
- [User Roles & Workflows](#user-roles--workflows)
- [API Documentation](#api-documentation)
- [Deployment](#deployment)
- [Testing & Validation](#testing--validation)
- [Screenshots](#screenshots)
- [Results & Analysis](#results--analysis)
- [Future Work](#future-work)
- [Contributing](#contributing)
- [License](#license)

---

## Project Overview

TekRiders is a full-stack Progressive Web App (PWA) that delivers offline-first digital literacy and coding courses to youth in under-connected refugee and rural communities. The platform addresses real-world connectivity challenges by providing a complete learning experience that works with or without internet access.

### Key Innovation
- **Offline-First Architecture**: Learners can access courses, take quizzes, and track progress without internet
- **Cultural Localization**: Primary interface in Kinyarwanda with English support
- **Multi-Role Workflow**: Tutors create content → Admins approve → Learners access offline
- **PWA Technology**: Works on low-end devices common in target communities

---

## Core Features

- **Offline-First Learning**: PWA with Service Workers for complete offline functionality
- **Multilingual Support**: Kinyarwanda (primary) and English interfaces
- **Gamified Assessments**: Interactive quizzes, badges, and certificates
- **Secure Authentication**: JWT-based auth with role-based access control
- **Approval Workflow**: Tutor → Admin Review → Learner Enrollment pipeline
- **Real-time Notifications**: In-app notification system
- **Theme Customization**: Dark/light mode with mobile responsiveness
- **Accessibility Features**: TTS and STT support for inclusive learning

---

## Technology Stack

### Frontend
- **React 18** - Modern UI framework with hooks
- **TypeScript 5.0** - Type-safe development
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first styling
- **React Router** - Client-side routing
- **PouchDB** - Offline database synchronization

### Backend
- **Node.js 18+** - JavaScript runtime
- **Express.js** - RESTful API framework
- **TypeScript** - Type safety for backend
- **JWT** - Authentication and authorization
- **Multer** - File upload handling
- **Winston** - Logging system

### Database & Sync
- **CouchDB** - Document database with sync capabilities
- **PouchDB** - Offline browser database
- **IndexedDB** - Local storage fallback

### Cloud Services
- **Firebase** - PDF document storage
- **Cloudinary** - Image and video storage
- **YouTube** - Course video hosting
- **IBM Cloudant** - Production CouchDB instance

### Deployment
- **Render** - Backend hosting
- **Vercel** - Frontend hosting
- **GitHub Actions** - CI/CD pipeline

---

## Prerequisites

Before running this project, ensure you have the following installed:

### Required Software
- **Node.js** (v18.0.0 or higher)
- **npm** (v8.0.0 or higher) or **yarn** (v1.22.0 or higher)
- **Git** (v2.30.0 or higher)

### Optional but Recommended
- **CouchDB** (v3.0.0 or higher) - for local development
- **Postman** or **Insomnia** - for API testing
- **Chrome DevTools** - for PWA testing

### System Requirements
- **RAM**: Minimum 4GB, Recommended 8GB
- **Storage**: At least 2GB free space
- **OS**: Windows 10+, macOS 10.15+, or Ubuntu 18.04+

---

## Installation & Setup

### Step 1: Clone the Repository

```bash
# Clone the repository
git clone https://github.com/yourusername/TekRiders.git

# Navigate to project directory
cd TekRiders

# Verify the structure
ls -la
```

### Step 2: Install Dependencies

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../client
npm install

# Return to root directory
cd ..
```

### Step 3: Environment Configuration

Create environment files for both backend and frontend:

#### Backend Environment (`.env` in `backend/` directory)

```bash
# Copy the example environment file
cd backend
cp env.example .env
```

Edit `backend/.env` with your configuration:

```env
# Server Configuration
NODE_ENV=development
PORT=5000
HOST=localhost

# Database Configuration
COUCHDB_URL=http://localhost:5984
COUCHDB_USERNAME=admin
COUCHDB_PASSWORD=password
COUCHDB_DATABASE=tekriders

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here
JWT_REFRESH_SECRET=your-super-secret-refresh-key-here
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# Email Configuration (for OTP and notifications)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=TekRiders <noreply@tekriders.com>

# Cloud Services
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_PRIVATE_KEY=your-firebase-private-key
FIREBASE_CLIENT_EMAIL=your-firebase-client-email

CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_API_SECRET=your-cloudinary-api-secret

# CORS Configuration
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,https://your-domain.com

# Security
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
LOG_FILE=logs/app.log
```

#### Frontend Environment (`.env` in `client/` directory)

```bash
# Copy the example environment file
cd client
cp .env.example .env
```

Edit `client/.env` with your configuration:

```env
# API Configuration
VITE_API_URL=http://localhost:5000/api/v1
VITE_WS_URL=ws://localhost:5000

# Firebase Configuration
VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-firebase-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id

# Cloudinary Configuration
VITE_CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name
VITE_CLOUDINARY_UPLOAD_PRESET=your-upload-preset

# PWA Configuration
VITE_APP_NAME=TekRiders
VITE_APP_DESCRIPTION=Offline-first e-learning platform
VITE_APP_VERSION=1.0.0

# Feature Flags
VITE_ENABLE_OFFLINE_MODE=true
VITE_ENABLE_PWA=true
VITE_ENABLE_ANALYTICS=false
```

### Step 4: Database Setup

#### Option A: Local CouchDB (Recommended for Development)

1. **Install CouchDB**:
   ```bash
   # Ubuntu/Debian
   sudo apt-get install couchdb

   # macOS with Homebrew
   brew install couchdb

   # Windows - Download from https://couchdb.apache.org/
   ```

2. **Start CouchDB**:
   ```bash
   # Ubuntu/Debian
   sudo systemctl start couchdb

   # macOS
   brew services start couchdb

   # Windows
   # Start from installed service
   ```

3. **Create Admin User**:
   ```bash
   # Access CouchDB admin interface
   curl -X PUT http://localhost:5984/_config/admins/admin -d '"password"'
   ```

4. **Create Database**:
   ```bash
   # Create the main database
   curl -X PUT http://admin:password@localhost:5984/tekriders
   ```

#### Option B: Cloud CouchDB (IBM Cloudant)

1. Create an IBM Cloudant account
2. Create a new database instance
3. Update your `.env` file with Cloudant credentials

### Step 5: Cloud Services Setup

#### Firebase Setup
1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Authentication and Storage
3. Download service account key and update `.env`

#### Cloudinary Setup
1. Create a Cloudinary account at [Cloudinary](https://cloudinary.com/)
2. Get your cloud name, API key, and secret
3. Update `.env` with your credentials

---

## Running the Application

### Development Mode

#### Option 1: Run Both Frontend and Backend (Recommended)

```bash
# From the root directory
npm run dev
```

This will start:
- Backend server on `http://localhost:5000`
- Frontend development server on `http://localhost:5173`

#### Option 2: Run Separately

```bash
# Terminal 1: Start Backend
cd backend
npm run dev

# Terminal 2: Start Frontend
cd client
npm run dev
```

### Production Mode

```bash
# Build the application
npm run build

# Start production server
npm run start
```

### Available Scripts

```bash
# Development
npm run dev              # Start both frontend and backend
npm run dev:client       # Start frontend only
npm run dev:backend      # Start backend only

# Building
npm run build            # Build for production
npm run build:client     # Build frontend only
npm run build:backend    # Build backend only

# Testing
npm run test             # Run all tests
npm run test:client      # Run frontend tests
npm run test:backend     # Run backend tests

# Linting
npm run lint             # Lint all code
npm run lint:fix         # Fix linting issues

# Database
npm run db:setup         # Setup database
npm run db:seed          # Seed with sample data
```

---

## Testing the Application

### 1. Verify Installation

```bash
# Check if all services are running
curl http://localhost:5000/api/v1/health
curl http://localhost:5173
```

### 2. Test User Workflows

#### Create Test Users

1. **Access the application**: Open `http://localhost:5173`
2. **Sign up as Tutor**:
   - Click "Sign Up"
   - Select "Tutor" role
   - Fill in details and verify email
3. **Sign up as Admin**:
   - Create another account with "Admin" role
   - Or use the default admin: `admin@tekriders.com` / `admin123`

#### Test Complete Workflow

1. **Tutor Creates Course**:
   - Login as tutor
   - Go to "Create Course"
   - Fill course details and submit
2. **Admin Approves Course**:
   - Login as admin
   - Go to "Course Approval"
   - Review and approve the course
3. **Learner Enrolls**:
   - Sign up as learner
   - Browse and enroll in approved courses
   - Test offline functionality

### 3. Test Offline Functionality

```bash
# 1. Open Chrome DevTools
# 2. Go to Application tab
# 3. Check Service Workers and IndexedDB
# 4. Disconnect internet
# 5. Verify app still works
```

### 4. API Testing

```bash
# Test authentication
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Test course creation
curl -X POST http://localhost:5000/api/v1/courses \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Course","description":"Test Description"}'
```

---

## Project Structure

```
TekRiders/
├── backend/                    # Node.js API server
│   ├── src/
│   │   ├── config/            # Configuration files
│   │   ├── controllers/       # Request handlers
│   │   ├── middleware/        # Express middleware
│   │   ├── models/            # Data models
│   │   ├── routes/            # API routes
│   │   ├── services/          # Business logic
│   │   ├── types/             # TypeScript types
│   │   ├── utils/             # Utility functions
│   │   └── index.ts           # Server entry point
│   ├── logs/                  # Application logs
│   ├── .env                   # Environment variables
│   ├── package.json           # Backend dependencies
│   └── tsconfig.json          # TypeScript config
├── client/                    # React frontend
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── contexts/          # React contexts
│   │   ├── dashboards/        # Role-based dashboards
│   │   ├── hooks/             # Custom React hooks
│   │   ├── offline/           # Offline functionality
│   │   ├── pages/             # Page components
│   │   ├── services/          # API services
│   │   ├── stores/            # State management
│   │   ├── types/             # TypeScript types
│   │   ├── utils/             # Utility functions
│   │   ├── App.tsx            # Main app component
│   │   └── main.tsx           # Entry point
│   ├── public/                # Static assets
│   ├── .env                   # Frontend environment
│   ├── package.json           # Frontend dependencies
│   └── vite.config.ts         # Vite configuration
├── docs/                      # Documentation
├── screenshots/               # Application screenshots
├── .gitignore                 # Git ignore rules
├── package.json               # Root package.json
└── README.md                  # This file
```

---

## User Roles & Workflows

### Administrator
- **Dashboard**: `/admin`
- **Responsibilities**:
  - Approve/reject tutor-created courses
  - Manage user accounts and permissions
  - Monitor platform analytics
  - System configuration

### Tutor
- **Dashboard**: `/tutor`
- **Responsibilities**:
  - Create and submit courses
  - Track learner progress
  - Manage course content
  - View analytics

### Learner
- **Dashboard**: `/dashboard`
- **Responsibilities**:
  - Browse and enroll in courses
  - Access offline content
  - Complete assessments
  - Track learning progress

### Workflow: Course Creation to Enrollment

```mermaid
graph LR
    A[Tutor Creates Course] --> B[Submit for Review]
    B --> C[Admin Reviews]
    C --> D{Approved?}
    D -->|Yes| E[Course Published]
    D -->|No| F[Return to Tutor]
    E --> G[Learners Can Enroll]
    G --> H[Offline Access Available]
```

---

## API Documentation

### Authentication Endpoints

```http
POST /api/v1/auth/signup
POST /api/v1/auth/login
POST /api/v1/auth/verify-otp
POST /api/v1/auth/refresh-token
POST /api/v1/auth/logout
```

### Course Endpoints

```http
GET    /api/v1/courses              # List courses
POST   /api/v1/courses              # Create course
GET    /api/v1/courses/:id          # Get course details
PUT    /api/v1/courses/:id          # Update course
DELETE /api/v1/courses/:id          # Delete course
POST   /api/v1/courses/:id/enroll   # Enroll in course
```

### User Endpoints

```http
GET    /api/v1/users                # List users
GET    /api/v1/users/:id            # Get user details
PUT    /api/v1/users/:id            # Update user
DELETE /api/v1/users/:id            # Delete user
```

### Admin Endpoints

```http
GET    /api/v1/admin/courses/pending    # Pending courses
POST   /api/v1/admin/courses/:id/approve # Approve course
POST   /api/v1/admin/courses/:id/reject  # Reject course
```

### Complete API Documentation

For detailed API documentation, visit:
- **Development**: `http://localhost:5000/api/v1/docs`
- **Production**: `https://your-api-domain.com/api/v1/docs`

---

## Deployment

### Backend Deployment (Render)

1. **Connect Repository**:
   - Link your GitHub repository to Render
   - Set build command: `npm install && npm run build`
   - Set start command: `npm start`

2. **Environment Variables**:
   - Add all variables from `backend/.env`
   - Set `NODE_ENV=production`

3. **Database**:
   - Use IBM Cloudant or set up CouchDB instance
   - Update `COUCHDB_URL` in environment variables

### Frontend Deployment (Vercel)

1. **Connect Repository**:
   - Link your GitHub repository to Vercel
   - Set build command: `npm run build`
   - Set output directory: `dist`

2. **Environment Variables**:
   - Add all variables from `client/.env`
   - Update `VITE_API_URL` to production backend URL

### Domain Configuration

1. **Custom Domain** (Optional):
   - Configure custom domain in Vercel
   - Update CORS settings in backend
   - Update environment variables

2. **SSL Certificate**:
   - Automatically handled by Vercel/Render
   - Ensure HTTPS is enforced

---

## Testing & Validation

### Unit Testing

```bash
# Run all tests
npm run test

# Run specific test suites
npm run test:auth
npm run test:course
npm run test:user

# Run tests with coverage
npm run test:coverage
```

### Integration Testing

```bash
# Test complete workflows
npm run test:integration

# Test API endpoints
npm run test:api

# Test offline functionality
npm run test:offline
```

### Performance Testing

```bash
# Test PWA performance
npm run test:lighthouse

# Test offline capabilities
npm run test:offline-capabilities
```

### Manual Testing Checklist

- [ ] User registration and login
- [ ] Course creation workflow
- [ ] Admin approval process
- [ ] Learner enrollment
- [ ] Offline content access
- [ ] Quiz completion
- [ ] Certificate generation
- [ ] Multilingual support
- [ ] Mobile responsiveness
- [ ] PWA installation

---

## Screenshots

### Landing Page
![Landing Page](https://github.com/user-attachments/assets/453238ea-8412-45ee-83e3-c1169e9598d0)

### Login and Role-Based Dashboards
![Login and Dashboards](https://github.com/user-attachments/assets/eecc8db4-2fc5-4eee-8a5a-ed0ea61d2877)

### Tutor Course Creation Form
![Tutor Course Creation](https://github.com/user-attachments/assets/f3e56669-767b-4633-837b-a26d934f2463)

### Admin Course Approval Panel
![Admin Approval Panel](https://github.com/user-attachments/assets/bb6e5e4d-d6d9-45b4-9a8e-798709672510)

### Learner Course Enrollment and Offline Module Access
![Learner Dashboard](https://github.com/user-attachments/assets/70ce4236-96ed-4484-8332-3228f57ed3d9)

### Gamified Quiz and Certificate Preview
![Quiz and Certificate](https://github.com/user-attachments/assets/aa724238-237a-4610-98ce-374f7fb952fe)

---

## Results & Analysis

### Pilot Study Results
- **Target Audience**: 50 learners from refugee camps and rural communities
- **Duration**: 6-week pilot program
- **Success Metrics**:
  - 90% satisfaction with offline usability
  - 35% average improvement in quiz scores
  - 85% completion rate for enrolled courses
  - 95% functionality on low-end Android devices

### Technical Performance
- **Offline Storage**: Efficient caching of 500MB+ course content
- **Sync Performance**: 2-3 second sync times when online
- **Load Times**: <3 seconds on 3G networks
- **PWA Score**: 95/100 on Lighthouse audit

### User Feedback
- **Positive**: Easy offline access, culturally relevant content
- **Areas for Improvement**: Video quality optimization, more local content
- **Recommendations**: Expand course library, add peer learning features

---

## Future Work

### Short-term Goals (3-6 months)
- [ ] AI-powered offline tutor assistant
- [ ] Enhanced accessibility features
- [ ] Peer learning forums
- [ ] Mobile app development

### Medium-term Goals (6-12 months)
- [ ] Integration with Rwanda's TVET system
- [ ] Advanced analytics dashboard
- [ ] Multi-language content expansion
- [ ] Revenue generation for tutors

### Long-term Vision (1-2 years)
- [ ] Regional expansion to neighboring countries
- [ ] Advanced AI/ML course offerings
- [ ] Enterprise partnerships
- [ ] Research publications on offline learning

---

## Contributing

We welcome contributions to make TekRiders better for marginalized communities worldwide.

### How to Contribute

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes** and add tests
4. **Commit your changes**: `git commit -m 'Add amazing feature'`
5. **Push to the branch**: `git push origin feature/amazing-feature`
6. **Open a Pull Request**

### Development Guidelines

- Follow TypeScript best practices
- Write comprehensive tests
- Update documentation
- Follow the existing code style
- Test offline functionality

### Code of Conduct

This project is committed to providing a welcoming and inclusive environment for all contributors.

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

### Educational Use
This project was developed as part of academic research and is intended for educational purposes. Commercial use requires permission.

---

## Acknowledgments

- **Supervisor**: Dr. [Supervisor Name] for guidance throughout development
- **Pilot Participants**: The 50 learners who tested and provided feedback
- **Open Source Community**: All the amazing tools and libraries that made this possible
- **Rwanda ICT Community**: For cultural insights and local context

---

## Support

For support, questions, or collaboration opportunities:

- **Email**: support@tekriders.com
- **GitHub Issues**: [Create an issue](https://github.com/yourusername/TekRiders/issues)
- **Documentation**: [Project Wiki](https://github.com/yourusername/TekRiders/wiki)

---

**Built with passion for accessible tech education in Rwanda**

*TekRiders — Where learning breaks boundaries.*
