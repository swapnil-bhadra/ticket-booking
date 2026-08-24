# 🚀 Quick Start Guide

Get the Ticket Booking System up and running in 5 minutes!

## Prerequisites

- Node.js 16+ and npm
- PostgreSQL 12+ (or PostgreSQL online service)
- Git

## Option 1: Local Development (5 minutes)

### 1. Clone and Install

```bash
# Extract the zip file
unzip ticket-booking-system.zip
cd ticket-booking-system

# Install backend dependencies
npm install

# Install frontend dependencies
cd client
npm install
cd ..
```

### 2. Setup Database

```bash
# Create database
createdb ticket_booking

# Load schema
psql ticket_booking < server/db/schema.sql

# Verify
psql ticket_booking -c "\dt"
# Should list: audit_log, bookings, booking_items, events, seats, etc.
```

### 3. Configure Environment

```bash
# Copy example env file
cp .env.example .env

# Edit .env with your settings:
# For local dev, you can use defaults but set:
JWT_SECRET=dev-secret-key-change-in-production
DB_HOST=localhost
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=ticket_booking

# For email (optional for testing):
# Skip or use test Gmail account
EMAIL_USER=test@gmail.com
EMAIL_PASSWORD=xxxx xxxx xxxx xxxx
```

### 4. Start Backend

```bash
# Terminal 1: Backend on port 5000
npm start

# Should see:
# 🎟️ Ticket Booking System running on port 5000
```

### 5. Start Frontend

```bash
# Terminal 2: Frontend on port 3000
cd client
npm start

# Browser will open http://localhost:3000
```

### 6. Test the System

```bash
# 1. Register as Customer
# Go to http://localhost:3000
# Click "Register"
# Email: customer@test.com
# Password: test123
# Role: Customer
# Click Register

# 2. You should be logged in

# 3. To create events, register as Organiser in new tab:
# Open http://localhost:3000 in new tab
# Register with:
# Email: organiser@test.com
# Password: test123
# Role: Organiser

# 4. To create venues (admin), register with:
# Email: admin@test.com
# Password: test123
# Role: Admin
```

## Option 2: Docker (3 minutes)

```bash
# Requires Docker and Docker Compose installed

cd ticket-booking-system

# Create Dockerfile
cat > Dockerfile << 'EOF'
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
EOF

# Create docker-compose.yml
cat > docker-compose.yml << 'EOF'
version: '3.8'
services:
  db:
    image: postgres:15
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: ticket_booking
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
  
  backend:
    build: .
    environment:
      DB_HOST: db
      DB_USER: postgres
      DB_PASSWORD: postgres
      DB_NAME: ticket_booking
      JWT_SECRET: dev-secret
      SEAT_HOLD_TTL: 10
    ports:
      - "5000:5000"
    depends_on:
      - db
    command: sh -c "npm start"

  frontend:
    image: node:18-alpine
    working_dir: /app/client
    volumes:
      - .:/app
    ports:
      - "3000:3000"
    environment:
      REACT_APP_API_URL: http://localhost:5000/api
    depends_on:
      - backend
    command: sh -c "npm install && npm start"

volumes:
  postgres_data:
EOF

# Start everything
docker-compose up

# Wait for all services to start (30 seconds)
# Frontend: http://localhost:3000
# Backend: http://localhost:5000
```

## API Endpoints Cheat Sheet

```bash
# Health Check
curl http://localhost:5000/health

# Register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123",
    "name": "Test User",
    "role": "customer"
  }'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123"
  }'

# Get all events
curl http://localhost:5000/api/events

# Get all venues
curl http://localhost:5000/api/venues
```

## Create Test Data (Admin Only)

### 1. Register as Admin

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "password": "admin123",
    "name": "Admin User",
    "role": "admin"
  }'

# Copy the token from response
TOKEN="<your-token-here>"
```

### 2. Create a Venue

```bash
curl -X POST http://localhost:5000/api/venues \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Inox Multiplex",
    "city": "Mumbai",
    "capacity": 300,
    "categories": [
      { "name": "Premium", "price": 500 },
      { "name": "Standard", "price": 300 },
      { "name": "Economy", "price": 150 }
    ],
    "seats": [
      { "number": "A1", "row": 1, "col": 1, "category": "Premium" },
      { "number": "A2", "row": 1, "col": 2, "category": "Premium" },
      { "number": "B1", "row": 2, "col": 1, "category": "Standard" },
      { "number": "B2", "row": 2, "col": 2, "category": "Standard" }
    ]
  }'
```

### 3. Register as Organiser and Create Event

```bash
# Register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "organiser@test.com",
    "password": "org123",
    "name": "Event Organiser",
    "role": "organiser"
  }'

# Copy the token
ORG_TOKEN="<organiser-token>"
VENUE_ID="<venue-id-from-previous-step>"

# Create Event
curl -X POST http://localhost:5000/api/events \
  -H "Authorization: Bearer $ORG_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Avengers Endgame",
    "description": "Epic superhero movie",
    "type": "movie",
    "venue_id": "'$VENUE_ID'",
    "event_date": "2024-12-25",
    "event_time": "19:00:00",
    "poster_url": "https://via.placeholder.com/200x300"
  }'
```

### 4. Create a Show

```bash
EVENT_ID="<event-id-from-previous-step>"

curl -X POST http://localhost:5000/api/events/$EVENT_ID/shows \
  -H "Authorization: Bearer $ORG_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "show_time": "2024-12-25T19:00:00Z"
  }'
