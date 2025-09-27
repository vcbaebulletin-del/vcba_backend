const jwt = require('jsonwebtoken');
const config = require('../config/config');
const { AuthenticationError } = require('../middleware/errorHandler');

class JWTUtil {
  // Generate access token
  generateAccessToken(payload) {
    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
      issuer: config.app.name,
      audience: config.app.name,
    });
  }

  // Generate refresh token
  generateRefreshToken(payload) {
    return jwt.sign(payload, config.jwt.refreshSecret, {
      expiresIn: config.jwt.refreshExpiresIn,
      issuer: config.app.name,
      audience: config.app.name,
    });
  }

  // Generate token pair
  generateTokenPair(user) {
    const payload = {
      id: user.admin_id || user.student_id,
      email: user.email,
      role: user.admin_id ? 'admin' : 'student',
      firstName: user.first_name,
      lastName: user.last_name,
      grade_level: user.grade_level || null,
      position: user.position || null, // Add position for admin users
      department: user.department || null, // Add department for admin users
    };

    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken({
      id: payload.id,
      role: payload.role,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: config.jwt.expiresIn,
    };
  }

  // Verify access token
  verifyAccessToken(token) {
    try {
      return jwt.verify(token, config.jwt.secret, {
        issuer: config.app.name,
        audience: config.app.name,
      });
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new AuthenticationError('Access token expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new AuthenticationError('Invalid access token');
      }
      throw new AuthenticationError('Token verification failed');
    }
  }

  // Verify refresh token
  verifyRefreshToken(token) {
    try {
      return jwt.verify(token, config.jwt.refreshSecret, {
        issuer: config.app.name,
        audience: config.app.name,
      });
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new AuthenticationError('Refresh token expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new AuthenticationError('Invalid refresh token');
      }
      throw new AuthenticationError('Refresh token verification failed');
    }
  }

  // Decode token without verification (for debugging)
  decodeToken(token) {
    return jwt.decode(token, { complete: true });
  }

  // Get token from authorization header
  extractTokenFromHeader(authHeader) {
    if (!authHeader) {
      throw new AuthenticationError('Authorization header missing');
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new AuthenticationError('Invalid authorization header format');
    }

    return parts[1];
  }

  // Check if token is expired
  isTokenExpired(token) {
    try {
      const decoded = this.decodeToken(token);
      const currentTime = Math.floor(Date.now() / 1000);
      return decoded.payload.exp < currentTime;
    } catch (error) {
      return true;
    }
  }

  // Get token expiration time
  getTokenExpiration(token) {
    try {
      const decoded = this.decodeToken(token);
      return new Date(decoded.payload.exp * 1000);
    } catch (error) {
      return null;
    }
  }

  // Refresh access token using refresh token
  async refreshAccessToken(refreshToken, userService) {
    try {
      const decoded = this.verifyRefreshToken(refreshToken);

      // Get fresh user data
      let user;
      if (decoded.role === 'admin') {
        user = await userService.getAdminById(decoded.id);
      } else {
        user = await userService.getStudentById(decoded.id);
      }

      if (!user || !user.is_active) {
        throw new AuthenticationError('User not found or inactive');
      }

      // Generate new access token
      const payload = {
        id: user.admin_id || user.student_id,
        email: user.email,
        role: user.admin_id ? 'admin' : 'student',
        firstName: user.first_name,
        lastName: user.last_name,
        grade_level: user.grade_level || null,
        position: user.position || null,
        department: user.department || null,
      };

      return this.generateAccessToken(payload);
    } catch (error) {
      throw error;
    }
  }

  // Blacklist token (for logout)
  // Note: In a production environment, you might want to store blacklisted tokens in Redis
  blacklistToken(token) {
    // This is a simple implementation
    // In production, you should store this in a persistent cache like Redis
    if (!this.blacklistedTokens) {
      this.blacklistedTokens = new Set();
    }
    this.blacklistedTokens.add(token);
  }

  // Check if token is blacklisted
  isTokenBlacklisted(token) {
    if (!this.blacklistedTokens) {
      return false;
    }
    return this.blacklistedTokens.has(token);
  }

  // Clean up expired blacklisted tokens (should be run periodically)
  cleanupBlacklistedTokens() {
    if (!this.blacklistedTokens) {
      return;
    }

    const tokensToRemove = [];
    this.blacklistedTokens.forEach((token) => {
      if (this.isTokenExpired(token)) {
        tokensToRemove.push(token);
      }
    });

    tokensToRemove.forEach((token) => {
      this.blacklistedTokens.delete(token);
    });
  }
}

module.exports = new JWTUtil();
