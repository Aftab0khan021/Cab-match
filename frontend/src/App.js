import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Badge } from './components/ui/badge';
import { MapPin, Car, Clock, Phone, User, Navigation, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Simple Map Component (using coordinates for MVP)
const SimpleMap = ({ center, markers = [], onLocationSelect }) => {
  const handleMapClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Simple coordinate mapping (for demo purposes)
    const lat = center.lat + (y - 200) / 1000;
    const lng = center.lng + (x - 200) / 1000;
    
    if (onLocationSelect) {
      onLocationSelect({ lat, lng });
    }
  };

  return (
    <div 
      className="w-full h-64 bg-green-100 border-2 border-green-200 rounded-lg relative cursor-crosshair"
      onClick={handleMapClick}
      data-testid="simple-map"
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <MapPin className="w-8 h-8 mx-auto mb-2 text-green-600" />
          <p className="text-sm text-green-700">Click to select location</p>
          <p className="text-xs text-green-600">Center: {center.lat.toFixed(4)}, {center.lng.toFixed(4)}</p>
        </div>
      </div>
      
      {markers.map((marker, index) => (
        <div
          key={index}
          className="absolute w-3 h-3 bg-red-500 rounded-full border-2 border-white"
          style={{
            left: `${200 + (marker.lng - center.lng) * 1000}px`,
            top: `${200 + (marker.lat - center.lat) * 1000}px`,
            transform: 'translate(-50%, -50%)'
          }}
        />
      ))}
    </div>
  );
};

