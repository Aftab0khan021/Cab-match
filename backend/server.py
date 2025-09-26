from fastapi import FastAPI, APIRouter, HTTPException, WebSocket, WebSocketDisconnect, Body, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import json
import asyncio
import math
from enum import Enum

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
MONGO_URL = os.environ.get("MONGO_URL")
if not MONGO_URL:
    raise RuntimeError("MONGO_URL not set in environment")

client = AsyncIOMotorClient(MONGO_URL)
DB_NAME = os.getenv("DB_NAME", "cabmatch")
db = client[DB_NAME]

# ---- App + CORS (single place) ----
def _parse_origins() -> List[str]:
    # Prefer CORS_ORIGINS (comma-separated), else FRONTEND_ORIGIN, else "*"
    cors_env = os.getenv("CORS_ORIGINS")
    if cors_env:
        return [o.strip() for o in cors_env.split(",") if o.strip()]
    fo = os.getenv("FRONTEND_ORIGIN")
    if fo and fo != "*":
        return [fo]
    return ["*"]

# Create the main app without a prefix
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=_parse_origins(),
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=False
)

@app.get("/health")
def health():
    return {"ok": True, "service": "cab-match-backend"}

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

security = HTTPBearer()

# Enums
class DriverStatus(str, Enum):
    offline = "offline"
    available = "available"
    on_trip = "on_trip"

class TripStatus(str, Enum):
    requested = "requested"
    assigned = "assigned" 
    ongoing = "ongoing"
    completed = "completed"
    cancelled = "cancelled"

# WebSocket manager for real-time updates
class ConnectionManager:
    def __init__(self):
        self.rider_connections: Dict[str, WebSocket] = {}
        self.driver_connections: Dict[str, WebSocket] = {}
    
    async def connect_rider(self, rider_id: str, websocket: WebSocket):
        await websocket.accept()
        self.rider_connections[rider_id] = websocket
    
    async def connect_driver(self, driver_id: str, websocket: WebSocket):
        await websocket.accept()
        self.driver_connections[driver_id] = websocket
    
    def disconnect_rider(self, rider_id: str):
        if rider_id in self.rider_connections:
            del self.rider_connections[rider_id]
    
    def disconnect_driver(self, driver_id: str):
        if driver_id in self.driver_connections:
            del self.driver_connections[driver_id]
    
    async def send_to_rider(self, rider_id: str, message: dict):
        if rider_id in self.rider_connections:
            await self.rider_connections[rider_id].send_text(json.dumps(message))
    
    async def send_to_driver(self, driver_id: str, message: dict):
        if driver_id in self.driver_connections:
            await self.driver_connections[driver_id].send_text(json.dumps(message))

manager = ConnectionManager()

# Pydantic Models
class Location(BaseModel):
    type: str = "Point"
    coordinates: List[float]  # [longitude, latitude]

class RiderCreate(BaseModel):
    name: str
    phone: str

