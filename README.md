# TekRiders - Modern E-Learning Platform

A comprehensive e-learning platform built with React, TypeScript, and Node.js, featuring robust offline capabilities and PWA functionality.

## Recent Major Updates

### Offline & PWA System - COMPLETELY FIXED (Latest)

**ALL BLANK PAGE ISSUES RESOLVED** - The application now has bulletproof offline functionality:

#### **Fixed Issues:**
- **TypeError: Class extends value [object Object] constructor errors** → **RESOLVED**
- **PWA manifest icon 404 errors** → **RESOLVED** 
- **PouchDB import/export errors** → **RESOLVED**
- **Service worker conflicts** → **RESOLVED**
- **Unhandled promise rejections** → **RESOLVED**
- **Circular dependency issues** → **RESOLVED**

#### **Implemented Solutions:**

1. **Stable PouchDB Architecture**
   ```typescript
   // Production-ready PouchDB with CouchDB integration
   Dual-mode operation (Local IndexedDB + Remote CouchDB)
   Automatic fallback when CouchDB unavailable
   Live bidirectional sync with conflict resolution
   Type-safe TypeScript implementation
   ```

 2. **📱 Simplified Offline Manager**
    ```typescript
    // Clean, reliable storage strategy
    PouchDB (Primary) → IndexedDB (Secondary) → localStorage (Fallback)
    Consolidated architecture eliminates redundancy
    Clear fallback hierarchy with proper error handling
    Single source of truth prevents conflicts
    ```

3. **🔧 Simplified Service Worker**
   ```javascript
   // Robust caching strategy
   Network-first with cache fallback
   Proper error handling for all request types
   ackground sync capabilities
   No WebSocket conflicts in development
   ```

4. ** PWA Manifest & Icons**
   ```json
   // Complete PWA setup
   All icon sizes (16x16 to 512x512) available
   Correct paths (/icons/ directory)
   Proper shortcuts and file handlers
   Mobile app capabilities
   ```

5. **Global Error Boundaries**
   ```typescript
   // Comprehensive error handling
   React error boundaries for component crashes
   Global promise rejection handlers
   Service worker error isolation
   Offline-specific error recovery
   ```

#### **System Architecture:**

```mermaid
graph TB
    A[React App] --> B[Error Boundary]
    B --> C[Offline Manager]
    
    C --> D[PouchDB Manager]
    C --> E[IndexedDB Storage]
    C --> F[localStorage Fallback]
    
    D --> G[Local PouchDB]
    D --> H[Remote CouchDB]
    
    G -.->|Sync| H
    H -.->|Sync| G
    
    A --> I[Service Worker]
    I --> J[Cache Strategy]
    I --> K[Background Sync]
    
    style A fill:#e1f5fe
    style C fill:#f3e5f5
    style D fill:#e8f5e8
    style H fill:#fff3e0
```

#### **Testing Results:**
- **TypeScript Compilation:** Zero errors
- **Frontend Server:** Running perfectly on localhost:5173
- **PWA Manifest:** Loading correctly with all icons
- **Service Worker:** Registered and functioning
- **Error Boundaries:** No more blank pages
- **Console Logs:** Clean with proper initialization messages

### **Production Ready Features:**

**Offline-First Architecture**
- Course content caching
- Progress tracking offline
- User data synchronization
- Quiz submissions queuing

**Automatic Synchronization**
- Real-time sync when online
- Conflict resolution
- Retry mechanisms with exponential backoff
- Network status monitoring

**PWA Capabilities**
- Install prompts
- App shortcuts
- File handling
- Share targets
- Background sync

**Error Resilience**
- Multiple storage fallbacks
- Graceful degradation
- Recovery mechanisms
- User-friendly error messages

### **Academic Presentation Ready**
This implementation demonstrates:
- Industry-standard offline-first architecture
- Modern PWA development practices
- Robust error handling patterns
- Scalable data synchronization
- Professional code organization

## Features

### Core Learning Features
- Interactive course content with multimedia support
- Real-time progress tracking
- Quiz and assessment system
- Certificate generation
- Multi-language support (English/Kinyarwanda)

### Technical Features
- **Offline-First PWA**: Complete functionality without internet
- **Real-time Sync**: Automatic data synchronization
- **Responsive Design**: Works on all devices
- **Security**: JWT authentication, input validation
- **Performance**: Optimized loading, caching strategies

## Technology Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for development and building
- **Tailwind CSS** for styling
- **React Router** for navigation
- **Context API** for state management

### Backend
- **Node.js** with Express
- **TypeScript** for type safety
- **JWT** for authentication
- **Multer** for file uploads
- **Rate limiting** and security middleware