```

## Test Core Features

### Test 1: Hold a Seat (10 min TTL)

```bash
# Get show details
SHOW_ID="<show-id-from-previous-step>"
SEAT_ID="<seat-id-from-show-details>"
CUSTOMER_TOKEN="<customer-token>"

curl -X POST http://localhost:5000/api/bookings/hold-seat \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "show_id": "'$SHOW_ID'",
    "seat_id": "'$SEAT_ID'"
  }'

# Seat is now "held" for 10 minutes
# Try to hold same seat from another customer → Should fail
```

### Test 2: Book a Seat

```bash
curl -X POST http://localhost:5000/api/bookings \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "show_id": "'$SHOW_ID'",
    "seat_ids": ["'$SEAT_ID'"]
  }'

# Response includes QR code and booking reference
# Email sent (if configured)
```

### Test 3: Concurrency Test

```bash
# Open 2 terminals
# Terminal 1 & 2: Hold same seat simultaneously
curl -X POST http://localhost:5000/api/bookings/hold-seat \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"show_id": "'$SHOW_ID'", "seat_id": "'$SEAT_ID'"}'

# Result: Only ONE succeeds, other gets error "Seat is held"
```

### Test 4: Cancel and Waitlist

```bash
# Get booking ID
BOOKING_ID="<from-bookings-response>"

# Cancel booking
curl -X POST http://localhost:5000/api/bookings/$BOOKING_ID/cancel \
  -H "Authorization: Bearer $CUSTOMER_TOKEN"

# Seat is now available again
# Automatically offered to next waitlist customer (if any)
```

## File Structure

```
ticket-booking-system/
├── server/                    # Node.js backend
│   ├── index.js              # Express server entry
│   ├── db/
│   │   ├── index.js          # Database connection
│   │   └── schema.sql        # Database schema
│   ├── middleware/
│   │   └── auth.js           # JWT authentication
│   ├── routes/
│   │   ├── auth.js           # Auth endpoints
│   │   ├── events.js         # Event management
│   │   ├── bookings.js       # Seat holds, bookings
│   │   └── venues.js         # Venue management
│   ├── utils/
│   │   ├── seatManager.js    # Seat hold & TTL logic
│   │   ├── waitlistManager.js # Waitlist & offers
│   │   └── emailService.js   # QR code & emails
│   └── scheduler/
│       └── jobs.js           # Background jobs (TTL release)
├── client/                    # React frontend
│   ├── src/
│   │   ├── App.jsx           # Main component
│   │   ├── api/
│   │   │   └── client.js     # API wrapper
│   │   └── App.css           # Styling
│   └── package.json
├── README.md                  # Full documentation
├── SYSTEM_DESIGN.md           # Architecture details
├── DEPLOYMENT.md              # Production deployment
├── .env.example               # Environment variables
└── package.json               # Backend dependencies
```

## Troubleshooting

### "Cannot connect to database"
```bash
# Make sure PostgreSQL is running
pg_isready

# Check connection string in .env
DB_HOST=localhost  # or your DB host
DB_USER=postgres   # or your DB user
DB_PASSWORD=postgres
DB_NAME=ticket_booking
```

### "Port 5000 already in use"
```bash
# Use a different port
PORT=5001 npm start
```

### "Port 3000 already in use"
```bash
cd client
PORT=3001 npm start
```

### "Email not sending"
```bash
# Email is optional for development
# To enable:
# 1. Set EMAIL_USER and EMAIL_PASSWORD
# 2. Use Gmail app password (not regular password)
# 3. Check backend logs for errors
```

### "Seat hold not auto-releasing"
```bash
# Check if scheduler is running
# Should see in logs: "Scheduled: Expired seat release job (every minute)"

# Manually check database
psql ticket_booking
SELECT * FROM show_seats WHERE status = 'held' AND held_until < NOW();
# Should be empty (or run UPDATE to release)
```

## Next Steps

1. **Read the full README** for comprehensive API documentation
2. **Read SYSTEM_DESIGN.md** for architecture and design decisions
3. **Read DEPLOYMENT.md** for production deployment
4. **Explore the code** - all files are well-commented
5. **Customize** for your needs

## Commands Reference

```bash
# Backend
npm install          # Install dependencies
npm start            # Start production server
npm run dev          # Start with auto-reload

# Frontend
cd client
npm start            # Start React dev server
npm run build        # Build for production

# Database
createdb ticket_booking    # Create database
psql ticket_booking < server/db/schema.sql  # Load schema
psql ticket_booking        # Connect to database
```

## Key Features to Test

✅ User registration (customer, organiser, admin)  
✅ Event creation and browsing  
✅ Visual seat map with real-time status  
✅ Seat hold with 10-minute TTL  
✅ Concurrent seat selection prevention  
✅ Booking with QR code generation  
✅ Booking cancellation  
✅ Waitlist management  
✅ Email notifications  
✅ Role-based access control  

## Support

If you encounter issues:
1. Check the README.md for detailed documentation
2. Review SYSTEM_DESIGN.md for architecture explanations
3. Check server logs for error messages
4. Verify database connection and schema
5. Ensure all environment variables are set

## Success! 🎉

You should now have a fully functional ticket booking system running locally with all features:
- Seat holds with TTL and auto-release
- Concurrency-safe booking
- Waitlist with time-limited offers
- QR code tickets
- Email notifications
- Role-based access control

Happy booking! 🎫
