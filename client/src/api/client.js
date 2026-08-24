import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle errors
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (data) => client.post('/auth/register', data),
  login: (email, password) => client.post('/auth/login', { email, password }),
  getProfile: () => client.get('/auth/profile'),
};

export const eventsAPI = {
  getAll: (params) => client.get('/events', { params }),
  getById: (id) => client.get(`/events/${id}`),
  create: (data) => client.post('/events', data),
  getShows: (eventId) => client.get(`/events/${eventId}/shows`),
  getShowDetails: (eventId, showId) => client.get(`/events/${eventId}/shows/${showId}`),
  createShow: (eventId, data) => client.post(`/events/${eventId}/shows`, data),
};

export const bookingsAPI = {
  holdSeat: (showId, seatId) => client.post('/bookings/hold-seat', { show_id: showId, seat_id: seatId }),
  releaseSeat: (showId, seatId) => client.post('/bookings/release-seat', { show_id: showId, seat_id: seatId }),
  create: (showId, seatIds) => client.post('/bookings', { show_id: showId, seat_ids: seatIds }),
  getMyBookings: () => client.get('/bookings/my-bookings'),
  cancel: (bookingId) => client.post(`/bookings/${bookingId}/cancel`),
  joinWaitlist: (showId, seatCategoryId) => client.post('/bookings/waitlist/join', { show_id: showId, seat_category_id: seatCategoryId }),
  getWaitlistPosition: (showId, categoryId) => client.get(`/bookings/waitlist/position/${showId}/${categoryId}`),
  completeWaitlistBooking: (offerToken) => client.post(`/bookings/waitlist/complete/${offerToken}`),
};

export const venuesAPI = {
  getAll: () => client.get('/venues'),
  getById: (id) => client.get(`/venues/${id}`),
  create: (data) => client.post('/venues', data),
};

export default client;
