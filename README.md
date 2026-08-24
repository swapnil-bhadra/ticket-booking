# 🎫 Ticket Booking System

A production-ready ticket booking platform for movies and concerts with real-time seat availability, automatic hold expiry, waitlist management, and QR code ticket delivery.

## 📋 Features

### Core Features
- **Visual Seat Map**: Interactive 2D seat layout with real-time status updates
- **Seat Holds with TTL**: Configurable hold duration (default 10 minutes) with automatic expiry
- **Concurrency Protection**: Atomic transactions ensure no race conditions on seat selection
- **Waitlist Management**: Auto-assignment when bookings are cancelled
- **QR Code Tickets**: Automatic generation and email delivery
- **Multi-Role System**: Customer, Organiser, and Admin roles with permission controls

### Advanced Features
- **Real-time Seat Status**: Available, Held, Booked statuses with live updates
- **Time-Limited Offers**: Waitlisted customers get 1-hour window to complete booking
- **Booking History**: Customers can view and cancel past bookings
- **Revenue Analytics**: Organisers can view booking summary and revenue per event
- **Audit Logging**: Complete transaction history for all seat operations

## 🏗️ Architecture

### Technology Stack
- **Backend**: Node.js + Express.js
- **Database**: PostgreSQL (for ACID transactions)
- **Authentication**: JWT + bcrypt
- **Email**: Nodemailer (Gmail SMTP)
- **QR Codes**: qrcode library
- **Scheduling**: node-cron (background jobs)

### Database Schema

#### Core Tables
- **users**: Customer, Organiser, Admin accounts
- **venues**: Venues with seat layout
- **seat_categories**: Premium, Standard, Economy pricing tiers
- **seats**: Individual seats with row/col positioning
- **events**: Movies/concerts with date, time, venue
- **shows**: Specific screening/performance of an event

#### Transaction Tables
- **show_seats**: Per-show seat status (available/held/booked)
- **bookings**: Confirmed reservations
- **booking_items**: Individual seats in a booking
- **waitlist**: Queue for sold-out categories
- **audit_log**: Complete transaction history

### Key Design Patterns

#### 1. Seat Hold TTL Enforcement
```
Flow:
1. Customer holds seat → UPDATE show_seats SET status='held', held_until=NOW()+TTL
2. Scheduler runs every minute → SELECT * FROM show_seats WHERE held_until < NOW()
3. Auto-release: UPDATE status='available', held_by=NULL, held_until=NULL
4. Database indexes on held_until for efficient expiry detection
```

#### 2. Concurrency Protection
```
Atomic Operations:
- BEGIN TRANSACTION
- SELECT FOR UPDATE (row-level lock)
- Verify current status == 'available'
- UPDATE status to 'held' or 'booked'
- ROLLBACK on conflicts
- Only one customer succeeds per seat

Prevents race condition where two customers book same seat
```

#### 3. Waitlist Auto-Assignment
```
On Booking Cancellation:
1. Identify cancelled seats and their categories
2. Query waitlist: SELECT * WHERE status='waiting' ORDER BY position LIMIT 1
3. Update waitlist entry: SET status='offered', offer_token=UUID, offer_expires_at=NOW()+1hr
4. Send email with time-limited booking link
5. On customer click: Auto-book seat, reposition remaining waitlist customers
6. If offer expires: Reassign to next in line
```

#### 4. Time-Limited Offer Flow
```
Timeline:
- T=0: Booking cancelled, offer sent to customer #1
- T=59min: Offer still valid, customer can click link
- T=60min: Job detects expired offer, reassigns to customer #2, send email
- T=121min: Customer #1 tries to use expired token → 400 error
```

## 🚀 Setup Guide

### Prerequisites
- Node.js 16+ and npm
- PostgreSQL 12+
- Gmail account with App Password (for email)

### Installation

1. **Clone and install dependencies**
```bash
cd ticket-booking-system
npm install
```

2. **Setup database**
```bash
# Create database
createdb ticket_booking

# Run schema
psql ticket_booking < server/db/schema.sql
```

3. **Configure environment**
```bash
cp .env.example .env

# Edit .env with your values:
DB_HOST=localhost
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=ticket_booking
JWT_SECRET=your-secret-key-here
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
CLIENT_URL=http://localhost:3000
SEAT_HOLD_TTL=10
```

4. **Start server**
```bash
npm start
# Or for development with auto-reload:
npm run dev
```

Server runs on `http://localhost:5000`

## 📡 API Documentation

### Authentication

#### Register
```
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepass123",
  "name": "John Doe",
  "role": "customer" // customer, organiser, admin
}

Response:
{
  "user": { "id": "uuid", "email": "...", "name": "...", "role": "..." },
  "token": "eyJhbGc..."
}
```

