import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

function Navigation() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <nav style={{
      padding: '1rem 2rem',
      backgroundColor: '#2c3e50',
      color: 'white',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }}>
      <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
        <h2 style={{ margin: 0, color: 'white' }}>
          <Link to="/" style={{ color: 'white', textDecoration: 'none' }}>
            🎟️ Ticket Booking
          </Link>
        </h2>
        {token && (
          <div style={{ display: 'flex', gap: '15px' }}>
            <Link to="/events" style={{ color: 'white', textDecoration: 'none' }}>
              Events
            </Link>
            <Link to="/bookings" style={{ color: 'white', textDecoration: 'none' }}>
              My Bookings
            </Link>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
        {token ? (
          <>
            <span>👋 {user?.name || 'User'}</span>
            <button
              onClick={handleLogout}
              style={{
                padding: '8px 16px',
                backgroundColor: '#e74c3c',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login" style={{ color: 'white', textDecoration: 'none' }}>
              Login
            </Link>
            <Link to="/register" style={{ color: 'white', textDecoration: 'none' }}>
              Register
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}

export default Navigation;