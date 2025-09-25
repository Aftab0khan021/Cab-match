import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Badge } from './components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './components/ui/dialog';
import { Avatar, AvatarFallback } from './components/ui/avatar';
import { Separator } from './components/ui/separator';
import { 
  MapPin, Car, Clock, Phone, User, Navigation, DollarSign, 
  Star, MessageCircle, Shield, Heart, Zap, 
  Navigation2, AlertCircle, Menu, X, RefreshCw,
  PhoneCall, StarIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { Toaster } from './components/ui/sonner';
import axios from 'axios';

// Leaflet imports
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Custom icons for different marker types
const createCustomIcon = (color, icon) => L.divIcon({
  html: `<div style="background: ${color}; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="${icon}"/></svg></div>`,
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const pickupIcon = createCustomIcon('#10b981', 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z');
const dropoffIcon = createCustomIcon('#ef4444', 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z');
const driverIcon = createCustomIcon('#f59e0b', 'M19 17h-2v-2h2v2zm-3-4V6H4V5c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2v8h-2z');

// Interactive Map Component
const InteractiveMap = ({ center, markers = [], onLocationSelect, height = "300px", showDrivers = false, trip = null }) => {
  const [selectedLocation, setSelectedLocation] = useState(null);

  const LocationMarker = () => {
    useMapEvents({
      click(e) {
        const { lat, lng } = e.latlng;
        setSelectedLocation({ lat, lng });
        if (onLocationSelect) {
          onLocationSelect({ lat, lng });
        }
      },
    });

    return selectedLocation === null ? null : (
      <Marker position={[selectedLocation.lat, selectedLocation.lng]} icon={pickupIcon}>
        <Popup>
          <div className="text-sm">
            <strong>Selected Location</strong><br/>
            Lat: {selectedLocation.lat.toFixed(4)}<br/>
            Lng: {selectedLocation.lng.toFixed(4)}
          </div>
        </Popup>
      </Marker>
    );
  };

  return (
    <div className="relative rounded-lg overflow-hidden border-2 border-emerald-200 shadow-lg" style={{ height }}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {onLocationSelect && <LocationMarker />}
        
        {/* Existing markers */}
        {markers.map((marker, index) => (
          <Marker 
            key={index} 
            position={[marker.lat, marker.lng]} 
            icon={marker.type === 'pickup' ? pickupIcon : marker.type === 'dropoff' ? dropoffIcon : driverIcon}
          >
            <Popup>
              <div className="text-sm">
                <strong>{marker.type === 'pickup' ? 'Pickup' : marker.type === 'dropoff' ? 'Dropoff' : 'Driver'}</strong><br/>
                {marker.info && <span>{marker.info}</span>}
              </div>
            </Popup>
          </Marker>
        ))}
        
        {/* Trip route visualization */}
        {trip && trip.pickup && trip.dropoff && (
          <>
            <Marker position={[trip.pickup.coordinates[1], trip.pickup.coordinates[0]]} icon={pickupIcon}>
              <Popup>Pickup Location</Popup>
            </Marker>
            <Marker position={[trip.dropoff.coordinates[1], trip.dropoff.coordinates[0]]} icon={dropoffIcon}>
              <Popup>Dropoff Location</Popup>
            </Marker>
          </>
        )}
      </MapContainer>
      
      {onLocationSelect && (
        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-3 py-2 rounded-lg shadow-md text-sm z-10">
          <MapPin className="w-4 h-4 inline mr-1" />
          Tap to select location
        </div>
      )}
    </div>
  );
};

// Rating Component
const StarRating = ({ rating, onRatingChange, readonly = false, size = "w-5 h-5" }) => {
  return (
    <div className="flex space-x-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <StarIcon
          key={star}
          className={`${size} cursor-pointer transition-colors ${
            star <= rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
          } ${readonly ? 'cursor-default' : 'hover:text-yellow-400'}`}
          onClick={() => !readonly && onRatingChange && onRatingChange(star)}
        />
      ))}
    </div>
  );
};

// Trip Timeline Component
const TripTimeline = ({ trip, isDriver = false }) => {
  const getStatusIcon = (status) => {
    switch (status) {
      case 'requested': return <Clock className="w-4 h-4" />;
      case 'assigned': return <User className="w-4 h-4" />;
      case 'ongoing': return <Car className="w-4 h-4" />;
      case 'completed': return <Star className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-3">
      <div className={`flex items-center space-x-3 ${trip.status === 'requested' ? 'text-emerald-600' : 'text-gray-400'}`}>
        {getStatusIcon('requested')}
        <div>
          <p className="font-medium">Trip Requested</p>
          <p className="text-sm text-gray-500">
            {trip.requested_at ? new Date(trip.requested_at).toLocaleTimeString() : 'Pending'}
          </p>
        </div>
      </div>
      
      <div className={`flex items-center space-x-3 ${trip.status === 'assigned' || trip.status === 'ongoing' || trip.status === 'completed' ? 'text-emerald-600' : 'text-gray-400'}`}>
        {getStatusIcon('assigned')}
        <div>
          <p className="font-medium">Driver Assigned</p>
          <p className="text-sm text-gray-500">
            {trip.assigned_at ? new Date(trip.assigned_at).toLocaleTimeString() : 'Waiting...'}
          </p>
        </div>
      </div>
      
      <div className={`flex items-center space-x-3 ${trip.status === 'ongoing' || trip.status === 'completed' ? 'text-emerald-600' : 'text-gray-400'}`}>
        {getStatusIcon('ongoing')}
        <div>
          <p className="font-medium">Trip Started</p>
          <p className="text-sm text-gray-500">
            {trip.started_at ? new Date(trip.started_at).toLocaleTimeString() : 'Not started yet'}
          </p>
        </div>
      </div>
      
      <div className={`flex items-center space-x-3 ${trip.status === 'completed' ? 'text-emerald-600' : 'text-gray-400'}`}>
        {getStatusIcon('completed')}
        <div>
          <p className="font-medium">Trip Completed</p>
          <p className="text-sm text-gray-500">
            {trip.completed_at ? new Date(trip.completed_at).toLocaleTimeString() : 'In progress...'}
          </p>
        </div>
      </div>
    </div>
  );
};

// Mobile Navigation Component
const MobileNav = ({ isOpen, onToggle, user, onLogout }) => {
  return (
    <>
      {/* Mobile menu button */}
      <Button 
        variant="ghost" 
        size="sm"
        className="md:hidden"
        onClick={onToggle}
        data-testid="mobile-menu-btn"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </Button>

      {/* Mobile menu overlay */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black bg-opacity-50" onClick={onToggle}>
          <div className="fixed right-0 top-0 h-full w-64 bg-white shadow-lg p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold">Menu</h3>
              <Button variant="ghost" size="sm" onClick={onToggle}>
                <X className="w-5 h-5" />
              </Button>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <Avatar>
                  <AvatarFallback>{user?.user_type === 'driver' ? 'D' : 'R'}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{user?.user_type === 'driver' ? 'Driver' : 'Rider'}</p>
                  <p className="text-sm text-gray-500">Active</p>
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <Button variant="ghost" className="w-full justify-start" onClick={() => window.location.reload()}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
                <Button variant="ghost" className="w-full justify-start">
                  <Heart className="w-4 h-4 mr-2" />
                  Favorites
                </Button>
                <Button variant="ghost" className="w-full justify-start">
                  <Shield className="w-4 h-4 mr-2" />
                  Safety
                </Button>
              </div>
              
              <Separator />
              
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={onLogout}
              >
                Logout
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
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
        const endpoint = userType === 'rider' ? '/auth/rider/register' : '/auth/driver/register';
        const payload = userType === 'rider' 
          ? { name, phone }
          : { name, phone, vehicle_no: vehicleNo };

        const response = await axios.post(`${API}${endpoint}`, payload);
        
        toast.success(`${userType} registered successfully!`);
        onLogin(response.data);
      } else {
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 p-4">
      <Card className="w-full max-w-md shadow-2xl border-0 bg-white/80 backdrop-blur-sm" data-testid="auth-card">
        <CardHeader className="text-center pb-8">
          <div className="flex items-center justify-center mb-6">
            <div className="p-3 bg-emerald-500 rounded-2xl shadow-lg">
              <Car className="w-8 h-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
            CabMatch
          </CardTitle>
          <CardDescription className="text-lg mt-2">
            {isRegistering ? 'Join thousands of users' : 'Welcome back'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Tabs value={userType} onValueChange={setUserType} className="mb-6">
            <TabsList className="grid w-full grid-cols-2 bg-gray-100">
              <TabsTrigger value="rider" data-testid="rider-tab" className="data-[state=active]:bg-emerald-500 data-[state=active]:text-white">
                <User className="w-4 h-4 mr-2" />
                Rider
              </TabsTrigger>
              <TabsTrigger value="driver" data-testid="driver-tab" className="data-[state=active]:bg-emerald-500 data-[state=active]:text-white">
                <Car className="w-4 h-4 mr-2" />
                Driver
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <form onSubmit={handleSubmit} className="space-y-5">
            {isRegistering && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Full Name</label>
                <Input
                  type="text"
                  placeholder="Enter your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="h-12"
                  data-testid="name-input"
                />
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  type="tel"
                  placeholder="+1 234 567 8900"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="pl-10 h-12"
                  data-testid="phone-input"
                />
              </div>
            </div>

            {isRegistering && userType === 'driver' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Vehicle Number</label>
                <Input
                  type="text"
                  placeholder="DL 01 AB 1234"
                  value={vehicleNo}
                  onChange={(e) => setVehicleNo(e.target.value)}
                  required
                  className="h-12"
                  data-testid="vehicle-input"
                />
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full h-12 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold shadow-lg transition-all duration-200"
              disabled={loading}
              data-testid="auth-submit-btn"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                isRegistering ? 'Create Account' : 'Sign In'
              )}
            </Button>
          </form>

          <div className="text-center pt-4">
            <button
              type="button"
              onClick={() => setIsRegistering(!isRegistering)}
              className="text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
              data-testid="toggle-auth-mode"
            >
              {isRegistering ? 'Already have an account? Sign In' : "Don't have an account? Create one"}
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
  const [pickup, setPickup] = useState({ lat: 28.6139, lng: 77.2090 });
  const [dropoff, setDropoff] = useState(null);
  const [fareEstimate, setFareEstimate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showTripDetails, setShowTripDetails] = useState(false);
  const [favorites] = useState([
    { name: 'Home', lat: 28.6139, lng: 77.2090, icon: '🏠' },
    { name: 'Office', lat: 28.6500, lng: 77.2300, icon: '🏢' },
    { name: 'Airport', lat: 28.5562, lng: 77.1000, icon: '✈️' },
  ]);

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
      setShowTripDetails(true);
      toast.success('Trip requested! Looking for nearby drivers...');
      
      // Refresh trip data every 5 seconds
      const interval = setInterval(async () => {
        try {
          const tripResponse = await axios.get(`${API}/trips/${response.data.id}`);
          setCurrentTrip(tripResponse.data);
          if (tripResponse.data.status === 'completed') {
            clearInterval(interval);
            fetchTripHistory();
          }
        } catch (error) {
          console.error('Failed to refresh trip data');
        }
      }, 5000);

    } catch (error) {
      toast.error('Failed to request trip');
    } finally {
      setLoading(false);
    }
  };

  const setFavoriteLocation = (favorite, type) => {
    if (type === 'pickup') {
      setPickup({ lat: favorite.lat, lng: favorite.lng });
    } else {
      setDropoff({ lat: favorite.lat, lng: favorite.lng });
    }
    toast.success(`${favorite.name} set as ${type} location`);
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <div className="p-2 bg-emerald-500 rounded-xl shadow-lg mr-3">
                <Car className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                CabMatch
              </h1>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="hidden md:flex items-center space-x-4">
                <Badge variant="outline" className="px-3 py-1 bg-emerald-50 border-emerald-200">
                  <User className="w-4 h-4 mr-1" />
                  Rider
                </Badge>
                <Button variant="ghost" onClick={onLogout} data-testid="logout-btn">
                  Logout
                </Button>
              </div>
              <MobileNav 
                isOpen={mobileNavOpen} 
                onToggle={() => setMobileNavOpen(!mobileNavOpen)}
                user={user}
                onLogout={onLogout}
              />
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Trip Request Section */}
          <div className="lg:col-span-2 space-y-6">
            {/* Favorites Quick Access */}
            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center text-lg">
                  <Heart className="w-5 h-5 mr-2 text-red-500" />
                  Quick Locations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  {favorites.map((fav, index) => (
                    <div key={index} className="text-center">
                      <Button 
                        variant="outline" 
                        className="w-full h-16 flex-col space-y-1 hover:bg-emerald-50"
                        onClick={() => setFavoriteLocation(fav, 'pickup')}
                      >
                        <span className="text-xl">{fav.icon}</span>
                        <span className="text-xs">{fav.name}</span>
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm" data-testid="trip-request-card">
              <CardHeader>
                <CardTitle className="flex items-center text-lg md:text-xl">
                  <Navigation className="w-5 h-5 mr-2 text-emerald-600" />
                  Book Your Ride
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-medium text-gray-700 flex items-center">
                        <div className="w-3 h-3 bg-emerald-500 rounded-full mr-2"></div>
                        Pickup Location
                      </label>
                      <Badge variant="outline" className="text-xs">
                        {pickup.lat.toFixed(4)}, {pickup.lng.toFixed(4)}
                      </Badge>
                    </div>
                    <InteractiveMap 
                      center={pickup} 
                      markers={[{ lat: pickup.lat, lng: pickup.lng, type: 'pickup' }]}
                      onLocationSelect={setPickup}
                      height="200px"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-medium text-gray-700 flex items-center">
                        <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                        Dropoff Location
                      </label>
                      {dropoff && (
                        <Badge variant="outline" className="text-xs">
                          {dropoff.lat.toFixed(4)}, {dropoff.lng.toFixed(4)}
                        </Badge>
                      )}
                    </div>
                    <InteractiveMap 
                      center={pickup} 
                      markers={dropoff ? [{ lat: dropoff.lat, lng: dropoff.lng, type: 'dropoff' }] : []}
                      onLocationSelect={setDropoff}
                      height="200px"
                    />
                  </div>
                </div>

                {fareEstimate && (
                  <Card className="bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200 shadow-md">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-700 mb-1">Estimated Fare</p>
                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <Navigation className="w-4 h-4" />
                            <span>{fareEstimate.distance_km.toFixed(1)} km</span>
                            {fareEstimate.surge_factor > 1 && (
                              <>
                                <Zap className="w-4 h-4 text-amber-500" />
                                <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                                  {fareEstimate.surge_factor.toFixed(1)}x surge
                                </Badge>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-3xl font-bold text-emerald-600">
                            ₹{fareEstimate.estimated_fare.toFixed(0)}
                          </div>
                          <div className="text-sm text-gray-500">
                            Base: ₹{fareEstimate.base_fare}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Button 
                  onClick={requestTrip}
                  disabled={!pickup || !dropoff || loading}
                  className="w-full h-12 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold shadow-lg transition-all duration-200"
                  data-testid="request-trip-btn"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                      Requesting...
                    </>
                  ) : (
                    <>
                      <Car className="w-5 h-5 mr-2" />
                      Request Ride
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Current Trip Status */}
            {currentTrip && (
              <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm" data-testid="current-trip-card">
                <CardHeader className="pb-4">
                  <CardTitle className="text-emerald-700 flex items-center">
                    <Navigation2 className="w-5 h-5 mr-2" />
                    Current Trip
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Status</span>
                    <Badge variant={
                      currentTrip.status === 'completed' ? 'default' : 
                      currentTrip.status === 'ongoing' ? 'secondary' : 'outline'
                    } className="capitalize">
                      {currentTrip.status}
                    </Badge>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Trip ID</span>
                    <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                      {currentTrip.id.slice(0, 8)}...
                    </span>
                  </div>
                  
                  {currentTrip.driver_id && (
                    <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Avatar className="bg-emerald-500 text-white">
                          <AvatarFallback>D</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">Driver Assigned</p>
                          <p className="text-xs text-gray-500">On the way</p>
                        </div>
                      </div>
                      <Button size="sm" variant="outline">
                        <PhoneCall className="w-4 h-4" />
                      </Button>
                    </div>
                  )}

                  <Button 
                    variant="outline" 
                    className="w-full" 
                    onClick={() => setShowTripDetails(true)}
                  >
                    View Details
                  </Button>
                  
                  {currentTrip.pickup && currentTrip.dropoff && (
                    <div className="mt-4">
                      <InteractiveMap
                        center={{ lat: currentTrip.pickup.coordinates[1], lng: currentTrip.pickup.coordinates[0] }}
                        markers={[
                          { lat: currentTrip.pickup.coordinates[1], lng: currentTrip.pickup.coordinates[0], type: 'pickup' },
                          { lat: currentTrip.dropoff.coordinates[1], lng: currentTrip.dropoff.coordinates[0], type: 'dropoff' }
                        ]}
                        height="150px"
                        trip={currentTrip}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Trip History */}
            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm" data-testid="trip-history-card">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center text-lg">
                  <Clock className="w-5 h-5 mr-2 text-gray-600" />
                  Recent Trips
                </CardTitle>
              </CardHeader>
              <CardContent>
                {tripHistory.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Car className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>No trips yet</p>
                    <p className="text-sm">Book your first ride!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {tripHistory.slice(0, 5).map((trip) => (
                      <div key={trip.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <Badge variant={
                            trip.status === 'completed' ? 'default' : 
                            trip.status === 'ongoing' ? 'secondary' : 'outline'
                          } className="capitalize text-xs">
                            {trip.status}
                          </Badge>
                          <div className="text-right">
                            {trip.fare && (
                              <div className="font-semibold text-emerald-600">₹{trip.fare.toFixed(0)}</div>
                            )}
                            <div className="text-xs text-gray-500">
                              {new Date(trip.requested_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        {trip.distance_km && (
                          <div className="flex items-center text-sm text-gray-600">
                            <Navigation className="w-3 h-3 mr-1" />
                            {trip.distance_km.toFixed(1)} km
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Trip Details Modal */}
      <Dialog open={showTripDetails} onOpenChange={setShowTripDetails}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Trip Details</DialogTitle>
          </DialogHeader>
          {currentTrip && (
            <div className="space-y-4">
              <TripTimeline trip={currentTrip} />
              {currentTrip.status === 'completed' && (
                <div className="border-t pt-4">
                  <div className="flex justify-between mb-2">
                    <span>Distance:</span>
                    <span>{currentTrip.distance_km?.toFixed(1)} km</span>
                  </div>
                  <div className="flex justify-between mb-4">
                    <span>Fare:</span>
                    <span className="font-semibold">₹{currentTrip.fare?.toFixed(0)}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">Rate your trip:</p>
                    <StarRating rating={0} onRatingChange={(rating) => toast.success(`Rated ${rating} stars!`)} />
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Driver Dashboard
const DriverDashboard = ({ user, onLogout }) => {
  const [driver, setDriver] = useState(null);
  const [trips, setTrips] = useState([]);
  const [location, setLocation] = useState({ lat: 28.6139, lng: 77.2090 });
  const [status, setStatus] = useState('offline');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [earnings] = useState({ today: 850, week: 4200, month: 18500 });

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

  const totalEarnings = trips
    .filter(trip => trip.status === 'completed' && trip.fare)
    .reduce((sum, trip) => sum + trip.fare, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <div className="p-2 bg-orange-500 rounded-xl shadow-lg mr-3">
                <Car className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                CabMatch Driver
              </h1>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="hidden md:flex items-center space-x-4">
                <Badge 
                  variant="outline" 
                  className={`px-3 py-1 ${
                    status === 'available' ? 'bg-green-50 border-green-200 text-green-700' :
                    status === 'on_trip' ? 'bg-blue-50 border-blue-200 text-blue-700' :
                    'bg-gray-50 border-gray-200 text-gray-700'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full mr-2 ${
                    status === 'available' ? 'bg-green-500' :
                    status === 'on_trip' ? 'bg-blue-500' :
                    'bg-gray-500'
                  }`}></div>
                  {status === 'on_trip' ? 'On Trip' : status}
                </Badge>
                <Button variant="ghost" onClick={onLogout} data-testid="logout-btn">
                  Logout
                </Button>
              </div>
              <MobileNav 
                isOpen={mobileNavOpen} 
                onToggle={() => setMobileNavOpen(!mobileNavOpen)}
                user={user}
                onLogout={onLogout}
              />
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Driver Controls */}
          <div className="lg:col-span-2 space-y-6">
            {/* Status Control */}
            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm" data-testid="driver-status-card">
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <Zap className="w-5 h-5 mr-2 text-orange-600" />
                  Driver Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">Current Status</p>
                    <p className="text-sm text-gray-600 capitalize">{status}</p>
                  </div>
                  <div className={`px-4 py-2 rounded-full text-sm font-medium ${
                    status === 'available' ? 'bg-green-100 text-green-700' :
                    status === 'on_trip' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {status === 'on_trip' ? 'Busy' : status}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Button
                    variant={status === 'available' ? 'default' : 'outline'}
                    onClick={() => updateStatus('available')}
                    className={`h-12 ${status === 'available' ? 'bg-green-500 hover:bg-green-600' : ''}`}
                    data-testid="status-available-btn"
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    Available
                  </Button>
                  <Button
                    variant={status === 'offline' ? 'default' : 'outline'}
                    onClick={() => updateStatus('offline')}
                    className={`h-12 ${status === 'offline' ? 'bg-gray-500 hover:bg-gray-600' : ''}`}
                    data-testid="status-offline-btn"
                  >
                    <Clock className="w-4 h-4 mr-2" />
                    Offline
                  </Button>
                  <Button
                    variant="outline"
                    disabled={status !== 'on_trip'}
                    className="h-12"
                  >
                    <Car className="w-4 h-4 mr-2" />
                    On Trip
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Location Update */}
            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm" data-testid="location-card">
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <MapPin className="w-5 h-5 mr-2 text-orange-600" />
                  Update Location
                </CardTitle>
              </CardHeader>
              <CardContent>
                <InteractiveMap 
                  center={location}
                  markers={[{ lat: location.lat, lng: location.lng, type: 'driver', info: 'Your Location' }]}
                  onLocationSelect={updateLocation}
                  height="300px"
                />
                <div className="mt-3 flex items-center justify-between text-sm text-gray-600">
                  <span>Current: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}</span>
                  <Button size="sm" variant="outline" onClick={() => {
                    navigator.geolocation?.getCurrentPosition((pos) => {
                      const newLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                      updateLocation(newLoc);
                    });
                  }}>
                    <Navigation2 className="w-4 h-4 mr-1" />
                    Use GPS
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Earnings */}
            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm" data-testid="earnings-card">
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <DollarSign className="w-5 h-5 mr-2 text-green-600" />
                  Earnings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg">
                  <div className="text-3xl font-bold text-green-600">
                    ₹{totalEarnings.toFixed(0)}
                  </div>
                  <p className="text-green-700 font-medium">Total Earned</p>
                  <p className="text-sm text-gray-600">{trips.filter(trip => trip.status === 'completed').length} completed trips</p>
                </div>
                
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-lg font-semibold">₹{earnings.today}</p>
                    <p className="text-xs text-gray-600">Today</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-lg font-semibold">₹{earnings.week}</p>
                    <p className="text-xs text-gray-600">This Week</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-lg font-semibold">₹{earnings.month}</p>
                    <p className="text-xs text-gray-600">This Month</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Trips */}
            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm" data-testid="driver-trips-card">
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <Navigation className="w-5 h-5 mr-2 text-gray-600" />
                  Recent Trips
                </CardTitle>
              </CardHeader>
              <CardContent>
                {trips.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Car className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>No trips yet</p>
                    <p className="text-sm">Go online to receive requests</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {trips.slice(0, 5).map((trip) => (
                      <div key={trip.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <Badge variant={
                            trip.status === 'completed' ? 'default' : 
                            trip.status === 'ongoing' ? 'secondary' : 'outline'
                          } className="capitalize text-xs">
                            {trip.status}
                          </Badge>
                          <div className="text-right">
                            {trip.fare && (
                              <div className="font-semibold text-green-600">₹{trip.fare.toFixed(0)}</div>
                            )}
                            <div className="text-xs text-gray-500">
                              {new Date(trip.requested_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        {trip.distance_km && (
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center text-gray-600">
                              <Navigation className="w-3 h-3 mr-1" />
                              {trip.distance_km.toFixed(1)} km
                            </div>
                            {trip.status === 'completed' && (
                              <StarRating rating={5} readonly size="w-3 h-3" />
                            )}
                          </div>
                        )}
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-50">
        <div className="text-center">
          <div className="p-4 bg-emerald-500 rounded-2xl shadow-xl mb-6">
            <Car className="w-12 h-12 text-white animate-pulse" />
          </div>
          <p className="text-lg font-medium text-gray-700">Loading CabMatch...</p>
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