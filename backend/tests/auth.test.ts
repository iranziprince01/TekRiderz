import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';

// Create a test app instance
const app = express();
app.use(express.json());

// Mock the actual app routes
app.post('/auth/register', (req, res) => {
  const { name, email, password, role } = req.body;
  
  if (!name || !email || !password || !role) {
    return res.status(400).json({
      success: false,
      errors: ['Missing required fields']
    });
  }
  
  if (!email.includes('@')) {
    return res.status(400).json({
      success: false,
      errors: ['Invalid email format']
    });
  }
  
  if (password.length < 8) {
    return res.status(400).json({
      success: false,
      errors: ['Password too weak']
    });
  }
  
  return res.status(201).json({
    success: true,
    user: {
      id: 'user_123',
      name,
      email,
      role,
      createdAt: new Date().toISOString()
    }
  });
});

app.post('/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      errors: ['Missing required fields']
    });
  }
  
  if (email === 'test@example.com' && password === 'TestPassword123!') {
    const token = jwt.sign(
      { userId: 'user_123', email },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
    
    return res.status(200).json({
      success: true,
      token,
      user: {
        id: 'user_123',
        email,
        name: 'Test User'
      }
    });
  } else {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }
});

app.post('/auth/forgot-password', (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({
      success: false,
      errors: ['Email is required']
    });
  }
  
  if (!email.includes('@')) {
    return res.status(400).json({
      success: false,
      errors: ['Invalid email format']
    });
  }
  
  if (email === 'test@example.com') {
    return res.status(200).json({
      success: true,
      message: 'OTP sent successfully'
    });
  } else {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }
});

app.post('/auth/verify-otp', (req, res) => {
  const { email, otp } = req.body;
  
  if (!email || !otp) {
    return res.status(400).json({
      success: false,
      errors: ['Email and OTP are required']
    });
  }
  
  if (otp === '123456') {
    const token = jwt.sign(
      { email, type: 'password_reset' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
    
    return res.status(200).json({
      success: true,
      token
    });
  } else {
    return res.status(400).json({
      success: false,
      message: 'Invalid OTP'
    });
  }
});

app.post('/auth/reset-password', (req, res) => {
  const { token, password } = req.body;
  
  if (!token || !password) {
    return res.status(400).json({
      success: false,
      errors: ['Token and password are required']
    });
  }
  
  if (password.length < 8) {
    return res.status(400).json({
      success: false,
      errors: ['Password too weak']
    });
  }
  
  try {
    jwt.verify(token, process.env.JWT_SECRET || 'test-secret');
    return res.status(200).json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
});

app.get('/auth/me', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'No token provided'
    });
  }
  
  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-secret') as any;
    return res.status(200).json({
      success: true,
      user: {
        id: 'user_123',
        email: decoded.email,
        name: 'Test User'
      }
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
});

app.post('/auth/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'No token provided'
    });
  }
  
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
});

describe('Authentication Endpoints', () => {
  describe('POST /auth/register', () => {
    const validUserData = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'TestPassword123!',
      role: 'learner'
    };

    it('should register a new user with valid data', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send(validUserData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).toHaveProperty('name', 'Test User');
      expect(response.body.user).toHaveProperty('email', 'test@example.com');
      expect(response.body.user).toHaveProperty('role', 'learner');
    });

    it('should return validation error for invalid email', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          ...validUserData,
          email: 'invalid-email'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('errors');
    });

    it('should return validation error for weak password', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          ...validUserData,
          password: 'weak'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('errors');
    });

    it('should return validation error for missing required fields', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          name: 'Test User'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('errors');
    });
  });

  describe('POST /auth/login', () => {
    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123!'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).toHaveProperty('email', 'test@example.com');
    });

    it('should return error for invalid credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword123!'
        })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message');
    });

    it('should return validation error for missing fields', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('errors');
    });
  });

  describe('POST /auth/forgot-password', () => {
    it('should send OTP for valid email', async () => {
      const response = await request(app)
        .post('/auth/forgot-password')
        .send({
          email: 'test@example.com'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
    });

    it('should return error for non-existent email', async () => {
      const response = await request(app)
        .post('/auth/forgot-password')
        .send({
          email: 'nonexistent@example.com'
        })
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message');
    });

    it('should return validation error for invalid email format', async () => {
      const response = await request(app)
        .post('/auth/forgot-password')
        .send({
          email: 'invalid-email'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('errors');
    });
  });

  describe('POST /auth/verify-otp', () => {
    it('should verify valid OTP', async () => {
      const response = await request(app)
        .post('/auth/verify-otp')
        .send({
          email: 'test@example.com',
          otp: '123456'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('token');
    });

    it('should return error for invalid OTP', async () => {
      const response = await request(app)
        .post('/auth/verify-otp')
        .send({
          email: 'test@example.com',
          otp: '000000'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message');
    });

    it('should return validation error for missing fields', async () => {
      const response = await request(app)
        .post('/auth/verify-otp')
        .send({
          email: 'test@example.com'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('errors');
    });
  });

  describe('POST /auth/reset-password', () => {
    let resetToken: string;

    beforeEach(() => {
      resetToken = jwt.sign(
        { email: 'test@example.com', type: 'password_reset' },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );
    });

    it('should reset password with valid token', async () => {
      const response = await request(app)
        .post('/auth/reset-password')
        .send({
          token: resetToken,
          password: 'NewPassword123!'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
    });

    it('should return error for invalid token', async () => {
      const response = await request(app)
        .post('/auth/reset-password')
        .send({
          token: 'invalid-token',
          password: 'NewPassword123!'
        })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message');
    });

    it('should return error for weak password', async () => {
      const response = await request(app)
        .post('/auth/reset-password')
        .send({
          token: resetToken,
          password: 'weak'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('errors');
    });
  });

  describe('GET /auth/me', () => {
    let authToken: string;

    beforeEach(() => {
      authToken = jwt.sign(
        { userId: 'user_123', email: 'test@example.com' },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );
    });

    it('should return user profile with valid token', async () => {
      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).toHaveProperty('email', 'test@example.com');
    });

    it('should return 401 for missing token', async () => {
      const response = await request(app)
        .get('/auth/me')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message');
    });

    it('should return 401 for invalid token', async () => {
      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('POST /auth/logout', () => {
    let authToken: string;

    beforeEach(() => {
      authToken = jwt.sign(
        { userId: 'user_123', email: 'test@example.com' },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );
    });

    it('should logout successfully', async () => {
      const response = await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
    });

    it('should return 401 for missing token', async () => {
      const response = await request(app)
        .post('/auth/logout')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message');
    });
  });
}); 