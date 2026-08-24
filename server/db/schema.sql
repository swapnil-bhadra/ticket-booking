-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'customer', -- customer, organiser, admin
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Venues table
CREATE TABLE venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  city VARCHAR(255) NOT NULL,
  capacity INT NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seat categories
CREATE TABLE seat_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL, -- Premium, Standard, Economy
  price DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Venue seats (physical layout)
CREATE TABLE seats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  seat_number VARCHAR(10) NOT NULL, -- e.g., A1, A2, B1
  row_num INT NOT NULL,
  col_num INT NOT NULL,
  category_id UUID NOT NULL REFERENCES seat_categories(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(venue_id, seat_number)
);

-- Events (movies/concerts)
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL, -- movie, concert
  venue_id UUID NOT NULL REFERENCES venues(id),
  organiser_id UUID NOT NULL REFERENCES users(id),
  event_date DATE NOT NULL,
  event_time TIME NOT NULL,
  poster_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_event_date (event_date)
);

-- Show (specific screening/performance of an event at a venue)
CREATE TABLE shows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES venues(id),
  show_time TIMESTAMP NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'available', -- available, sold_out, cancelled
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_show_time (show_time)
);

-- Seat status per show
CREATE TABLE show_seats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  seat_id UUID NOT NULL REFERENCES seats(id),
  status VARCHAR(50) NOT NULL DEFAULT 'available', -- available, held, booked
  held_by UUID REFERENCES users(id),
  held_until TIMESTAMP,
  booked_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(show_id, seat_id),
  INDEX idx_status (status),
  INDEX idx_held_until (held_until)
);

-- Bookings
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_reference VARCHAR(20) UNIQUE NOT NULL,
  customer_id UUID NOT NULL REFERENCES users(id),
  show_id UUID NOT NULL REFERENCES shows(id),
  total_price DECIMAL(10, 2) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'confirmed', -- confirmed, cancelled
  payment_status VARCHAR(50) NOT NULL DEFAULT 'paid',
  qr_code_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  cancelled_at TIMESTAMP,
  INDEX idx_customer (customer_id),
  INDEX idx_booking_ref (booking_reference)
);

-- Booking items (seats in a booking)
CREATE TABLE booking_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  show_seat_id UUID NOT NULL REFERENCES show_seats(id),
  seat_id UUID NOT NULL REFERENCES seats(id),
  price DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Waitlist
CREATE TABLE waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES users(id),
  seat_category_id UUID NOT NULL REFERENCES seat_categories(id),
  position INT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'waiting', -- waiting, offered, expired, booked
  offer_token VARCHAR(100) UNIQUE,
  offer_expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_show_category (show_id, seat_category_id),
  INDEX idx_customer (customer_id),
  INDEX idx_status (status)
);

-- Audit log for seat transactions
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  show_seat_id UUID NOT NULL REFERENCES show_seats(id),
  action VARCHAR(50) NOT NULL, -- hold, release, book, cancel
  user_id UUID REFERENCES users(id),
  previous_status VARCHAR(50),
  new_status VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_action (action),
  INDEX idx_created_at (created_at)
);

-- Indexes for performance
CREATE INDEX idx_show_seats_held_until ON show_seats(held_until) WHERE status = 'held';
CREATE INDEX idx_shows_event ON shows(event_id);
CREATE INDEX idx_events_organiser ON events(organiser_id);
CREATE INDEX idx_bookings_show ON bookings(show_id);
CREATE INDEX idx_waitlist_show ON waitlist(show_id);
CREATE INDEX idx_seats_venue ON seats(venue_id);
