import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';

function ShowDetailsPage() {
  const { eventId, showId } = useParams();
  const [show, setShow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSeats, setSelectedSeats] = useState([]);
  const navigate = useNavigate();

  const fetchShowDetails = useCallback(async () => {
    try {
      const data = await api.getShowDetails(eventId, showId);
      setShow(data);
    } catch (err) {
      setError('Failed to load show details');
    } finally {
      setLoading(false);
    }
  }, [eventId, showId]);

  useEffect(() => {
    fetchShowDetails();
  }, [fetchShowDetails]);

  const handleSeatSelect = (seatNumber) => {
    setSelectedSeats(prev => 
      prev.includes(seatNumber) 
        ? prev.filter(s => s !== seatNumber)
        : [...prev, seatNumber]
    );
  };

  const handleBooking = async () => {
    try {
      await api.bookSeats(eventId, showId, selectedSeats);
      navigate('/bookings');
    } catch (err) {
      setError('Booking failed: ' + err.message);
    }
  };

  if (loading) return <div style={{ padding: '20px' }}>Loading show details...</div>;
  if (error) return <div style={{ padding: '20px', color: 'red' }}>{error}</div>;
  if (!show) return <div style={{ padding: '20px' }}>Show not found</div>;

  return (
    <div style={{ padding: '20px' }}>
      <h2>{show.event_name}</h2>
      <p>📅 {new Date(show.date).toLocaleString()}</p>
      <p>🎭 {show.venue}</p>
      
      <div style={{ marginTop: '30px' }}>
        <h3>Select Your Seats</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '10px', maxWidth: '400px' }}>
          {show.available_seats && show.available_seats.map((seat) => (
            <button
              key={seat}
              onClick={() => handleSeatSelect(seat)}
              style={{
                padding: '10px',
                backgroundColor: selectedSeats.includes(seat) ? '#3498db' : '#ecf0f1',
                border: '1px solid #bdc3c7',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              {seat}
            </button>
          ))}
        </div>
        
        {selectedSeats.length > 0 && (
          <div style={{ marginTop: '20px' }}>
            <p>Selected seats: {selectedSeats.join(', ')}</p>
            <button
              onClick={handleBooking}
              style={{
                padding: '10px 20px',
                backgroundColor: '#2ecc71',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Book Selected Seats (${selectedSeats.length * (show.price || 0)})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ShowDetailsPage;