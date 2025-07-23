# Backend Testing Documentation

## Overview

This directory contains comprehensive tests for the TekRiders backend API. The tests are written using Jest and Supertest to ensure all endpoints work correctly and handle various scenarios properly.

## Test Structure

```
tests/
├── README.md              # This documentation file
├── checklist.md           # Comprehensive endpoint testing checklist
├── setup.ts              # Jest setup and configuration
├── simple.test.ts        # Basic functionality tests
├── auth.test.ts          # Authentication endpoint tests
└── course.test.ts        # Course management endpoint tests
```

## Test Categories

### 1. Simple Tests (`simple.test.ts`)
- **Purpose**: Verify basic Jest functionality and API structure
- **Coverage**: Basic operations, response structures, data validation
- **Status**: ✅ Working

### 2. Authentication Tests (`auth.test.ts`)
- **Purpose**: Test all authentication-related endpoints
- **Coverage**:
  - User registration
  - User login
  - Password reset flow
  - OTP verification
  - Profile management
  - Logout functionality
- **Status**: 🔧 In development (TypeScript issues to resolve)

### 3. Course Tests (`course.test.ts`)
- **Purpose**: Test all course management endpoints
- **Coverage**:
  - Course creation (Tutor only)
  - Course listing and filtering
  - Course updates and deletion
  - Course approval workflow
  - Enrollment management
  - Progress tracking
- **Status**: 🔧 In development (TypeScript issues to resolve)

## Running Tests

### Prerequisites
- Node.js 16+ installed
- All dependencies installed (`npm install`)
- Jest and testing dependencies installed

### Basic Test Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- tests/simple.test.ts

# Run tests with coverage
npm test -- --coverage

# Run tests with verbose output
npm test -- --verbose
```

### Test Environment Setup

The tests use a separate test environment with:
- Mocked external services (Firebase, Email, Database)
- Test-specific environment variables
- Isolated test data

## Test Configuration

### Jest Configuration (`jest.config.js`)
- **Preset**: `ts-jest` for TypeScript support
- **Environment**: Node.js
- **Coverage**: HTML, LCOV, and text reports
- **Timeout**: 30 seconds per test
- **Setup**: Uses `tests/setup.ts` for global configuration

### Test Setup (`tests/setup.ts`)
- Environment variable configuration
- External service mocking
- Global test timeout
- Console output suppression

## Mocked Services

### External Dependencies
- **Firebase**: Authentication and storage services
- **Email Service**: Password reset and notification emails
- **Database**: CouchDB operations (for isolated testing)

### Mock Behavior
- Firebase auth returns valid test tokens
- Email service always succeeds
- Database operations return predictable test data

## Test Data Management

### Test Users
- **Learner**: `test@example.com` / `TestPassword123!`
- **Tutor**: `tutor@example.com` / `TestPassword123!`
- **Admin**: `admin@example.com` / `TestPassword123!`

### Test Courses
- Sample course with modules and lessons
- Various statuses (draft, pending, published)
- Test enrollment and progress data

## API Response Validation

### Success Response Structure
```json
{
  "success": true,
  "data": { ... },
  "message": "Success message"
}
```

### Error Response Structure
```json
{
  "success": false,
  "message": "Error message",
  "errors": ["Field validation errors"]
}
```

## Testing Best Practices

### 1. Test Organization
- Group related tests using `describe` blocks
- Use descriptive test names with `it` blocks
- Follow AAA pattern (Arrange, Act, Assert)

### 2. Data Isolation
- Each test should be independent
- Clean up test data after tests
- Use unique identifiers for test data

### 3. Error Handling
- Test both success and failure scenarios
- Validate error response structures
- Test edge cases and boundary conditions

### 4. Authentication Testing
- Test with valid and invalid tokens
- Test role-based access control
- Test token expiration scenarios

## Current Issues and TODOs

### TypeScript Issues
- Jest type definitions need proper configuration
- Express route handler return types need fixing
- Mock function type definitions

### Test Coverage Gaps
- File upload endpoints
- Real-time features (WebSocket)
- Performance and load testing
- Integration tests with real database

### Future Enhancements
- E2E testing with real frontend
- Performance benchmarking
- Security testing (penetration tests)
- API documentation testing

## Debugging Tests

### Common Issues
1. **TypeScript Errors**: Check Jest configuration and type definitions
2. **Timeout Errors**: Increase test timeout in Jest config
3. **Mock Issues**: Verify mock setup in `setup.ts`
4. **Database Errors**: Ensure test database is properly mocked

### Debug Commands
```bash
# Run single test with debugging
npm test -- --verbose --testNamePattern="should register user"

# Run tests with Node.js debugging
node --inspect-brk node_modules/.bin/jest --runInBand

# Check test coverage
npm test -- --coverage --watchAll=false
```

## Continuous Integration

### GitHub Actions (Recommended)
```yaml
name: Backend Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '16'
      - run: npm ci
      - run: npm test
      - run: npm test -- --coverage
```

## Contributing to Tests

### Adding New Tests
1. Create test file in `tests/` directory
2. Follow naming convention: `*.test.ts`
3. Import required dependencies
4. Use existing mock setup
5. Add to test documentation

### Test Naming Convention
- File names: `feature.test.ts`
- Describe blocks: `Feature Name`
- Test cases: `should [expected behavior]`

### Code Coverage
- Aim for 80%+ code coverage
- Focus on critical business logic
- Test error handling paths
- Include edge cases

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [TypeScript Testing Guide](https://www.typescriptlang.org/docs/handbook/testing.html)
- [Express Testing Best Practices](https://expressjs.com/en/advanced/best-practices-performance.html#testing) 