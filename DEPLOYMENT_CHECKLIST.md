# E-Bulletin Board Deployment Checklist

This checklist provides a comprehensive guide for deploying the e-bulletin board system to production.

## 1. Environment Configuration

Properly configuring your environment variables is critical for security and functionality.

### 1.1. Production Environment Variables

Create a `.env` file in the root of your `BACK-VCBA-E-BULLETIN-BOARD` project and add the following variables. **Never commit this file to version control.**

```
# Node.js Environment
NODE_ENV=production

# Server Configuration
PORT=3000

# Database Connection (Railway)
DB_HOST=your-railway-db-host
DB_USER=your-railway-db-user
DB_PASSWORD=your-railway-db-password
DB_NAME=your-railway-db-name
DB_PORT=your-railway-db-port

# JWT Authentication
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=1d

# CORS Configuration
CORS_ORIGIN=https://your-vercel-frontend-url.com

# Logging
LOG_LEVEL=info

# Rate Limiting
RATE_LIMIT_WINDOW_MS=15 * 60 * 1000
RATE_LIMIT_MAX_REQUESTS=100
```
**Action:**
- [ ] Create the `.env` file with the variables above.
- [ ] Replace the placeholder values with your actual production credentials.
- [ ] Add `.env` to your `.gitignore` file to prevent committing it.
```

## 2. Code Changes Required

Before deploying, you need to make some code adjustments to ensure your application runs smoothly in a production environment.

### 2.1. API Endpoints

Your frontend application needs to know the URL of your production API. Update the base URL in your React application to point to your Railway deployment URL.

**Action:**
- [ ] In your frontend codebase, locate the API client or configuration file where the base URL is defined.
- [ ] Change the `baseURL` from `http://localhost:3000` to your production API URL (e.g., `https://your-backend-api.railway.app`).

### 2.2. Error Handling

Implement a centralized error-handling middleware to catch and log unexpected errors.

**Action:**
- [ ] Create an error-handling middleware in your Express application.
- [ ] Ensure it logs the error and sends a generic error message to the client in production.

```javascript
// src/middleware/errorHandler.js
const winston = require('winston');

const errorHandler = (err, req, res, next) => {
  winston.error(err.message, err);

  if (process.env.NODE_ENV === 'production') {
    res.status(500).send('Something failed.');
  } else {
    res.status(500).send(err.message);
  }
};

module.exports = errorHandler;
```

### 2.3. Logging and Monitoring

Set up `winston` for structured, file-based logging.

**Action:**
- [ ] Configure `winston` to write logs to files, with rotation to prevent large log files.
- [ ] Use a logging middleware like `morgan` to log HTTP requests.

```javascript
// src/config/logger.js
const winston = require('winston');
require('winston-daily-rotate-file');

const transport = new winston.transports.DailyRotateFile({
  filename: 'logs/application-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d'
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [transport]
});

module.exports = logger;
```

## 3. Database Setup

Proper database configuration is essential for data integrity and performance.

### 3.1. MySQL on Railway

Railway makes it easy to provision and manage a MySQL database.

**Action:**
- [ ] From your Railway dashboard, add a new MySQL database service.
- [ ] Railway will automatically provide you with the connection details (host, user, password, database name, port). Use these in your `.env` file.

### 3.2. Database Migrations

Your `package.json` includes a `db:migrate` script. This script should be run to set up your database schema in production.

**Action:**
- [ ] Before starting your application for the first time, run the migration script in your Railway deployment.
- [ ] You can add `npm run db:migrate` to your `start` script in `package.json` to automate this process.

```json
"scripts": {
  "start": "npm run db:migrate && node src/server.js",
  // ... other scripts
}
```

### 3.3. Initial Data Seeding

If your application requires initial data (e.g., an admin user), use the `db:seed` script.

**Action:**
- [ ] Run `npm run db:seed` after your first successful migration.
- [ ] **Important:** Ensure your seed scripts are designed to run safely in a production environment and will not create duplicate data.

### 3.4. Backup and Recovery

Railway provides automated backups for its database services.

**Action:**
- [ ] Familiarize yourself with Railway's backup and recovery features.
- [ ] For extra security, consider implementing your own backup script that periodically dumps the database and stores it in a secure location (like an S3 bucket).

## 4. Frontend Deployment (Vercel)

Deploying your React frontend to Vercel is a straightforward process.

### 4.1. Build Configuration

Vercel will automatically detect that you have a React application and configure the build settings accordingly.

**Action:**
- [ ] Connect your GitHub repository for the frontend project to Vercel.
- [ ] Vercel will use the standard `npm run build` command to build your application.

### 4.2. Environment Variables

You need to provide your frontend with the URL of your backend API.

**Action:**
- [ ] In your Vercel project settings, add an environment variable:
  - `REACT_APP_API_URL=https://your-backend-api.railway.app`
- [ ] In your React code, access this variable using `process.env.REACT_APP_API_URL`.

### 4.3. API Base URL Configuration

Update your frontend code to use the new environment variable for API requests.

**Action:**
- [ ] In your API client (e.g., Axios instance), set the `baseURL`:

```javascript
const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL
});
```

### 4.4. Static Asset Optimization

Vercel automatically handles static asset optimization and serves them through its CDN.

**Action:**
- [ ] No specific action is required here, as Vercel manages this for you.

## 5. Backend Deployment (Railway)

Deploying your Node.js backend to Railway requires some specific configurations.

### 5.1. `package.json` Scripts

Your `start` script should be configured for production.

**Action:**
- [ ] Ensure your `start` script in `package.json` is `"start": "node src/server.js"`.
- [ ] Consider adding a `postinstall` script if you need to run migrations automatically after dependencies are installed: `"postinstall": "npm run db:migrate"`.

### 5.2. Port Configuration and Health Checks

Railway automatically detects the port your application should listen on.

**Action:**
- [ ] In `src/server.js`, make sure you are using `process.env.PORT`.
- [ ] Railway also provides a health check URL to monitor your application's status.

```javascript
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
```

### 5.3. File Upload Handling

Since Railway has an ephemeral filesystem, you cannot rely on storing uploaded files locally.

**Action:**
- [ ] Use a cloud storage service like AWS S3, Cloudinary, or a similar service to store uploaded files.
- [ ] Update your file upload logic to upload files directly to the cloud storage provider.

### 5.4. WebSocket Configuration

Your `socket.io` configuration needs to be adjusted for production.

**Action:**
- [ ] Configure the `cors` settings for `socket.io` to allow connections from your frontend URL.

```javascript
const io = require('socket.io')(server, {
  cors: {
    origin: process.env.CORS_ORIGIN,
    methods: ["GET", "POST"]
  }
});
```

## 6. Performance Optimization

To ensure your application is fast and scalable, consider the following optimizations.

### 6.1. Database Indexing

Add indexes to your database tables to speed up query performance.

**Action:**
- [ ] Identify columns that are frequently used in `WHERE` clauses, `JOIN` conditions, and `ORDER BY` clauses.
- [ ] Add indexes to these columns in your database schema.

### 6.2. Caching Strategies

Implement caching to reduce database load and improve response times.

**Action:**
- [ ] Use an in-memory data store like Redis for caching frequently accessed data.
- [ ] Cache database queries, API responses, and other computed data.

### 6.3. Asset Compression and CDN

Compressing assets and using a Content Delivery Network (CDN) can significantly improve frontend performance.

**Action:**
- [ ] Use the `compression` middleware in your Express application to compress HTTP responses.
- [ ] Vercel automatically serves your frontend assets through its CDN, so no extra configuration is needed for the frontend.