# TekRiders - Modern E-Learning Platform

> A comprehensive e-learning platform designed for modern education needs, featuring intuitive course management, interactive learning experiences, and robust offline capabilities.

![React](https://img.shields.io/badge/React-18-blue?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)
![Node.js](https://img.shields.io/badge/Node.js-18+-green?logo=node.js)
![CouchDB](https://img.shields.io/badge/CouchDB-Database-red?logo=apache-couchdb)

## Project Overview

TekRiders is a full-stack e-learning platform that enables seamless knowledge sharing between instructors and learners. Built with modern web technologies, it provides a complete educational ecosystem with course creation, student enrollment, progress tracking, and certification features.

## Key Features

### **Learning Management**
- Interactive course creation with multimedia support
- Real-time progress tracking and analytics
- Comprehensive quiz and assessment system
- Automated certificate generation upon completion

### **User Management**
- Multi-role system (Admin, Tutor, Learner)
- Secure authentication and user profiles
- Role-based access control and permissions
- User activity monitoring and statistics

### **Modern Experience**
- Responsive design for all devices
- Progressive Web App (PWA) capabilities
- Offline learning functionality
- Multi-language support (English/Kinyarwanda)

### **Security & Performance**
- JWT-based authentication
- Data encryption and validation
- Optimized loading and caching
- Real-time data synchronization

## Technology Stack

### **Frontend**
- **React 18** - Modern UI library with hooks
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **Vite** - Fast development and building
- **React Router** - Client-side routing

### **Backend**
- **Node.js** - JavaScript runtime
- **Express.js** - Web application framework
- **TypeScript** - Server-side type safety
- **JWT** - Secure authentication
- **Multer** - File upload handling

### **Database & Storage**
- **CouchDB** - Primary document database
- **PouchDB** - Client-side synchronization
- **IndexedDB** - Browser-based storage
- **Real-time sync** - Automatic data synchronization

## Getting Started

### Prerequisites
- Node.js 18 or higher
- npm or yarn package manager
- CouchDB (optional for advanced features)

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd TekRiderz
   ```

2. **Install dependencies**
   ```bash
npm install
   ```

3. **Environment setup**
   ```bash
   # Copy environment templates
cp backend/env.example backend/.env
cp client/env.example client/.env
   ```

4. **Start development servers**
```bash
   npm run dev
   ```

The application will be available at:
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3000`

## User Roles

### **Administrator**
- Manage users and system settings
- Approve/reject course submissions
- Monitor platform analytics
- Control user permissions

### **Tutor/Instructor**
- Create and manage courses
- Design quizzes and assessments
- Track student progress
- Generate course analytics

### **Learner/Student**
- Browse and enroll in courses
- Complete lessons and assessments
- Track learning progress
- Earn certificates

## Project Structure

```
TekRiderz/
├── client/                 # React frontend application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Application pages
│   │   ├── dashboards/     # Role-specific dashboards
│   │   ├── contexts/       # React context providers
│   │   └── utils/          # Utility functions
│   └── public/             # Static assets
├── backend/                # Node.js backend application
│   ├── src/
│   │   ├── controllers/    # Request handlers
│   │   ├── models/         # Database models
│   │   ├── routes/         # API endpoints
│   │   ├── middleware/     # Express middleware
│   │   └── services/       # Business logic
│   └── uploads/            # File storage
└── docs/                   # Project documentation
```

## Development Commands

```bash
# Start development environment
npm run dev                 # Both frontend and backend

# Frontend only
npm run dev:client          # Start React development server
npm run build:client        # Build for production

# Backend only  
npm run dev:server          # Start Node.js development server
npm run build:server        # Compile TypeScript

# Production
npm run build               # Build both applications
npm run start               # Start production servers
```

## Core Functionality

### **Course Management**
- Rich content editor with multimedia support
- Structured lessons and modules
- Interactive quizzes and assessments
- Progress tracking and analytics

### **User Experience**
- Intuitive dashboard interfaces
- Real-time notifications
- Responsive mobile design
- Offline learning capabilities

### **Data Management**
- Secure user authentication
- Real-time data synchronization
- Automatic backup and recovery
- Performance optimization

## Progressive Web App

TekRiderz functions as a Progressive Web App, providing:
- **Offline Access** - Continue learning without internet
- **Mobile Installation** - Add to home screen like a native app
- **Background Sync** - Automatic data updates when online
- **Fast Loading** - Optimized performance and caching

## Security Features

- **Authentication** - Secure JWT-based login system
- **Authorization** - Role-based access control
- **Data Protection** - Encrypted data transmission
- **Input Validation** - Comprehensive server-side validation
- **Rate Limiting** - Protection against abuse

## Academic Project Goals

This project demonstrates proficiency in:
- Full-stack web development
- Modern JavaScript/TypeScript
- Database design and management
- User experience design
- Security best practices
- Performance optimization
- Progressive Web App development

## License

This project is developed as an academic project and is available under the MIT License.

## Contributing

This is an academic project. For educational purposes, please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

**Built with passion for modern education**

*TekRiders - Empowering knowledge through technology* 
