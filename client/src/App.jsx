import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navigation from './components/Navigation';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import EventsPage from './pages/EventsPage';
import ShowDetailsPage from './pages/ShowDetailsPage';
import BookingsPage from './pages/BookingsPage';
import AdminPanel from './pages/AdminPanel';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (token && userData) {
      setUser(JSON.parse(userData));
    }
    setLoading(false);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <BrowserRouter>
      <Navigation user={user} onLogout={handleLogout} />
      <Routes>
        <Route path="/" element={user ? <EventsPage /> : <LoginPage />} />
        <Route
          path="/login"
          element={user ? <Navigate to="/" /> : <LoginPage />}
        />
        <Route
          path="/register"
          element={user ? <Navigate to="/" /> : <RegisterPage />}
        />
        <Route
          path="/events"
          element={user ? <EventsPage /> : <Navigate to="/login" />}
        />
        <Route
          path="/shows/:eventId/:showId"
          element={user ? <ShowDetailsPage /> : <Navigate to="/login" />}
        />
        <Route
          path="/bookings"
          element={user && user.role === 'customer' ? <BookingsPage /> : <Navigate to="/" />}
        />
        <Route
          path="/admin"
          element={user && (user.role === 'admin' || user.role === 'organiser') ? <AdminPanel /> : <Navigate to="/" />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