### Database & Storage
- **CouchDB** for primary data storage
- **PouchDB** for offline synchronization
- **IndexedDB** for client-side storage
- **localStorage** as ultimate fallback

### PWA & Offline
- **Service Workers** for caching and background sync
- **Web App Manifest** for native app experience
- **Background Sync API** for offline actions
- **Cache API** for resource management

## Installation

### Prerequisites
- Node.js 18+ and npm
- CouchDB (optional - app works without it)

### Setup
```bash
# Clone the repository
git clone <repository-url>
cd TekRiderz

# Install dependencies
npm install

# Setup environment variables
cp backend/env.example backend/.env
cp client/env.example client/.env

# Start development servers
npm run dev  # Starts both frontend and backend
```

### Environment Variables

**Backend (.env):**
```env
PORT=3000
JWT_SECRET=your-secret-key
COUCHDB_URL=http://localhost:5984
SMTP_HOST=your-smtp-host
SMTP_PORT=587
SMTP_USER=your-email
SMTP_PASS=your-password
```

**Client (.env):**
```env
VITE_API_URL=http://localhost:3000/api
VITE_ENABLE_SW=true
```

## Development

### Available Scripts

```bash
# Frontend development
npm run dev:client          # Start Vite dev server
npm run build:client        # Build for production
npm run preview:client      # Preview production build

# Backend development  
npm run dev:server          # Start backend with nodemon
npm run build:server        # Compile TypeScript
npm run start:server        # Start production server

# Combined
npm run dev                 # Start both frontend and backend
npm run build               # Build both for production
```

### Project Structure

```
TekRiderz/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Route components
│   │   ├── contexts/       # React contexts
│   │   ├── hooks/          # Custom hooks
│   │   ├── utils/          # Utility functions
│   │   └── types/          # TypeScript definitions
│   ├── public/             # Static assets
│   └── dist/               # Production build
├── backend/                # Node.js backend
│   ├── src/
│   │   ├── controllers/    # Route handlers
│   │   ├── middleware/     # Express middleware
│   │   ├── models/         # Data models
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   └── utils/          # Backend utilities
│   └── uploads/            # File uploads
└── docs/                   # Documentation
```

## API Documentation

### Authentication Endpoints
```
POST /api/auth/register     # User registration
POST /api/auth/login        # User login
POST /api/auth/verify-otp   # OTP verification
GET  /api/auth/me           # Get current user
POST /api/auth/refresh      # Refresh token
```

### Course Endpoints
```
GET    /api/courses         # Get all courses
GET    /api/courses/:id     # Get specific course
POST   /api/courses         # Create course (tutor/admin)
PUT    /api/courses/:id     # Update course
DELETE /api/courses/:id     # Delete course
```

### User Management
```
GET    /api/users/profile   # Get user profile
PUT    /api/users/profile   # Update profile
GET    /api/users/progress  # Get learning progress
POST   /api/users/progress  # Update progress
```

## Configuration

### Service Worker Configuration
The service worker automatically handles:
- Static asset caching
- API response caching
- Offline page fallbacks
- Background synchronization

### PouchDB Configuration
```typescript
// Automatic configuration
const config = {
  local: 'IndexedDB',           // Primary local storage
  remote: 'CouchDB',            // Optional remote sync
  fallback: 'localStorage'      // Ultimate fallback
};
```

## Testing

### Frontend Testing
```bash
cd client
npm run test                # Run tests
npm run test:coverage       # Coverage report
```

### Backend Testing
```bash
cd backend  
npm run test                # Run API tests
npm run test:integration    # Integration tests
```

## PWA Features

### Installation
- Automatic install prompts
- Add to home screen
- Full-screen experience

### Offline Capabilities
- Complete course access
- Progress tracking
- Quiz submissions
- User authentication

### Background Sync
- Automatic sync when online
- Retry failed requests
- Conflict resolution

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

If you encounter any issues:

1. Check the [Issues](https://github.com/your-repo/issues) page
2. Review the troubleshooting guide below
3. Create a new issue with detailed information

### Troubleshooting

**Blank Pages:**
- **RESOLVED** - All constructor and initialization issues fixed

**PWA Not Installing:**
- Ensure HTTPS or localhost
- Check manifest.json is accessible
- Verify service worker registration

**Offline Sync Issues:**
- Check browser console for errors
- Verify IndexedDB support
- Test network connectivity

---

**Ready for Academic Presentation & Production Use!**

The TekRiders platform now provides a robust, offline-first learning experience with industry-standard architecture and comprehensive error handling. 
