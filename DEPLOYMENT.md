# Deployment Guide

This guide covers different deployment options for the Zaira Backend API.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Configuration](#environment-configuration)
- [Docker Deployment](#docker-deployment)
- [Manual Deployment](#manual-deployment)
- [Production Considerations](#production-considerations)
- [Monitoring and Logging](#monitoring-and-logging)
- [Backup and Recovery](#backup-and-recovery)

## Prerequisites

- Node.js 18+ (for manual deployment)
- Docker and Docker Compose (for containerized deployment)
- MySQL 8.0+
- Redis (optional, for caching)
- SSL certificates (for HTTPS)

## Environment Configuration

### 1. Create Production Environment File

```bash
cp .env.example .env.production
```

### 2. Configure Production Variables

```env
# Server Configuration
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Database Configuration
DB_HOST=your-db-host
DB_PORT=3306
DB_NAME=db_ebulletin_system
DB_USER=your-db-user
DB_PASSWORD=your-secure-password
DB_CONNECTION_LIMIT=20

# JWT Configuration (Use strong secrets!)
JWT_SECRET=your-super-secure-jwt-secret-256-bits-minimum
JWT_EXPIRES_IN=24h
JWT_REFRESH_SECRET=your-super-secure-refresh-secret-256-bits-minimum
JWT_REFRESH_EXPIRES_IN=7d

# Security Configuration
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Email Configuration
SMTP_HOST=your-smtp-host
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@domain.com
SMTP_PASS=your-app-password

# CORS Configuration
CORS_ORIGIN=https://your-frontend-domain.com
CORS_CREDENTIALS=true

# Logging Configuration
LOG_LEVEL=info
LOG_MAX_SIZE=20m
LOG_MAX_FILES=14d

# Redis Configuration (if using)
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
```

## Docker Deployment

### 1. Using Docker Compose (Recommended)

```bash
# Clone the repository
git clone <repository-url>
cd zaira-back

# Create production environment file
cp .env.example .env

# Update .env with production values
nano .env

# Build and start services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f backend
```

### 2. Using Docker Only

```bash
# Build the image
docker build -t zaira-backend .

# Run the container
docker run -d \
  --name zaira-backend \
  -p 3000:3000 \
  --env-file .env \
  -v $(pwd)/logs:/app/logs \
  -v $(pwd)/uploads:/app/uploads \
  zaira-backend
```

### 3. Docker Compose with External Database

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  backend:
    build: .
    container_name: zaira-backend
    restart: unless-stopped
    environment:
      NODE_ENV: production
      DB_HOST: external-db-host
      DB_USER: ${DB_USER}
      DB_PASSWORD: ${DB_PASSWORD}
      # ... other env vars
    ports:
      - "3000:3000"
    volumes:
      - ./logs:/app/logs
      - ./uploads:/app/uploads
    networks:
      - zaira-network

networks:
  zaira-network:
    driver: bridge
```

## Manual Deployment

### 1. Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Create application user
sudo useradd -m -s /bin/bash zaira
sudo usermod -aG sudo zaira
```

### 2. Application Deployment

```bash
# Switch to application user
sudo su - zaira

# Clone repository
git clone <repository-url> /home/zaira/zaira-backend
cd /home/zaira/zaira-backend

# Install dependencies
npm ci --only=production

# Create necessary directories
mkdir -p logs uploads uploads/avatars uploads/attachments

# Set up environment
cp .env.example .env
nano .env  # Configure production values

# Set proper permissions
chmod 600 .env
chmod -R 755 logs uploads
```

### 3. Database Setup

```bash
# Import database schema
mysql -u root -p < ebulletin_system.sql

# Run migrations (if any)
npm run db:migrate

# Seed initial data (optional)
npm run db:seed
```

### 4. Process Management with PM2

```bash
# Create PM2 ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'zaira-backend',
    script: 'src/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024'
  }]
};
EOF

# Start application
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Set up PM2 to start on boot
pm2 startup
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u zaira --hp /home/zaira
```

### 5. Nginx Reverse Proxy

```bash
# Install Nginx
sudo apt install nginx

# Create Nginx configuration
sudo nano /etc/nginx/sites-available/zaira-backend
```

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL Configuration
    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;

    # Modern configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

    location / {
        limit_req zone=api burst=20 nodelay;
        
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/zaira-backend /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

## Production Considerations

### 1. Security

- Use strong, unique secrets for JWT tokens
- Enable HTTPS with valid SSL certificates
- Configure firewall rules
- Regular security updates
- Use environment variables for sensitive data
- Enable rate limiting
- Implement proper CORS policies

### 2. Performance

- Use clustering with PM2
- Enable gzip compression
- Implement caching with Redis
- Optimize database queries
- Use CDN for static assets
- Monitor memory usage

### 3. Database

- Use connection pooling
- Regular backups
- Monitor performance
- Implement read replicas if needed
- Use proper indexing

### 4. Monitoring

```bash
# Install monitoring tools
npm install -g clinic

# Monitor with PM2
pm2 monit

# Set up log rotation
sudo nano /etc/logrotate.d/zaira-backend
```

```
/home/zaira/zaira-backend/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 644 zaira zaira
    postrotate
        pm2 reloadLogs
    endscript
}
```

## Monitoring and Logging

### 1. Application Monitoring

```bash
# PM2 monitoring
pm2 monit

# View logs
pm2 logs zaira-backend

# Application metrics
pm2 show zaira-backend
```

### 2. Health Checks

```bash
# Basic health check
curl http://localhost:3000/health

# Detailed monitoring script
cat > monitor.sh << EOF
#!/bin/bash
HEALTH_URL="http://localhost:3000/health"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)

if [ $RESPONSE -eq 200 ]; then
    echo "$(date): Application is healthy"
else
    echo "$(date): Application is unhealthy (HTTP $RESPONSE)"
    # Add alerting logic here
fi
EOF

chmod +x monitor.sh

# Add to crontab for regular checks
echo "*/5 * * * * /home/zaira/zaira-backend/monitor.sh >> /home/zaira/zaira-backend/logs/health.log" | crontab -
```

## Backup and Recovery

### 1. Database Backup

```bash
# Create backup script
cat > backup-db.sh << EOF
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/zaira/backups"
DB_NAME="db_ebulletin_system"

mkdir -p $BACKUP_DIR

mysqldump -u root -p$DB_PASSWORD $DB_NAME > $BACKUP_DIR/backup_$DATE.sql
gzip $BACKUP_DIR/backup_$DATE.sql

# Keep only last 7 days of backups
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +7 -delete

echo "$(date): Database backup completed: backup_$DATE.sql.gz"
EOF

chmod +x backup-db.sh

# Schedule daily backups
echo "0 2 * * * /home/zaira/zaira-backend/backup-db.sh >> /home/zaira/zaira-backend/logs/backup.log" | crontab -
```

### 2. Application Backup

```bash
# Backup application files
tar -czf zaira-backend-$(date +%Y%m%d).tar.gz \
  --exclude=node_modules \
  --exclude=logs \
  --exclude=coverage \
  /home/zaira/zaira-backend
```

## Troubleshooting

### Common Issues

1. **Port already in use**
   ```bash
   sudo lsof -i :3000
   sudo kill -9 <PID>
   ```

2. **Database connection issues**
   ```bash
   # Check database status
   sudo systemctl status mysql
   
   # Test connection
   mysql -u username -p -h hostname
   ```

3. **Permission issues**
   ```bash
   # Fix file permissions
   sudo chown -R zaira:zaira /home/zaira/zaira-backend
   chmod -R 755 /home/zaira/zaira-backend
   ```

4. **Memory issues**
   ```bash
   # Monitor memory usage
   pm2 monit
   
   # Restart application
   pm2 restart zaira-backend
   ```

### Log Analysis

```bash
# View application logs
tail -f logs/combined-$(date +%Y-%m-%d).log

# View error logs
tail -f logs/error-$(date +%Y-%m-%d).log

# PM2 logs
pm2 logs zaira-backend --lines 100
```