#### Login
```
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "securepass123"
}

Response: { "user": {...}, "token": "..." }
```

#### Get Profile
```
GET /api/auth/profile
Authorization: Bearer <token>

Response: { "id": "...", "email": "...", "name": "...", "role": "..." }
```

### Events

#### Create Event (Organiser)
```
POST /api/events
Authorization: Bearer <token>
{
  "title": "Avengers Endgame",
  "description": "Action-packed superhero film",
  "type": "movie",
  "venue_id": "uuid",
  "event_date": "2024-12-25",
  "event_time": "19:00:00",
  "poster_url": "https://..."
}
```

#### Get All Events
```
GET /api/events?type=movie&city=Mumbai&date=2024-12-25
```

#### Get Event Details
```
GET /api/events/{eventId}
```

#### Create Show (Organiser)
```
POST /api/events/{eventId}/shows
Authorization: Bearer <token>
{
  "show_time": "2024-12-25T19:00:00Z"
}
```

#### Get Show with Seat Map
```
GET /api/events/{eventId}/shows/{showId}

Response:
{
  "show": { "id": "...", "event_id": "...", "status": "available", ... },
  "seats": [
    {
      "id": "show_seat_id",
      "status": "available", // or "held", "booked"
      "seat_number": "A1",
      "row_num": 1,
      "col_num": 1,
      "category": "Premium",
      "price": 500
    }
  ]
}
```

### Bookings & Seats

#### Hold Seat (10 min TTL)
```
POST /api/bookings/hold-seat
Authorization: Bearer <token>
{
  "show_id": "uuid",
  "seat_id": "uuid"
}

Response:
{
  "success": true,
  "seat": {
    "id": "...",
    "status": "held",
    "held_by": "customer_id",
    "held_until": "2024-01-01T12:10:00Z"
  }
}
```

#### Release Held Seat
```
POST /api/bookings/release-seat
Authorization: Bearer <token>
{
  "show_id": "uuid",
  "seat_id": "uuid"
}
```

#### Create Booking
```
POST /api/bookings
Authorization: Bearer <token>
{
  "show_id": "uuid",
  "seat_ids": ["uuid1", "uuid2"]
}

Response:
{
  "booking": {
    "id": "booking_id",
    "booking_reference": "BK1704067200000",
    "status": "confirmed",
    "total_price": 1000,
    "qrCodeUrl": "data:image/png;base64,..."
  },
  "bookingItems": [...]
}

→ Automatically sends confirmation email with QR code
```

#### Get My Bookings
```
GET /api/bookings/my-bookings
Authorization: Bearer <token>

Response: [
  {
    "booking_reference": "BK1704067200000",
    "event_title": "Avengers",
    "event_date": "2024-12-25",
    "show_time": "2024-12-25T19:00:00Z",
    "status": "confirmed",
    "total_price": 1000,
    "items": [
      { "seat_number": "A1", "category": "Premium", "price": 500 }
    ]
  }
]
```

#### Cancel Booking
```
POST /api/bookings/{bookingId}/cancel
Authorization: Bearer <token>

Response: { "success": true, "message": "Booking cancelled successfully" }

→ Automatically offers seat to next waitlist customer
→ Sends cancellation email with refund details
```

### Waitlist

#### Join Waitlist (when sold out)
```
POST /api/bookings/waitlist/join
Authorization: Bearer <token>
{
  "show_id": "uuid",
  "seat_category_id": "uuid"
}

Response:
{
  "id": "waitlist_entry_id",
  "position": 3,
  "status": "waiting"
}
```

#### Get Waitlist Position
```
GET /api/bookings/waitlist/position/{showId}/{categoryId}
Authorization: Bearer <token>

Response: { "position": 3, "status": "waiting" }
```

#### Complete Waitlist Booking (via email link)
```
POST /api/bookings/waitlist/complete/{offerToken}

Response:
{
  "success": true,
  "result": {
    "showSeatId": "...",
    "status": "booked"
  }
}

→ No auth needed (token-based)
→ Automatically reassigns to next customer if declined
```

### Venues (Admin)

#### Create Venue
```
POST /api/venues
Authorization: Bearer <admin-token>
{
  "name": "Inox Cinema",
  "city": "Mumbai",
  "capacity": 500,
  "categories": [
    { "name": "Premium", "price": 500 },
    { "name": "Standard", "price": 300 }
  ],
  "seats": [
    { "number": "A1", "row": 1, "col": 1, "category": "Premium" },
    { "number": "A2", "row": 1, "col": 2, "category": "Standard" }
  ]
}
```

#### Get All Venues
```
GET /api/venues
```

#### Get Venue Details
```
GET /api/venues/{venueId}
```

## 🔒 Concurrency & Race Condition Prevention

### Problem: Two Customers Booking Same Seat Simultaneously

