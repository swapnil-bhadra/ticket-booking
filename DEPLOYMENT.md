# Deployment Guide

## Quick Start Deployment (Render + Vercel)

### Option 1: Deploy Backend on Render

1. **Create Render Account**
   - Go to https://render.com
   - Sign up with GitHub account

2. **Create PostgreSQL Database**
   - Click "New +" → "PostgreSQL"
   - Name: `ticket-booking-db`
   - Region: Select closest to you
   - Create database and copy connection string

3. **Setup Database**
   ```bash
   # SSH into Render PostgreSQL
   psql <connection-string>
   
   # Run schema
   \i server/db/schema.sql
   
   # Verify tables created
   \dt
   ```

4. **Create Web Service for Backend**
   - Click "New +" → "Web Service"
   - Connect GitHub repository
   - Set build command: `npm install`
   - Set start command: `npm start`
   - Add environment variables:
     ```
     DB_HOST=<from connection string>
     DB_PORT=<from connection string>
     DB_USER=<from connection string>
     DB_PASSWORD=<from connection string>
     DB_NAME=<from connection string>
     JWT_SECRET=your-secret-key-generate-with-`openssl rand -hex 32`
     EMAIL_USER=your-gmail@gmail.com
     EMAIL_PASSWORD=your-app-password
     SEAT_HOLD_TTL=10
     CLIENT_URL=https://your-vercel-url.vercel.app
     ```

5. **Deploy**
   - Click "Create Web Service"
   - Render will auto-deploy on git push

### Option 2: Deploy Frontend on Vercel

1. **Create Vercel Account**
   - Go to https://vercel.com
   - Sign up with GitHub account

2. **Import Project**
   - Click "Import Project"
   - Select your GitHub repository
   - Set root directory: `client`
   - Add environment variables:
     ```
     REACT_APP_API_URL=https://your-render-backend-url/api
     ```

3. **Deploy**
   - Click "Deploy"
   - Vercel will auto-deploy on git push

### Option 3: Deploy Locally with Docker

1. **Create Dockerfile for Backend**
   ```dockerfile
   FROM node:18-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm install --production
   COPY . .
   EXPOSE 5000
   CMD ["npm", "start"]
   ```

2. **Create Docker Compose**
   ```yaml
   version: '3.8'
   services:
     db:
       image: postgres:15
       environment:
         POSTGRES_PASSWORD: postgres
         POSTGRES_DB: ticket_booking
       volumes:
         - postgres_data:/var/lib/postgresql/data
       ports:
         - "5432:5432"
     
     backend:
       build: .
       environment:
         DB_HOST: db
         DB_USER: postgres
         DB_PASSWORD: postgres
         DB_NAME: ticket_booking
         JWT_SECRET: dev-secret-key
       ports:
         - "5000:5000"
       depends_on:
         - db
     
     frontend:
       build:
         context: .
         dockerfile: client/Dockerfile
       ports:
         - "3000:3000"
       environment:
         REACT_APP_API_URL: http://localhost:5000/api
   
   volumes:
     postgres_data:
   ```

3. **Run**
   ```bash
   docker-compose up --build
   ```

## Environment Variables Checklist

```bash
# Database
✓ DB_HOST
✓ DB_PORT
✓ DB_USER
✓ DB_PASSWORD
✓ DB_NAME

# Application
✓ JWT_SECRET (use: openssl rand -hex 32)
✓ SEAT_HOLD_TTL=10
✓ NODE_ENV=production

# Email (Gmail)
✓ EMAIL_USER=your-email@gmail.com
✓ EMAIL_PASSWORD=app-password (NOT regular password)
✓ EMAIL_FROM=noreply@your-domain.com

# URLs
✓ CLIENT_URL=https://your-frontend-url.com
```

## Gmail App Password Setup

1. Enable 2FA on Google Account: https://myaccount.google.com/security
2. Go to App Passwords: https://myaccount.google.com/apppasswords
3. Select "Mail" and "Windows Computer" (or other)
4. Google generates 16-character password
5. Copy and use as EMAIL_PASSWORD in .env
6. Use your regular email as EMAIL_USER

## Database Schema Setup

### Local Development
```bash
createdb ticket_booking
psql ticket_booking < server/db/schema.sql
```

### Production (Render PostgreSQL)
```bash
# Via psql CLI or Render Dashboard SQL Editor
psql postgresql://<user>:<pass>@<host>:<port>/<database>
\i server/db/schema.sql
```

## Testing Deployment

### Health Check
```bash
curl https://your-backend-url/health
# Response: { "status": "OK", "timestamp": "..." }
```

### Create Test User
```bash
curl -X POST https://your-backend-url/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123",
    "name": "Test User",
    "role": "customer"
  }'
```

