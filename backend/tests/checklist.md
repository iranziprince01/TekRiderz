# API Endpoint Testing Checklist

## Authentication Endpoints

### User Registration & Login
- [ ] **POST /auth/register** - User registration
  - [ ] Valid user data creates account
  - [ ] Duplicate email returns error
  - [ ] Invalid data returns validation errors
  - [ ] Password hashing works correctly

- [ ] **POST /auth/login** - User login
  - [ ] Valid credentials return JWT token
  - [ ] Invalid credentials return error
  - [ ] Token contains correct user data

- [ ] **POST /auth/forgot-password** - Password reset
  - [ ] Valid email sends OTP
  - [ ] Invalid email returns error
  - [ ] OTP is stored in database

- [ ] **POST /auth/verify-otp** - OTP verification
  - [ ] Valid OTP allows password reset
  - [ ] Invalid OTP returns error
  - [ ] Expired OTP returns error

- [ ] **POST /auth/reset-password** - Password reset
  - [ ] Valid token allows password change
  - [ ] Invalid token returns error
  - [ ] New password is hashed correctly

## Course Management Endpoints

### Course Creation & Management
- [ ] **POST /courses** - Create course (Tutor only)
  - [ ] Valid course data creates course
  - [ ] Invalid data returns validation errors
  - [ ] Course status is "draft" initially
  - [ ] File uploads work correctly

- [ ] **GET /courses** - Get all courses
  - [ ] Returns courses with enrollment status
  - [ ] Filters work correctly
  - [ ] Pagination works
  - [ ] Search functionality works

- [ ] **GET /courses/:id** - Get single course
  - [ ] Returns course details
  - [ ] Includes enrollment status
  - [ ] Includes progress data
  - [ ] Handles non-existent course

- [ ] **PUT /courses/:id** - Update course (Tutor only)
  - [ ] Valid updates work
  - [ ] Invalid data returns errors
  - [ ] File updates work
  - [ ] Status transitions work

- [ ] **DELETE /courses/:id** - Delete course (Admin only)
  - [ ] Course is deleted
  - [ ] Related enrollments are cleaned up
  - [ ] Related progress is cleaned up
  - [ ] Files are cleaned up

### Course Approval Workflow
- [ ] **POST /courses/:id/submit** - Submit for approval
  - [ ] Course status changes to "pending"
  - [ ] Admin notification is sent
  - [ ] Validation errors prevent submission

- [ ] **POST /courses/:id/approve** - Approve course (Admin only)
  - [ ] Course status changes to "published"
  - [ ] Notification sent to tutor
  - [ ] Course becomes available to learners

- [ ] **POST /courses/:id/reject** - Reject course (Admin only)
  - [ ] Course status changes to "rejected"
  - [ ] Rejection reason is stored
  - [ ] Notification sent to tutor

## Enrollment Endpoints

### Enrollment Management
- [ ] **POST /courses/:id/enroll** - Enroll in course
  - [ ] Creates enrollment record
  - [ ] Creates progress record
  - [ ] Returns enrollment data
  - [ ] Handles duplicate enrollment

- [ ] **GET /users/courses** - Get user's courses
  - [ ] Returns enrolled courses
  - [ ] Includes progress data
  - [ ] Sync parameter works
  - [ ] Progress calculation is accurate

- [ ] **DELETE /courses/:id/enroll** - Unenroll from course
  - [ ] Removes enrollment
  - [ ] Removes progress
  - [ ] Cleans up related data

## Progress Tracking Endpoints

### Progress Management
- [ ] **POST /progress/update** - Update progress
  - [ ] Progress is saved correctly
  - [ ] Completion status updates
  - [ ] Time tracking works
  - [ ] Progress calculation is accurate

- [ ] **GET /progress/:courseId** - Get course progress
  - [ ] Returns accurate progress data
  - [ ] Includes completion status
  - [ ] Time spent is correct
  - [ ] Lesson completion is tracked

- [ ] **POST /progress/sync** - Sync progress
  - [ ] Progress is synchronized
  - [ ] Completion status is updated
  - [ ] Analytics are calculated

## Assessment & Quiz Endpoints

### Quiz Management
- [ ] **POST /courses/:id/assessments** - Create assessment
  - [ ] Quiz is created correctly
  - [ ] Questions are stored
  - [ ] Correct answers are saved
  - [ ] Auto-grading is configured

- [ ] **POST /assessments/:id/submit** - Submit quiz
  - [ ] Answers are saved
  - [ ] Auto-grading works
  - [ ] Score is calculated
  - [ ] Results are stored

- [ ] **GET /assessments/:id/results** - Get quiz results
  - [ ] Returns correct results
  - [ ] Includes score and feedback
  - [ ] Shows correct/incorrect answers

## File Management Endpoints

### File Upload & Management
- [ ] **POST /upload/avatar** - Upload avatar
  - [ ] Image is uploaded to Cloudinary
  - [ ] URL is returned
  - [ ] File validation works
  - [ ] Error handling works

- [ ] **POST /upload/thumbnail** - Upload course thumbnail
  - [ ] Image is uploaded to Cloudinary
  - [ ] URL is returned
  - [ ] File validation works

