# Time Auction - Deployment Guide

This document provides detailed instructions for deploying the Time Auction game to various environments.

## Deploying to Replit

Replit offers a streamlined deployment process with built-in hosting capabilities.

### Prerequisites

- A Replit account
- Basic knowledge of Git (optional)

### Steps

1. **Create a New Replit Project**
   - Log in to Replit
   - Create a new project using the "Node.js" template
   - Alternatively, use the "Import from GitHub" option if your repository is on GitHub

2. **Set Up the Project**
   - If importing directly, select the repository
   - If starting from scratch, clone your repository in the Replit terminal:
     ```bash
     git clone https://github.com/yourusername/time-auction.git .
     ```

3. **Install Dependencies**
   - In the Replit shell, run:
     ```bash
     npm install
     ```

4. **Configure Environment Variables**
   - Go to the "Secrets" tab in your Replit project
   - Add necessary environment variables:
     - `NODE_ENV=production`
     - `SESSION_SECRET=your_secure_random_string`
     - `DATABASE_URL=your_database_url` (if using a database)

5. **Set Up Database (Optional)**
   - If using Replit's Database feature, create a new Database from the sidebar
   - Copy the connection string to your `DATABASE_URL` secret
   - Initialize the database schema:
     ```bash
     npm run db:push
     ```

6. **Configure the Run Button**
   - Edit the `.replit` file to use the correct run command:
     ```
     run = "npm run start"
     ```

7. **Deploy**
   - Click the "Run" button to start your application
   - Your project will be available at your Replit URL (e.g., `https://timeauction.yourusername.repl.co`)

8. **Set Up Automatic Deployments (Optional)**
   - In the "Git" tab, connect your GitHub repository
   - Configure automatic deployments for when changes are pushed to your main branch

## Deploying to a Custom Server

### Prerequisites

- A server with Node.js (v14+) installed
- SSH access to your server
- A domain name (optional but recommended)
- Basic knowledge of Linux commands

### Steps

1. **Prepare Your Server**
   - Update your system:
     ```bash
     sudo apt update && sudo apt upgrade -y
     ```
   - Install Node.js if not already installed:
     ```bash
     curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
     sudo apt-get install -y nodejs
     ```
   - Install Git:
     ```bash
     sudo apt-get install git -y
     ```

2. **Clone the Repository**
   ```bash
   git clone https://github.com/yourusername/time-auction.git
   cd time-auction
   ```

3. **Install Dependencies**
   ```bash
   npm install
   ```

4. **Build for Production**
   ```bash
   npm run build
   ```

5. **Configure Environment Variables**
   Create a `.env` file in the project root:
   ```
   NODE_ENV=production
   PORT=5000
   SESSION_SECRET=your_secure_random_string
   DATABASE_URL=your_database_url
   ```

6. **Set Up a Database (Optional)**
   - Install PostgreSQL:
     ```bash
     sudo apt install postgresql postgresql-contrib -y
     ```
   - Create a database and user:
     ```bash
     sudo -u postgres psql
     CREATE DATABASE timeauction;
     CREATE USER timeauction_user WITH ENCRYPTED PASSWORD 'your_password';
     GRANT ALL PRIVILEGES ON DATABASE timeauction TO timeauction_user;
     \q
     ```
   - Update your `DATABASE_URL` in the `.env` file
   - Initialize the database schema:
     ```bash
     npm run db:push
     ```

7. **Set Up a Process Manager**
   - Install PM2:
     ```bash
     npm install -g pm2
     ```
   - Start your application:
     ```bash
     pm2 start npm --name "time-auction" -- start
     ```
   - Make PM2 start on boot:
     ```bash
     pm2 startup
     pm2 save
     ```

8. **Set Up Nginx as a Reverse Proxy**
   - Install Nginx:
     ```bash
     sudo apt install nginx -y
     ```
   - Create a new site configuration:
     ```bash
     sudo nano /etc/nginx/sites-available/time-auction
     ```
   - Add the following configuration:
     ```nginx
     server {
         listen 80;
         server_name yourdomain.com www.yourdomain.com;

         location / {
             proxy_pass http://localhost:5000;
             proxy_http_version 1.1;
             proxy_set_header Upgrade $http_upgrade;
             proxy_set_header Connection 'upgrade';
             proxy_set_header Host $host;
             proxy_cache_bypass $http_upgrade;
         }
     }
     ```
   - Enable the site:
     ```bash
     sudo ln -s /etc/nginx/sites-available/time-auction /etc/nginx/sites-enabled/
     sudo nginx -t
     sudo systemctl restart nginx
     ```

9. **Set Up SSL with Let's Encrypt**
   - Install Certbot:
     ```bash
     sudo apt install certbot python3-certbot-nginx -y
     ```
   - Obtain certificates:
     ```bash
     sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
     ```
   - Follow the prompts to complete the setup

10. **Monitor and Maintain**
    - Check application status:
      ```bash
      pm2 status
      ```
    - View logs:
      ```bash
      pm2 logs time-auction
      ```
    - Monitor server resources:
      ```bash
      htop
      ```

## Deploying to Cloud Platforms

### AWS Elastic Beanstalk

1. **Prerequisites**
   - AWS Account
   - AWS CLI installed and configured
   - EB CLI installed

2. **Initialize Elastic Beanstalk**
   ```bash
   eb init time-auction --platform node.js --region us-east-1
   ```

3. **Configure the Application**
   - Create a `.ebextensions` directory in your project root
   - Create a configuration file at `.ebextensions/nodecommand.config`:
     ```yaml
     option_settings:
       aws:elasticbeanstalk:container:nodejs:
         NodeCommand: "npm start"
     ```

4. **Deploy**
   ```bash
   eb create time-auction-env
   ```

5. **Configure Environment Variables**
   - Go to the Elastic Beanstalk console
   - Navigate to your environment's Configuration page
   - Add environment variables in the Software section

### Heroku

1. **Prerequisites**
   - Heroku account
   - Heroku CLI installed and logged in

2. **Create a Heroku App**
   ```bash
   heroku create time-auction
   ```

3. **Configure the Application**
   - Create a `Procfile` in your project root:
     ```
     web: npm start
     ```

4. **Configure Environment Variables**
   ```bash
   heroku config:set NODE_ENV=production
   heroku config:set SESSION_SECRET=your_secure_random_string
   ```

5. **Add a Database (Optional)**
   ```bash
   heroku addons:create heroku-postgresql:hobby-dev
   ```

6. **Deploy**
   ```bash
   git push heroku main
   ```

7. **Initialize the Database**
   ```bash
   heroku run npm run db:push
   ```

## Post-Deployment Checklist

Regardless of your deployment platform, complete these steps after deployment:

1. **Test the Application**
   - Test all game functionality
   - Verify WebSocket connections are working
   - Test with multiple concurrent users

2. **Set Up Monitoring**
   - Implement application monitoring (e.g., New Relic, Datadog)
   - Set up error tracking (e.g., Sentry)
   - Configure log aggregation

3. **Performance Optimization**
   - Enable content compression
   - Configure proper cache headers
   - Implement CDN for static assets

4. **Security Checks**
   - Ensure all communication is over HTTPS
   - Verify no sensitive information is exposed
   - Run security audit on dependencies:
     ```bash
     npm audit
     ```

5. **Backup Strategy**
   - Set up regular database backups
   - Document disaster recovery procedures