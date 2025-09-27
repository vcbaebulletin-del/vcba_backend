#!/bin/bash

# VCBA E-Bulletin Board Backend Deployment Script
# This script helps deploy the backend to various platforms

set -e

echo "🚀 VCBA E-Bulletin Board Backend Deployment"
echo "==========================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the backend root directory."
    exit 1
fi

# Function to generate secure secrets
generate_secret() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-32
}

# Function to setup environment file
setup_env() {
    echo "📝 Setting up environment configuration..."
    
    if [ ! -f ".env.production" ]; then
        echo "❌ Error: .env.production file not found. Please create it first."
        exit 1
    fi
    
    # Copy production env to .env
    cp .env.production .env
    
    echo "✅ Environment file configured"
}

# Function to install dependencies
install_deps() {
    echo "📦 Installing production dependencies..."
    npm ci --only=production
    echo "✅ Dependencies installed"
}

# Function to run tests
run_tests() {
    echo "🧪 Running tests..."
    npm test
    echo "✅ Tests passed"
}

# Function to build the application
build_app() {
    echo "🔨 Building application..."
    npm run build
    echo "✅ Application built"
}

# Function to deploy to Heroku
deploy_heroku() {
    echo "🌐 Deploying to Heroku..."
    
    # Check if Heroku CLI is installed
    if ! command -v heroku &> /dev/null; then
        echo "❌ Error: Heroku CLI not found. Please install it first."
        echo "Visit: https://devcenter.heroku.com/articles/heroku-cli"
        exit 1
    fi
    
    # Login to Heroku (if not already logged in)
    heroku auth:whoami || heroku login
    
    # Create Heroku app if it doesn't exist
    read -p "Enter your Heroku app name: " app_name
    heroku create $app_name || echo "App already exists, continuing..."
    
    # Set environment variables
    echo "Setting environment variables..."
    heroku config:set NODE_ENV=production --app $app_name
    heroku config:set NPM_CONFIG_PRODUCTION=false --app $app_name
    
    # Add database addon
    heroku addons:create cleardb:ignite --app $app_name || echo "Database addon already exists"
    
    # Deploy
    git push heroku main
    
    echo "✅ Deployed to Heroku: https://$app_name.herokuapp.com"
}

# Function to deploy to Railway
deploy_railway() {
    echo "🚂 Deploying to Railway..."
    
    # Check if Railway CLI is installed
    if ! command -v railway &> /dev/null; then
        echo "❌ Error: Railway CLI not found. Please install it first."
        echo "Run: npm install -g @railway/cli"
        exit 1
    fi
    
    # Login to Railway
    railway login
    
    # Initialize project
    railway init
    
    # Deploy
    railway up
    
    echo "✅ Deployed to Railway"
}

# Function to deploy to Render
deploy_render() {
    echo "🎨 Deploying to Render..."
    echo "Please follow these steps:"
    echo "1. Go to https://render.com"
    echo "2. Connect your GitHub repository"
    echo "3. Create a new Web Service"
    echo "4. Set the following:"
    echo "   - Build Command: npm install"
    echo "   - Start Command: npm start"
    echo "   - Environment: Node"
    echo "5. Add your environment variables from .env.production"
    echo "6. Deploy!"
}

# Function to create Docker deployment
deploy_docker() {
    echo "🐳 Preparing Docker deployment..."
    
    # Build Docker image
    docker build -t vcba-backend .
    
    echo "✅ Docker image built successfully"
    echo "To run locally: docker run -p 3000:3000 --env-file .env vcba-backend"
    echo "To push to registry: docker tag vcba-backend your-registry/vcba-backend && docker push your-registry/vcba-backend"
}

# Main deployment menu
main() {
    echo "Select deployment option:"
    echo "1) Heroku"
    echo "2) Railway"
    echo "3) Render (manual)"
    echo "4) Docker"
    echo "5) Setup environment only"
    echo "6) Exit"
    
    read -p "Enter your choice (1-6): " choice
    
    case $choice in
        1)
            setup_env
            install_deps
            deploy_heroku
            ;;
        2)
            setup_env
            install_deps
            deploy_railway
            ;;
        3)
            setup_env
            install_deps
            deploy_render
            ;;
        4)
            setup_env
            deploy_docker
            ;;
        5)
            setup_env
            echo "✅ Environment setup complete"
            ;;
        6)
            echo "👋 Goodbye!"
            exit 0
            ;;
        *)
            echo "❌ Invalid choice. Please try again."
            main
            ;;
    esac
}

# Run main function
main
