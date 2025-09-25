#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime
import time
import uuid

class RideMatchingAPITester:
    def __init__(self, base_url="https://cabmatch-2.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.rider_token = None
        self.driver_token = None
        self.rider_id = None
        self.driver_id = None
        self.trip_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        if headers is None:
            headers = {'Content-Type': 'application/json'}

        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=data)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)

            success = response.status_code == expected_status
            
            if success:
                print(f"   Status: {response.status_code} ✅")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                except:
                    response_data = {}
            else:
                print(f"   Status: {response.status_code} ❌ (Expected {expected_status})")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text}")
                response_data = {}

            self.log_test(name, success, f"Status {response.status_code}, Expected {expected_status}")
            return success, response_data

        except Exception as e:
            print(f"   Exception: {str(e)} ❌")
            self.log_test(name, False, f"Exception: {str(e)}")
            return False, {}

    def test_rider_registration(self):
        """Test rider registration"""
        test_phone = f"+91{datetime.now().strftime('%H%M%S')}1234"
        success, response = self.run_test(
            "Rider Registration",
            "POST",
            "auth/rider/register",
            200,
            data={
                "name": "Test Rider",
                "phone": test_phone
            }
        )
        if success and 'user_id' in response:
            self.rider_id = response['user_id']
            self.rider_token = response['token']
            return True
        return False

    def test_driver_registration(self):
        """Test driver registration"""
        test_phone = f"+91{datetime.now().strftime('%H%M%S')}5678"
        success, response = self.run_test(
            "Driver Registration",
            "POST",
            "auth/driver/register",
            200,
            data={
                "name": "Test Driver",
                "phone": test_phone,
                "vehicle_no": "DL01AB1234"
            }
        )
        if success and 'user_id' in response:
            self.driver_id = response['user_id']
            self.driver_token = response['token']
            return True
        return False

    def test_login(self):
        """Test login functionality"""
        if not self.rider_id:
            return False
            
        # Get rider phone from registration (simplified for test)
        test_phone = f"+91{datetime.now().strftime('%H%M%S')}1234"
        success, response = self.run_test(
            "Login",
            "POST",
            f"auth/login?phone={test_phone}",
            200
        )
        return success

    def test_driver_location_update(self):
        """Test driver location update"""
        if not self.driver_id:
            return False
            
        success, response = self.run_test(
            "Driver Location Update",
            "PUT",
            f"drivers/{self.driver_id}/location",
            200,
            data={
                "latitude": 28.6139,
                "longitude": 77.2090
            }
        )
        return success

    def test_driver_status_update(self):
        """Test driver status update"""
        if not self.driver_id:
            return False
            
        success, response = self.run_test(
            "Driver Status Update",
            "PUT",
            f"drivers/{self.driver_id}/status?status=available",
            200
        )
        return success

    def test_fare_estimation(self):
        """Test fare estimation"""
        success, response = self.run_test(
            "Fare Estimation",
            "GET",
            "pricing/estimate",
            200,
            data={
                "pickup_lat": 28.6139,
                "pickup_lon": 77.2090,
                "dropoff_lat": 28.6219,
                "dropoff_lon": 77.2170
            }
        )
        return success

    def test_trip_request(self):
        """Test trip request"""
        if not self.rider_id:
            return False
            
        success, response = self.run_test(
            "Trip Request",
            "POST",
            "trips/request",
            200,
            data={
                "rider_id": self.rider_id,
                "pickup_latitude": 28.6139,
                "pickup_longitude": 77.2090,
                "dropoff_latitude": 28.6219,
                "dropoff_longitude": 77.2170
            }
        )
        if success and 'id' in response:
            self.trip_id = response['id']
            return True
        return False

    def test_trip_lifecycle(self):
        """Test complete trip lifecycle"""
        if not self.trip_id:
            return False
            
        # Wait a moment for driver matching
        time.sleep(2)
        
        # Check trip status
        success1, response = self.run_test(
            "Get Trip Status",
            "GET",
            f"trips/{self.trip_id}",
            200
        )
        
        # Try to start trip (may fail if not assigned)
        success2, response = self.run_test(
            "Start Trip",
            "PUT",
            f"trips/{self.trip_id}/start",
            200
        )
        
        # Try to complete trip (may fail if not started)
        success3, response = self.run_test(
            "Complete Trip",
            "PUT",
            f"trips/{self.trip_id}/complete",
            200
        )
        
        return success1  # At least trip status should work

    def test_trip_history(self):
        """Test trip history endpoints"""
        if not self.rider_id or not self.driver_id:
            return False
            
        success1, response = self.run_test(
            "Rider Trip History",
            "GET",
            f"riders/{self.rider_id}/trips",
            200
        )
        
        success2, response = self.run_test(
            "Driver Trip History",
            "GET",
            f"drivers/{self.driver_id}/trips",
            200
        )
        
        return success1 and success2

    def test_user_profiles(self):
        """Test user profile endpoints"""
        if not self.rider_id or not self.driver_id:
            return False
            
        success1, response = self.run_test(
            "Get Rider Profile",
            "GET",
            f"riders/{self.rider_id}",
            200
        )
        
        success2, response = self.run_test(
            "Get Driver Profile",
            "GET",
            f"drivers/{self.driver_id}",
            200
        )
        
        return success1 and success2

    def run_all_tests(self):
        """Run all backend API tests"""
        print("🚀 Starting Ride Matching API Tests")
        print(f"📍 Base URL: {self.base_url}")
        print("=" * 60)

        # Authentication Tests
        print("\n📋 AUTHENTICATION TESTS")
        self.test_rider_registration()
        self.test_driver_registration()
        self.test_login()

        # Driver Management Tests
        print("\n🚗 DRIVER MANAGEMENT TESTS")
        self.test_driver_location_update()
        self.test_driver_status_update()

        # Pricing Tests
        print("\n💰 PRICING TESTS")
        self.test_fare_estimation()

        # Trip Management Tests
        print("\n🛣️ TRIP MANAGEMENT TESTS")
        self.test_trip_request()
        self.test_trip_lifecycle()
        self.test_trip_history()

        # User Profile Tests
        print("\n👤 USER PROFILE TESTS")
        self.test_user_profiles()

        # Print Summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")

        # Print failed tests
        failed_tests = [test for test in self.test_results if not test['success']]
        if failed_tests:
            print("\n❌ FAILED TESTS:")
            for test in failed_tests:
                print(f"   • {test['test']}: {test['details']}")

        return self.tests_passed == self.tests_run

def main():
    tester = RideMatchingAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())