### Solution: Database-Level Locking
```sql
-- Atomic hold operation
BEGIN;
SELECT id, status FROM show_seats 
  WHERE show_id = $1 AND seat_id = $2 
  FOR UPDATE;  -- Row-level lock, blocks concurrent attempts

-- Check status
IF status = 'available' THEN
  UPDATE show_seats 
    SET status = 'held', held_by = $3, held_until = NOW() + INTERVAL '10 minutes'
    WHERE id = $4;
  COMMIT;
ELSE
  ROLLBACK;  -- Seat was taken by another transaction
END IF;
```

### Testing Concurrency
```javascript
// Two customers attempt to hold same seat
const promises = [
  holdSeat(showId, seatId, customer1Id, 10),
  holdSeat(showId, seatId, customer2Id, 10)
];

const results = await Promise.all(promises);
// Only one succeeds, other throws error: "Seat is held and cannot be held"
```

## ⏱️ Seat Hold TTL & Auto-Release Mechanism

### TTL Lifecycle
```
1. Hold Created: held_until = NOW() + 10 minutes
2. Stored in DB: show_seats.held_until = '2024-01-01 12:10:00'
3. Checkout Abandonment: User navigates away, hold persists
4. Scheduler Runs (every minute):
   - Query: SELECT * FROM show_seats WHERE held_until < NOW()
   - Update: SET status = 'available', held_by = NULL
5. Seat Released: Becomes available for other customers
```

### Scheduler Configuration
```javascript
// runs/scheduler/jobs.js
cron.schedule('* * * * *', async () => {
  const releasedCount = await releaseExpiredSeats();
  console.log(`Released ${releasedCount} seats`);
});
```

### Index for Performance
```sql
CREATE INDEX idx_show_seats_held_until 
  ON show_seats(held_until) 
  WHERE status = 'held';
```

## 📧 Email Configuration

### Gmail Setup
1. Enable 2FA on Google Account
2. Generate App Password (not regular password)
3. Add to .env:
```
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=xxxx xxxx xxxx xxxx  (from app password)
EMAIL_FROM=noreply@ticketbooking.com
```

### Email Templates
- **Booking Confirmation**: Includes QR code, seat details, total price
- **Waitlist Offer**: Time-limited link valid for 1 hour
- **Cancellation**: Refund details and timeline

## 📊 Monitoring & Logging

### Audit Trail
All seat transactions logged to `audit_log` table:
```sql
SELECT action, user_id, previous_status, new_status, created_at
FROM audit_log
WHERE show_seat_id = $1
ORDER BY created_at DESC;

-- Output: hold, hold, release, book
```

### Performance Indexes
```sql
-- Seat status queries
CREATE INDEX idx_show_seats_status ON show_seats(status);

-- Hold expiry detection
CREATE INDEX idx_show_seats_held_until ON show_seats(held_until) WHERE status = 'held';

-- Waitlist queries
CREATE INDEX idx_waitlist_show ON waitlist(show_id);
CREATE INDEX idx_waitlist_status ON waitlist(status);

-- Booking lookups
CREATE INDEX idx_bookings_customer ON bookings(customer_id);
CREATE INDEX idx_bookings_show ON bookings(show_id);
```

## 🧪 Test Scenarios

### Scenario 1: Concurrent Seat Selection
```
1. Open show in 2 browser tabs
2. Select same seat in both tabs
3. First user clicks "Hold Seat"
4. Second user clicks "Hold Seat" → Error: "Seat is held"
```

### Scenario 2: Hold TTL Expiry
```
1. Hold seat (TTL=10 min)
2. Wait 10+ minutes
3. Scheduler auto-releases
4. Check seat status → 'available'
```

### Scenario 3: Waitlist Auto-Assignment
```
1. Event sold out, join waitlist (position=1)
2. Customer #1 cancels booking
3. Receive email: "Seat available! Complete booking within 1 hour"
4. Click link in email
5. Seat auto-booked, position updated
6. Customer #2 receives new offer email
```

## 📱 API Response Codes

```
200 OK - Request succeeded
201 Created - Resource created successfully
400 Bad Request - Invalid input or business logic error
401 Unauthorized - Missing/invalid token
403 Forbidden - Insufficient permissions
404 Not Found - Resource doesn't exist
500 Server Error - Internal error
```

## 🔄 Future Enhancements

- Payment gateway integration (Stripe/Razorpay)
- Dynamic pricing based on demand
- Partial cancellation (cancel some seats)
- Bulk ticket operations for admins
- Analytics dashboard with revenue charts
- Mobile app (React Native)
- Notification system (SMS + Email)
- Resale marketplace for tickets

## 📝 License

MIT

## 🤝 Support

For issues or questions, open a GitHub issue or contact support@ticketbooking.com