class Rider(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    phone: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DriverCreate(BaseModel):
    name: str
    phone: str
    vehicle_no: str

class Driver(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    phone: str
    vehicle_no: str
    status: DriverStatus = DriverStatus.offline
    location: Optional[Location] = None
    last_update: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class LocationUpdate(BaseModel):
    latitude: float
    longitude: float

class TripRequest(BaseModel):
    rider_id: str
    pickup_latitude: float
    pickup_longitude: float
    dropoff_latitude: float
    dropoff_longitude: float

class Trip(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    rider_id: str
    driver_id: Optional[str] = None
    pickup: Location
    dropoff: Location
    status: TripStatus = TripStatus.requested
    requested_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    assigned_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    distance_km: Optional[float] = None
    fare: Optional[float] = None

class AuthResponse(BaseModel):
    user_id: str
    user_type: str  # "rider" or "driver"
    token: str

class PricingEstimate(BaseModel):
    base_fare: float
    distance_km: float
    per_km_rate: float
    surge_factor: float
    estimated_fare: float

# NEW: explicit request bodies
class LoginRequest(BaseModel):
    phone: str

class DriverStatusUpdate(BaseModel):
    status: DriverStatus

# Helper Functions
def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great circle distance between two points on earth in kilometers"""
    R = 6371  # Earth radius in kilometers
    
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)
    
    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad
    
    a = math.sin(dlat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    
    return R * c

def calculate_surge_factor(demand: int, supply: int) -> float:
    """Calculate surge pricing factor based on demand and supply"""
    if supply == 0:
        return 2.5
    ratio = demand / supply
    return min(1.0 + 0.6 * max(0, ratio - 1), 2.5)

def serialize_for_mongo(data: dict) -> dict:
    """Convert datetime objects to ISO strings for MongoDB storage"""
    for key, value in data.items():
        if isinstance(value, datetime):
            data[key] = value.isoformat()
    return data

def deserialize_from_mongo(data: dict) -> dict:
    """Convert ISO strings back to datetime objects"""
    datetime_fields = ['created_at', 'last_update', 'requested_at', 'assigned_at', 'started_at', 'completed_at']
    for field in datetime_fields:
        if field in data and isinstance(data[field], str):
            try:
                data[field] = datetime.fromisoformat(data[field])
            except:
                pass
    return data

# Authentication Routes
@api_router.post("/auth/rider/register", response_model=AuthResponse)
async def register_rider(rider_data: RiderCreate):
    # Check if rider already exists
    existing_rider = await db.riders.find_one({"phone": rider_data.phone})
    if existing_rider:
        raise HTTPException(status_code=400, detail="Phone number already registered")
    
    rider = Rider(**rider_data.dict())
    rider_dict = serialize_for_mongo(rider.dict())
    
    await db.riders.insert_one(rider_dict)
    
    # Simple token for MVP (in production, use JWT)
    token = f"rider_{rider.id}"
    
    return AuthResponse(
        user_id=rider.id,
        user_type="rider",
        token=token
    )

@api_router.post("/auth/driver/register", response_model=AuthResponse)
async def register_driver(driver_data: DriverCreate):
    # Check if driver already exists
    existing_driver = await db.drivers.find_one({"phone": driver_data.phone})
    if existing_driver:
        raise HTTPException(status_code=400, detail="Phone number already registered")
    
    driver = Driver(**driver_data.dict())
    driver_dict = serialize_for_mongo(driver.dict())
    
    await db.drivers.insert_one(driver_dict)
    
    # Create geospatial index for driver locations
    await db.drivers.create_index([("location", "2dsphere")])
    
    # Simple token for MVP
    token = f"driver_{driver.id}"
    
    return AuthResponse(
        user_id=driver.id,
        user_type="driver", 
        token=token
    )

@api_router.post("/auth/login", response_model=AuthResponse)
async def login(payload: LoginRequest = Body(None), phone_q: str = Query(None ,alias="phone")):
    phone = (payload.phone if payload and payload.phone else phone_q)
    if not phone:
        raise HTTPException(status_code=422, detail="phone is required")

    rider = await db.riders.find_one({"phone": phone})
    if rider:
        token = f"rider_{rider['id']}"
        return AuthResponse(user_id=rider['id'], user_type="rider", token=token)

    driver = await db.drivers.find_one({"phone": phone})
    if driver:
        token = f"driver_{driver['id']}"
        return AuthResponse(user_id=driver['id'], user_type="driver", token=token)

    raise HTTPException(status_code=404, detail="User not found")

# Driver Routes
@api_router.put("/drivers/{driver_id}/location")
async def update_driver_location(driver_id: str, location_update: LocationUpdate):
    location = Location(coordinates=[location_update.longitude, location_update.latitude])
    
    result = await db.drivers.update_one(
        {"id": driver_id},
        {
            "$set": {
                "location": location.dict(),
                "last_update": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    return {"message": "Location updated successfully"}

@api_router.put("/drivers/{driver_id}/status")
async def update_driver_status(driver_id: str,
                               body: DriverStatusUpdate = Body(None),
                               status_q: DriverStatus = Query(None)):
    new_status = (body.status if body and body.status else status_q)
    if not new_status:
        raise HTTPException(status_code=422, detail="status is required")
    result = await db.drivers.update_one(
        {"id": driver_id},
        {"$set": {
            "status": new_status.value if isinstance(new_status, DriverStatus) else str(new_status),
            "last_update": datetime.now(timezone.utc).isoformat()
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Driver not found")
    return {"message": "Status updated successfully"}

@api_router.get("/drivers/{driver_id}", response_model=Driver)
async def get_driver(driver_id: str):
    driver = await db.drivers.find_one({"id": driver_id})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    return Driver(**deserialize_from_mongo(driver))

# Rider Routes
@api_router.get("/riders/{rider_id}", response_model=Rider)
async def get_rider(rider_id: str):
    rider = await db.riders.find_one({"id": rider_id})
    if not rider:
        raise HTTPException(status_code=404, detail="Rider not found")
    
    return Rider(**deserialize_from_mongo(rider))

# Trip Routes
@api_router.post("/trips/request", response_model=Trip)
async def request_trip(trip_request: TripRequest):
    # Verify rider exists
    rider = await db.riders.find_one({"id": trip_request.rider_id})
    if not rider:
        raise HTTPException(status_code=404, detail="Rider not found")
    
    # Create trip
    trip = Trip(
        rider_id=trip_request.rider_id,
        pickup=Location(coordinates=[trip_request.pickup_longitude, trip_request.pickup_latitude]),
        dropoff=Location(coordinates=[trip_request.dropoff_longitude, trip_request.dropoff_latitude])
    )
    
    trip_dict = serialize_for_mongo(trip.dict())
    await db.trips.insert_one(trip_dict)
    
    # Find nearest available driver
    await match_driver(trip.id)
    
    return trip

async def match_driver(trip_id: str):
    """Background task to match a driver to a trip"""
    trip = await db.trips.find_one({"id": trip_id})
    if not trip or trip['status'] != 'requested':
        return
    
    # Find available drivers near pickup location
    pickup_coords = trip['pickup']['coordinates']
    
    # Query for available drivers within 10km radius
    nearby_drivers = await db.drivers.find({
        "status": "available",
        "location": {
            "$near": {
                "$geometry": {
                    "type": "Point",
                    "coordinates": pickup_coords
                },
                "$maxDistance": 10000  # 10km in meters
            }
        }
    }).to_list(10)
    
    
    if nearby_drivers:
        # Select closest driver
        best_driver = nearby_drivers[0]
        
        # Assign trip to driver
        await db.trips.update_one(
            {"id": trip_id},
            {
                "$set": {
                    "driver_id": best_driver['id'],
                    "status": "assigned",
                    "assigned_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        # Update driver status
        await db.drivers.update_one(
            {"id": best_driver['id']},
            {"$set": {"status": "on_trip"}}
        )
        
        # Send real-time notifications
        await manager.send_to_rider(trip['rider_id'], {
            "type": "trip_assigned",
            "trip_id": trip_id,
            "driver": best_driver
        })
        
        await manager.send_to_driver(best_driver['id'], {
            "type": "trip_assigned", 
            "trip_id": trip_id,
            "trip": trip
        })

@app.on_event("startup")
async def ensure_indexes():
    await db.riders.create_index("id", unique=True)
    await db.drivers.create_index("id", unique=True)
    await db.trips.create_index("id", unique=True)
    await db.drivers.create_index([("location", "2dsphere")])  # for $near

@api_router.put("/trips/{trip_id}/start")
async def start_trip(trip_id: str):
    result = await db.trips.update_one(
        {"id": trip_id, "status": "assigned"},
        {
            "$set": {
                "status": "ongoing",
                "started_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Trip not found or not in assigned state")
    
    trip = await db.trips.find_one({"id": trip_id})
    
    # Send updates
    await manager.send_to_rider(trip['rider_id'], {
        "type": "trip_started",
        "trip_id": trip_id
    })
    
    return {"message": "Trip started"}

@api_router.put("/trips/{trip_id}/complete")
async def complete_trip(trip_id: str):
    trip = await db.trips.find_one({"id": trip_id})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    # Calculate distance and fare
    pickup_coords = trip['pickup']['coordinates']
    dropoff_coords = trip['dropoff']['coordinates']
    distance = haversine_distance(
        pickup_coords[1], pickup_coords[0],  # lat, lon
        dropoff_coords[1], dropoff_coords[0]
    )
    
    # Simple pricing calculation
    base_fare = 50.0  # Base fare in currency units
    per_km_rate = 15.0
    fare = base_fare + (per_km_rate * distance)
    
    result = await db.trips.update_one(
        {"id": trip_id, "status": "ongoing"},
        {
            "$set": {
                "status": "completed",
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "distance_km": distance,
                "fare": fare
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Trip not found or not in ongoing state")
    
    # Update driver status back to available
    if trip['driver_id']:
        await db.drivers.update_one(
            {"id": trip['driver_id']},
            {"$set": {"status": "available"}}
        )
    
    # Send updates
    await manager.send_to_rider(trip['rider_id'], {
        "type": "trip_completed",
        "trip_id": trip_id,
        "fare": fare,
        "distance": distance
    })
    
    await manager.send_to_driver(trip['driver_id'], {
        "type": "trip_completed",
        "trip_id": trip_id
    })
    
    return {"message": "Trip completed", "fare": fare, "distance": distance}

@api_router.get("/trips/{trip_id}", response_model=Trip)
async def get_trip(trip_id: str):
    trip = await db.trips.find_one({"id": trip_id})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    return Trip(**deserialize_from_mongo(trip))

@api_router.get("/riders/{rider_id}/trips", response_model=List[Trip])
async def get_rider_trips(rider_id: str):
    trips = await db.trips.find({"rider_id": rider_id}).sort("requested_at", -1).to_list(50)
    return [Trip(**deserialize_from_mongo(trip)) for trip in trips]

@api_router.get("/drivers/{driver_id}/trips", response_model=List[Trip])
async def get_driver_trips(driver_id: str):
    trips = await db.trips.find({"driver_id": driver_id}).sort("requested_at", -1).to_list(50)
    return [Trip(**deserialize_from_mongo(trip)) for trip in trips]

# Pricing Routes
@api_router.get("/pricing/estimate", response_model=PricingEstimate)
async def estimate_fare(pickup_lat: float, pickup_lon: float, dropoff_lat: float, dropoff_lon: float):
    distance = haversine_distance(pickup_lat, pickup_lon, dropoff_lat, dropoff_lon)
    
    base_fare = 50.0
    per_km_rate = 15.0
    
    # Calculate demand/supply for surge pricing
    # Count recent trip requests in area (last 5 minutes) - simplified for MVP
    five_min_ago = datetime.now(timezone.utc) - timedelta(minutes=5)
    demand = await db.trips.count_documents({
        "requested_at": {"$gte": five_min_ago.isoformat()}
    })
    
    # Count available drivers in area - simplified for MVP
    supply = await db.drivers.count_documents({
        "status": "available"
    })
    
    surge_factor = calculate_surge_factor(demand, supply)
    base_cost = base_fare + (per_km_rate * distance)
    estimated_fare = base_cost * surge_factor
    
    return PricingEstimate(
        base_fare=base_fare,
        distance_km=distance,
        per_km_rate=per_km_rate,
        surge_factor=surge_factor,
        estimated_fare=estimated_fare
    )

# WebSocket Routes
@app.websocket("/ws/rider/{rider_id}")
async def websocket_rider(websocket: WebSocket, rider_id: str):
    await manager.connect_rider(rider_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Handle incoming messages if needed
            pass
    except WebSocketDisconnect:
        manager.disconnect_rider(rider_id)

@app.websocket("/ws/driver/{driver_id}")
async def websocket_driver(websocket: WebSocket, driver_id: str):
    await manager.connect_driver(driver_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Handle incoming messages if needed
            pass
    except WebSocketDisconnect:
        manager.disconnect_driver(driver_id)

# Include the router in the main app
app.include_router(api_router)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=False)
