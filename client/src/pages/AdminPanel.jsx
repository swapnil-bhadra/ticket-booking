import React, { useState, useEffect } from 'react';
import api from '../api/client';

function AdminPanel() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      const data = await api.getAdminEvents();
      setEvents(data);
    } catch (err) {
      setError('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{ padding: '20px' }}>Loading admin panel...</div>;
  if (error) return <div style={{ padding: '20px', color: 'red' }}>{error}</div>;

  return (
    <div style={{ padding: '20px' }}>
      <h2>Admin Panel</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
        {events.map((event) => (
          <div
            key={event.id}
            style={{
              border: '1px solid #ddd',
              borderRadius: '8px',
              padding: '15px',
              backgroundColor: 'white',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
          >
            <h3>{event.name}</h3>
            <p>{event.description}</p>
            <p>📅 {new Date(event.date).toLocaleDateString()}</p>
            <p>📍 {event.venue}</p>
            <p>🎟️ Total Shows: {event.shows_count || 0}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AdminPanel;