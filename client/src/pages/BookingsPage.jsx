import React, { useState, useEffect } from 'react';
import api from '../api/client';

function BookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      const data = await api.getBookings();
      setBookings(data);
    } catch (err) {
      setError('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{ padding: '20px' }}>Loading bookings...</div>;
  if (error) return <div style={{ padding: '20px', color: 'red' }}>{error}</div>;

  return (
    <div style={{ padding: '20px' }}>
      <h2>My Bookings</h2>
      {bookings.length === 0 ? (
        <p>No bookings yet. Start booking tickets!</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {bookings.map((booking) => (
            <div
              key={booking.id}
              style={{
                border: '1px solid #ddd',
                borderRadius: '8px',
                padding: '15px',
                backgroundColor: 'white',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
            >
              <h3>{booking.event_name}</h3>
              <p>📅 {new Date(booking.show_date).toLocaleString()}</p>
              <p>Seats: {booking.seats.join(', ')}</p>
              <p>Status: <span style={{ fontWeight: 'bold', color: booking.status === 'confirmed' ? 'green' : 'orange' }}>{booking.status}</span></p>
              <p>Total: ${booking.total_price}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default BookingsPage;