- [ ] **POST /upload/pdf** - Upload PDF
  - [ ] PDF is uploaded to Firebase
  - [ ] URL is returned
  - [ ] File validation works
  - [ ] Access control works

- [ ] **GET /files/:id** - Get file URL
  - [ ] Returns correct file URL
  - [ ] Handles missing files
  - [ ] Access control works

## User Management Endpoints

### User Profile & Settings
- [ ] **GET /users/profile** - Get user profile
  - [ ] Returns user data
  - [ ] Includes avatar URL
  - [ ] Excludes sensitive data

- [ ] **PUT /users/profile** - Update profile
  - [ ] Profile updates work
  - [ ] Avatar updates work
  - [ ] Validation works

- [ ] **GET /users/courses** - Get user's courses
  - [ ] Returns enrolled courses
  - [ ] Includes progress
  - [ ] Filters work correctly

## Admin Endpoints

### Admin Management
- [ ] **GET /admin/courses** - Get all courses (Admin only)
  - [ ] Returns all courses
  - [ ] Includes approval status
  - [ ] Filters work correctly

- [ ] **GET /admin/users** - Get all users (Admin only)
  - [ ] Returns all users
  - [ ] Includes role information
  - [ ] Pagination works

- [ ] **POST /admin/courses/:id/approve** - Approve course
  - [ ] Course is approved
  - [ ] Status changes correctly
  - [ ] Notification is sent

- [ ] **POST /admin/courses/:id/reject** - Reject course
  - [ ] Course is rejected
  - [ ] Reason is stored
  - [ ] Notification is sent

## Cleanup & Maintenance Endpoints

### Data Cleanup
- [ ] **POST /cleanup/orphaned-data** - Clean orphaned data (Admin only)
  - [ ] Orphaned enrollments are removed
  - [ ] Orphaned progress is removed
  - [ ] Invalid file references are cleaned
  - [ ] Returns cleanup report

- [ ] **POST /cleanup/invalid-files** - Clean invalid files (Admin only)
  - [ ] Invalid file URLs are identified
  - [ ] Orphaned files are removed
  - [ ] Database references are updated

## Speech & Accessibility Endpoints

### Speech Services
- [ ] **POST /speech/text-to-speech** - Text to speech
  - [ ] Text is converted to speech
  - [ ] Audio file is returned
  - [ ] Error handling works

- [ ] **POST /speech/speech-to-text** - Speech to text
  - [ ] Audio is converted to text
  - [ ] Text is returned
  - [ ] Error handling works

## Error Handling & Validation

### General Error Handling
- [ ] **Authentication errors** - 401 responses
- [ ] **Authorization errors** - 403 responses
- [ ] **Validation errors** - 400 responses
- [ ] **Not found errors** - 404 responses
- [ ] **Server errors** - 500 responses

### Input Validation
- [ ] **Email validation** - Proper email format
- [ ] **Password validation** - Minimum requirements
- [ ] **File validation** - Size and type limits
- [ ] **Data validation** - Required fields

## Performance & Security

### Performance Testing
- [ ] **Response times** - Under 2 seconds
- [ ] **Database queries** - Optimized
- [ ] **File uploads** - Handle large files
- [ ] **Concurrent requests** - Handle load

### Security Testing
- [ ] **JWT validation** - Tokens are verified
- [ ] **Role-based access** - Proper permissions
- [ ] **Input sanitization** - XSS prevention
- [ ] **File upload security** - Malicious file prevention

## Integration Testing

### End-to-End Flows
- [ ] **User registration → Login → Dashboard**
- [ ] **Course creation → Submission → Approval → Publication**
- [ ] **Course enrollment → Progress tracking → Completion**
- [ ] **Quiz creation → Taking → Grading → Results**

### Data Consistency
- [ ] **ID consistency** - _id and id fields match
- [ ] **Referential integrity** - Related data is consistent
- [ ] **State transitions** - Status changes work correctly
- [ ] **Data cleanup** - Orphaned data is removed

## Browser Testing

### Frontend Integration
- [ ] **Course cards display correctly** - No red "US" circles
- [ ] **Enrollment flow works** - Enroll → Go To Course → Review
- [ ] **Progress updates in real-time** - UI reflects changes
- [ ] **File uploads work** - Images and PDFs upload correctly
- [ ] **Responsive design** - Works on mobile and desktop

### User Experience
- [ ] **Loading states** - Proper loading indicators
- [ ] **Error messages** - Clear and helpful
- [ ] **Success feedback** - Confirmation messages
- [ ] **Navigation** - Smooth transitions between pages

## Testing Instructions

### Manual Testing Steps
1. **Start the backend server**: `npm run dev`
2. **Start the frontend**: `cd ../client && npm run dev`
3. **Clear browser cache**: Hard refresh (Cmd+Shift+R)
4. **Test each endpoint** using Postman or browser
5. **Verify database changes** in CouchDB
6. **Check frontend integration** in browser

### Automated Testing (Future)
- [ ] **Unit tests** for individual functions
- [ ] **Integration tests** for API endpoints
- [ ] **E2E tests** for complete user flows
- [ ] **Performance tests** for load testing

## Notes
- Test with different user roles (Learner, Tutor, Admin)
- Test with various data scenarios (empty, invalid, large)
- Verify error handling and edge cases
- Check database consistency after operations
- Monitor server logs for errors
