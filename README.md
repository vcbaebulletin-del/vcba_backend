# Zaira Backend - E-Bulletin Board System

A professional Node.js backend API for the Zaira E-Bulletin Board System, built with Express.js, MySQL, and following industry best practices.

## Features

- 🔐 **Authentication & Authorization**: JWT-based auth with role-based access control
- 📊 **Database**: MySQL with connection pooling and optimized queries
- 🛡️ **Security**: Helmet, CORS, rate limiting, input validation
- 📝 **Logging**: Winston with daily rotation and structured logging
- 🧪 **Testing**: Jest with comprehensive test coverage
- 📚 **API Documentation**: RESTful API with proper error handling
- 🚀 **Performance**: Compression, caching, and optimized middleware
- 🐳 **Docker**: Containerized deployment ready

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- MySQL >= 8.0
- npm >= 8.0.0

### Installation

1. Clone the repository and navigate to backend:
```bash
cd zaira-back
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Set up the database:
```bash
# Import the database schema
mysql -u root -p < ../ebulletin_system.sql

# Run migrations (if any)
npm run db:migrate

# Seed initial data
npm run db:seed
```

5. Start the development server:
```bash
npm run dev
```

The server will start on `http://localhost:3000`

## Project Structure

```
src/
├── config/           # Configuration files
├── controllers/      # Route controllers
├── middleware/       # Custom middleware
├── models/          # Database models
├── routes/          # API routes
├── services/        # Business logic services
├── utils/           # Utility functions
├── validators/      # Input validation schemas
├── database/        # Database related files
│   ├── migrations/  # Database migrations
│   └── seeders/     # Database seeders
├── tests/           # Test files
└── server.js        # Application entry point
```

## Available Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run format` - Format code with Prettier
- `npm run build` - Run linting and tests
- `npm run docker:build` - Build Docker image
- `npm run docker:run` - Run Docker container

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh JWT token
- `GET /api/auth/me` - Get current user profile

### Admin Management
- `GET /api/admin/profile` - Get admin profile
- `PUT /api/admin/profile` - Update admin profile
- `GET /api/admin/students` - Get all students
- `POST /api/admin/students` - Create student account
- `PUT /api/admin/students/:id` - Update student
- `DELETE /api/admin/students/:id` - Delete student

### Announcements
- `GET /api/announcements` - Get announcements
- `POST /api/announcements` - Create announcement
- `PUT /api/announcements/:id` - Update announcement
- `DELETE /api/announcements/:id` - Delete announcement

### Notifications
- `GET /api/notifications` - Get user notifications
- `PUT /api/notifications/:id/read` - Mark notification as read

## Environment Variables

See `.env.example` for all available environment variables.

## Testing

Run the test suite:
```bash
npm test
```

Run tests with coverage:
```bash
npm run test:coverage
```

## Deployment

### Docker Deployment

1. Build the Docker image:
```bash
npm run docker:build
```

2. Run the container:
```bash
npm run docker:run
```

### Manual Deployment

1. Set NODE_ENV to production
2. Install production dependencies: `npm ci --only=production`
3. Start the server: `npm start`

## Contributing

1. Follow the existing code style
2. Write tests for new features
3. Run `npm run build` before committing
4. Use conventional commit messages

## License

MIT License - see LICENSE file for details