### Create Venue (Admin)
```bash
# First, register as admin and get token
curl -X POST https://your-backend-url/api/venues \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Cinema",
    "city": "Mumbai",
    "capacity": 500,
    "categories": [
      { "name": "Premium", "price": 500 },
      { "name": "Standard", "price": 300 }
    ],
    "seats": [
      { "number": "A1", "row": 1, "col": 1, "category": "Premium" }
    ]
  }'
```

## Monitoring & Logs

### Render Logs
- Go to Service → Logs tab
- Real-time streaming logs
- Search and filter capabilities

### Error Monitoring
- Monitor `audit_log` table for issues
- Check PostgreSQL slow query logs
- Monitor background job execution

```sql
-- Check for failed operations
SELECT action, COUNT(*) as count 
FROM audit_log 
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY action;

-- Check for stuck holds (older than TTL)
SELECT COUNT(*) 
FROM show_seats 
WHERE status = 'held' AND held_until < NOW();
```

## Scaling Considerations

### Phase 1: Initial Launch (1-10 users)
- Single Render dyno
- PostgreSQL shared instance
- No caching needed

### Phase 2: Growth (100-1000 users)
- Scale to 2-3 Render dynos
- Dedicated PostgreSQL instance
- Add Redis for caching seat maps
- Optimize indexes

### Phase 3: High Scale (10K+ users)
- Load balancer (AWS ELB)
- Multiple backend instances
- Read replicas for PostgreSQL
- Database sharding by show_id
- CDN for static assets (Vercel)

## Backup & Recovery

### Automated Backups (Render PostgreSQL)
- Enabled by default
- 7-day retention
- Point-in-time recovery available

### Manual Backup
```bash
pg_dump postgresql://<user>:<pass>@<host>/<db> > backup.sql
```

### Restore from Backup
```bash
psql postgresql://<user>:<pass>@<host>/<db> < backup.sql
```

## CI/CD Pipeline

### GitHub Actions Workflow
Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to Render
        env:
          RENDER_API_KEY: ${{ secrets.RENDER_API_KEY }}
          RENDER_SERVICE_ID: ${{ secrets.RENDER_SERVICE_ID }}
        run: |
          curl -X POST https://api.render.com/v1/services/$RENDER_SERVICE_ID/deploys \
            -H "Accept: application/json" \
            -H "Authorization: Bearer $RENDER_API_KEY"
```

## Troubleshooting

### Database Connection Error
```bash
# Verify DB credentials
psql -h <host> -U <user> -d <database>

# Check connection pool
SELECT datname, count(*) as connections 
FROM pg_stat_activity 
GROUP BY datname;
```

### Email Not Sending
```bash
# Test Gmail app password
curl -X POST https://your-api/api/auth/register \
  -d '...' # Will trigger welcome email

# Check logs for EMAIL_USER and EMAIL_PASSWORD env vars set
```

### Seat Hold Not Releasing
```sql
-- Check scheduler execution
SELECT * FROM audit_log 
WHERE action = 'auto_release' 
ORDER BY created_at DESC LIMIT 10;

-- Manually verify expiry
SELECT COUNT(*) FROM show_seats 
WHERE status = 'held' AND held_until < NOW();
```

### Performance Issues
```sql
-- Check slow queries
SELECT query, calls, mean_time 
FROM pg_stat_statements 
ORDER BY mean_time DESC LIMIT 10;

-- Verify indexes exist
\d+ show_seats  -- in psql
```

## Security Checklist

- [ ] JWT_SECRET is strong random string (32+ chars)
- [ ] EMAIL_PASSWORD is app password, not regular password
- [ ] Database password is strong (20+ chars)
- [ ] All .env variables are set in production
- [ ] HTTPS is enabled (Render/Vercel auto-enable)
- [ ] CORS is configured for your frontend URL
- [ ] Rate limiting considered for API endpoints
- [ ] SQL injection prevention via parameterized queries
- [ ] XSS protection via React escaping
- [ ] CSRF tokens if needed (currently stateless JWT)

## Success Metrics

After deployment, verify:
- ✓ Health endpoint responds
- ✓ Can register and login
- ✓ Can create events (organiser)
- ✓ Can view events (customer)
- ✓ Can hold seats without errors
- ✓ Can book seats (with QR code)
- ✓ Confirmation emails are sent
- ✓ Seat holds auto-release after TTL
- ✓ Scheduler jobs running (check logs)
- ✓ Database is persisting data

## Rollback Procedure

If deployment breaks production:

1. **Immediate Rollback** (Render)
   - Go to Deployments tab
   - Click "Rollback" on previous version
   - Takes ~2 minutes to redeploy

2. **Database Rollback**
   - Contact Render support for restore
   - Specify point-in-time (Render has 7-day backups)

3. **Frontend Rollback** (Vercel)
   - Go to Deployments
   - Click "Redeploy" on previous version

## Support

For issues:
1. Check logs in Render dashboard
2. Verify environment variables
3. Test database connection
4. Review system design doc for architecture
5. Contact Render/Vercel support if infrastructure issue