// Authentication Component
const AuthScreen = ({ onLogin }) => {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [userType, setUserType] = useState('rider');
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!phone.trim()) {
      toast.error('Please enter your phone number');
      return;
    }

    setLoading(true);
    try {
      if (isRegistering) {
        // Registration
        const endpoint = userType === 'rider' ? '/auth/rider/register' : '/auth/driver/register';
        const payload = userType === 'rider' 
          ? { name, phone }
          : { name, phone, vehicle_no: vehicleNo };

        const response = await axios.post(`${API}${endpoint}`, payload);
        
        toast.success(`${userType} registered successfully!`);
        onLogin(response.data);
      } else {
        // Login
        const response = await axios.post(`${API}/auth/login?phone=${phone}`);
        toast.success('Login successful!');
        onLogin(response.data);
      }
    } catch (error) {
      if (error.response?.status === 404 && !isRegistering) {
        toast.error('User not found. Please register first.');
      } else if (error.response?.status === 400 && isRegistering) {
        toast.error('Phone number already registered. Try logging in.');
      } else {
        toast.error('An error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-50 p-4">
      <Card className="w-full max-w-md" data-testid="auth-card">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <Car className="w-8 h-8 text-emerald-600 mr-2" />
            <span className="text-2xl font-bold text-gray-800">CabMatch</span>
          </div>
          <CardTitle>{isRegistering ? 'Register' : 'Login'}</CardTitle>
          <CardDescription>
            {isRegistering ? 'Create your account' : 'Welcome back'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={userType} onValueChange={setUserType} className="mb-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="rider" data-testid="rider-tab">Rider</TabsTrigger>
              <TabsTrigger value="driver" data-testid="driver-tab">Driver</TabsTrigger>
            </TabsList>
          </Tabs>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegistering && (
              <div>
                <Input
                  type="text"
                  placeholder="Full Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  data-testid="name-input"
                />
              </div>
            )}
            
            <div>
              <Input
                type="tel"
                placeholder="Phone Number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                data-testid="phone-input"
              />
            </div>

            {isRegistering && userType === 'driver' && (
              <div>
                <Input
                  type="text"
                  placeholder="Vehicle Number"
                  value={vehicleNo}
                  onChange={(e) => setVehicleNo(e.target.value)}
                  required
                  data-testid="vehicle-input"
                />
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              disabled={loading}
              data-testid="auth-submit-btn"
            >
              {loading ? 'Processing...' : (isRegistering ? 'Register' : 'Login')}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setIsRegistering(!isRegistering)}
              className="text-emerald-600 hover:text-emerald-700 font-medium"
              data-testid="toggle-auth-mode"
            >
              {isRegistering ? 'Already have an account? Login' : "Don't have an account? Register"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Rider Dashboard
const RiderDashboard = ({ user, onLogout }) => {
  const [currentTrip, setCurrentTrip] = useState(null);
  const [tripHistory, setTripHistory] = useState([]);
  const [pickup, setPickup] = useState({ lat: 28.6139, lng: 77.2090 }); // Delhi coordinates
  const [dropoff, setDropoff] = useState(null);
  const [fareEstimate, setFareEstimate] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchTripHistory = async () => {
    try {
      const response = await axios.get(`${API}/riders/${user.user_id}/trips`);
      setTripHistory(response.data);
    } catch (error) {
      toast.error('Failed to fetch trip history');
    }
  };

  const getFareEstimate = async () => {
    if (!pickup || !dropoff) return;
    
    try {
      const response = await axios.get(`${API}/pricing/estimate`, {
        params: {
          pickup_lat: pickup.lat,
          pickup_lon: pickup.lng,
          dropoff_lat: dropoff.lat,
          dropoff_lon: dropoff.lng
        }
      });
      setFareEstimate(response.data);
    } catch (error) {
      toast.error('Failed to get fare estimate');
    }
  };

  const requestTrip = async () => {
    if (!pickup || !dropoff) {
      toast.error('Please select pickup and dropoff locations');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API}/trips/request`, {
        rider_id: user.user_id,
        pickup_latitude: pickup.lat,
        pickup_longitude: pickup.lng,
        dropoff_latitude: dropoff.lat,
        dropoff_longitude: dropoff.lng
      });
      
      setCurrentTrip(response.data);
      toast.success('Trip requested! Looking for nearby drivers...');
    } catch (error) {
      toast.error('Failed to request trip');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTripHistory();
  }, []);

  useEffect(() => {
    if (pickup && dropoff) {
      getFareEstimate();
    }
  }, [pickup, dropoff]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Car className="w-8 h-8 text-emerald-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">CabMatch</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant="outline" className="px-3 py-1">
                <User className="w-4 h-4 mr-1" />
                Rider
              </Badge>
              <Button variant="ghost" onClick={onLogout} data-testid="logout-btn">
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Trip Request Section */}
          <div className="space-y-6">
            <Card data-testid="trip-request-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Navigation className="w-5 h-5 mr-2 text-emerald-600" />
                  Request a Ride
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Pickup Location</label>
                  <SimpleMap 
                    center={pickup} 
                    markers={[pickup]}
                    onLocationSelect={setPickup}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Selected: {pickup.lat.toFixed(4)}, {pickup.lng.toFixed(4)}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Dropoff Location</label>
                  <SimpleMap 
                    center={pickup} 
                    markers={dropoff ? [dropoff] : []}
                    onLocationSelect={setDropoff}
                  />
                  {dropoff && (
                    <p className="text-xs text-gray-500 mt-1">
                      Selected: {dropoff.lat.toFixed(4)}, {dropoff.lng.toFixed(4)}
                    </p>
                  )}
                </div>

                {fareEstimate && (
                  <Card className="bg-emerald-50 border-emerald-200">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Estimated Fare</span>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-emerald-600">
                            ₹{fareEstimate.estimated_fare.toFixed(0)}
                          </div>
                          <div className="text-sm text-gray-600">
                            {fareEstimate.distance_km.toFixed(1)} km
                            {fareEstimate.surge_factor > 1 && (
                              <Badge variant="secondary" className="ml-2">
                                {fareEstimate.surge_factor.toFixed(1)}x surge
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Button 
                  onClick={requestTrip}
                  disabled={!pickup || !dropoff || loading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                  data-testid="request-trip-btn"
                >
                  {loading ? 'Requesting...' : 'Request Trip'}
                </Button>
              </CardContent>
            </Card>

            {/* Current Trip Status */}
            {currentTrip && (
              <Card className="border-emerald-200 bg-emerald-50" data-testid="current-trip-card">
                <CardHeader>
                  <CardTitle className="text-emerald-800">Current Trip</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Status:</span>
                      <Badge variant={
                        currentTrip.status === 'completed' ? 'default' : 
                        currentTrip.status === 'ongoing' ? 'secondary' : 'outline'
                      }>
                        {currentTrip.status}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Trip ID:</span>
                      <span className="font-mono text-sm">{currentTrip.id.slice(0, 8)}...</span>
                    </div>
                    {currentTrip.driver_id && (
                      <div className="flex justify-between">
                        <span>Driver Assigned:</span>
                        <span className="text-emerald-600">✓</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Trip History */}
          <div>
            <Card data-testid="trip-history-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="w-5 h-5 mr-2 text-gray-600" />
                  Recent Trips
                </CardTitle>
              </CardHeader>
              <CardContent>
                {tripHistory.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No trips yet</p>
                ) : (
                  <div className="space-y-4">
                    {tripHistory.slice(0, 5).map((trip) => (
                      <div key={trip.id} className="border rounded-lg p-3 hover:bg-gray-50">
                        <div className="flex justify-between items-start">
                          <div>
                            <Badge variant={
                              trip.status === 'completed' ? 'default' : 
                              trip.status === 'ongoing' ? 'secondary' : 'outline'
                            } className="mb-2">
                              {trip.status}
                            </Badge>
                            <p className="text-sm text-gray-600">
                              {new Date(trip.requested_at).toLocaleDateString()}
                            </p>
                          </div>
                          {trip.fare && (
                            <div className="text-right">
                              <div className="font-semibold">₹{trip.fare.toFixed(0)}</div>
                              <div className="text-sm text-gray-500">
                                {trip.distance_km?.toFixed(1)} km
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

// Driver Dashboard
const DriverDashboard = ({ user, onLogout }) => {
  const [driver, setDriver] = useState(null);
  const [trips, setTrips] = useState([]);
  const [location, setLocation] = useState({ lat: 28.6139, lng: 77.2090 });
  const [status, setStatus] = useState('offline');

  const fetchDriverData = async () => {
    try {
      const response = await axios.get(`${API}/drivers/${user.user_id}`);
      setDriver(response.data);
      setStatus(response.data.status);
      if (response.data.location) {
        setLocation({
          lat: response.data.location.coordinates[1],
          lng: response.data.location.coordinates[0]
        });
      }
    } catch (error) {
      toast.error('Failed to fetch driver data');
    }
  };

  const fetchTrips = async () => {
    try {
      const response = await axios.get(`${API}/drivers/${user.user_id}/trips`);
      setTrips(response.data);
    } catch (error) {
      toast.error('Failed to fetch trips');
    }
  };

  const updateLocation = async (newLocation) => {
    try {
      await axios.put(`${API}/drivers/${user.user_id}/location`, {
        latitude: newLocation.lat,
        longitude: newLocation.lng
      });
      setLocation(newLocation);
      toast.success('Location updated');
    } catch (error) {
      toast.error('Failed to update location');
    }
  };

  const updateStatus = async (newStatus) => {
    try {
      await axios.put(`${API}/drivers/${user.user_id}/status?status=${newStatus}`);
      setStatus(newStatus);
      toast.success(`Status changed to ${newStatus}`);
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  useEffect(() => {
    fetchDriverData();
    fetchTrips();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Car className="w-8 h-8 text-orange-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">CabMatch Driver</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant="outline" className="px-3 py-1">
                <User className="w-4 h-4 mr-1" />
                Driver
              </Badge>
              <Button variant="ghost" onClick={onLogout} data-testid="logout-btn">
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Driver Status & Location */}
          <div className="space-y-6">
            <Card data-testid="driver-status-card">
              <CardHeader>
                <CardTitle>Driver Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Current Status:</span>
                  <Badge variant={
                    status === 'available' ? 'default' : 
                    status === 'on_trip' ? 'secondary' : 'outline'
                  }>
                    {status}
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant={status === 'available' ? 'default' : 'outline'}
                    onClick={() => updateStatus('available')}
                    className="text-sm"
                    data-testid="status-available-btn"
                  >
                    Available
                  </Button>
                  <Button
                    variant={status === 'offline' ? 'default' : 'outline'}
                    onClick={() => updateStatus('offline')}
                    className="text-sm"
                    data-testid="status-offline-btn"
                  >
                    Offline
                  </Button>
                  <Button
                    variant="outline"
                    disabled={status !== 'on_trip'}
                    className="text-sm"
                  >
                    On Trip
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="location-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MapPin className="w-5 h-5 mr-2 text-orange-600" />
                  Update Location
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SimpleMap 
                  center={location}
                  markers={[location]}
                  onLocationSelect={updateLocation}
                />
                <p className="text-xs text-gray-500 mt-2">
                  Current: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Earnings & Trip History */}
          <div className="space-y-6">
            <Card data-testid="earnings-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <DollarSign className="w-5 h-5 mr-2 text-green-600" />
                  Today's Earnings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">
                    ₹{trips
                      .filter(trip => trip.status === 'completed' && trip.fare)
                      .reduce((sum, trip) => sum + trip.fare, 0)
                      .toFixed(0)}
                  </div>
                  <p className="text-gray-600">{trips.filter(trip => trip.status === 'completed').length} completed trips</p>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="driver-trips-card">
              <CardHeader>
                <CardTitle>Recent Trips</CardTitle>
              </CardHeader>
              <CardContent>
                {trips.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No trips yet</p>
                ) : (
                  <div className="space-y-4">
                    {trips.slice(0, 5).map((trip) => (
                      <div key={trip.id} className="border rounded-lg p-3 hover:bg-gray-50">
                        <div className="flex justify-between items-start">
                          <div>
                            <Badge variant={
                              trip.status === 'completed' ? 'default' : 
                              trip.status === 'ongoing' ? 'secondary' : 'outline'
                            } className="mb-2">
                              {trip.status}
                            </Badge>
                            <p className="text-sm text-gray-600">
                              {new Date(trip.requested_at).toLocaleDateString()}
                            </p>
                          </div>
                          {trip.fare && (
                            <div className="text-right">
                              <div className="font-semibold text-green-600">₹{trip.fare.toFixed(0)}</div>
                              <div className="text-sm text-gray-500">
                                {trip.distance_km?.toFixed(1)} km
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main App Component
function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in (from localStorage)
    const savedUser = localStorage.getItem('cabmatch_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (error) {
        localStorage.removeItem('cabmatch_user');
      }
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('cabmatch_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('cabmatch_user');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Car className="w-12 h-12 mx-auto mb-4 text-emerald-600 animate-pulse" />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            !user ? (
              <AuthScreen onLogin={handleLogin} />
            ) : user.user_type === 'rider' ? (
              <RiderDashboard user={user} onLogout={handleLogout} />
            ) : (
              <DriverDashboard user={user} onLogout={handleLogout} />
            )
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;