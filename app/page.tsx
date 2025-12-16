"use client";
import { useState, useEffect } from 'react';
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue } from "firebase/database";

// 1. Initialize Firebase
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: "https://urbanride4244-default-rtdb.firebaseio.com/"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export default function Home() {
  const [screen, setScreen] = useState('booking'); // booking, searching, accepted, arrived, completed
  const [pickup, setPickup] = useState('Downtown Area');
  const [details, setDetails] = useState('');
  const [currentRideId, setCurrentRideId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // New State for Driver Info
  const [driverName, setDriverName] = useState('Driver');
  const [driverUsername, setDriverUsername] = useState('');

  // Function to Request Ride
  const handleRequestRide = async () => {
    if(!details) {
      alert("Please enter your exact spot (e.g. Starbucks)");
      return;
    }

    setIsLoading(true);
    setScreen('searching');
    
    const rideId = 'ride_' + Date.now();
    setCurrentRideId(rideId);

    try {
      await set(ref(db, 'rides/' + rideId), {
        status: 'PENDING',
        pickup: pickup,
        details: details,
        timestamp: Date.now()
      });

      const res = await fetch('/api/ride-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          pickup: `${pickup} - ${details}`, 
          destination: 'Zone B', 
          price: '$12.50',
          rideId: rideId 
        })
      });

      if (!res.ok) throw new Error("Failed to send to Telegram");

    } catch (error) {
      console.error(error);
      alert("Error connecting. Check console.");
      setScreen('booking');
    } finally {
      setIsLoading(false);
    }
  };

  // Listener: Watch for ALL Status Changes
  useEffect(() => {
    if (!currentRideId) return;
    const rideRef = ref(db, 'rides/' + currentRideId);
    
    const unsubscribe = onValue(rideRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Update Driver Info if available
        if (data.driverName) setDriverName(data.driverName);
        if (data.driverUsername) setDriverUsername(data.driverUsername);

        // Update Screen based on Status
        if (data.status === 'ACCEPTED') {
          setScreen('accepted');
        } else if (data.status === 'ARRIVED') {
          setScreen('arrived');
        } else if (data.status === 'COMPLETED') {
          setScreen('completed');
        }
      }
    });
    return () => unsubscribe();
  }, [currentRideId]);

  // Helper to reset app
  const resetApp = () => {
    setScreen('booking');
    setDetails('');
    setCurrentRideId(null);
    setDriverName('Driver');
    setDriverUsername('');
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-200">
      
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100">
        
        {/* Header */}
        <div className="bg-black p-5 text-white text-center">
          <h1 className="font-bold text-2xl tracking-wider">URBAN RIDE</h1>
          <p className="text-gray-400 text-xs mt-1">FAST & RELIABLE</p>
        </div>

        {/* --- SCREEN 1: BOOKING --- */}
        {screen === 'booking' && (
          <div className="p-6 space-y-6">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Pickup Zone</label>
              <select 
                value={pickup} 
                onChange={(e) => setPickup(e.target.value)}
                className="w-full p-4 border border-gray-300 rounded-xl bg-gray-50 text-black font-medium focus:outline-none focus:ring-2 focus:ring-black"
              >
                <option value="Downtown">Downtown Area</option>
                <option value="North Station">North Station</option>
                <option value="City Park">City Park</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Exact Location</label>
              <input 
                type="text" 
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="e.g. In front of Starbucks" 
                className="w-full p-4 border border-gray-300 rounded-xl bg-gray-50 text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>

            <div className="bg-gray-50 p-4 rounded-xl flex justify-between items-center">
              <span className="text-gray-500 text-sm">Est. Price</span>
              <span className="text-black font-bold text-xl">$12.50</span>
            </div>

            <button 
              onClick={handleRequestRide}
              disabled={isLoading}
              className="w-full bg-black text-white p-4 rounded-xl font-bold text-lg hover:bg-gray-800 transition active:scale-95"
            >
              {isLoading ? "Processing..." : "REQUEST RIDE"}
            </button>
          </div>
        )}

        {/* --- SCREEN 2: SEARCHING --- */}
        {screen === 'searching' && (
          <div className="p-12 text-center space-y-8">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-gray-200 border-t-black rounded-full animate-spin mx-auto"></div>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-black">Contacting Drivers</h2>
              <p className="text-gray-500 mt-2">We are sending your request to nearby drivers...</p>
            </div>
            <button onClick={() => setScreen('booking')} className="text-red-500 font-semibold text-sm hover:underline">
              Cancel Request
            </button>
          </div>
        )}

        {/* --- SCREEN 3: ACCEPTED --- */}
        {screen === 'accepted' && (
          <div className="p-0 animate-in fade-in zoom-in duration-300">
            <div className="bg-green-500 p-6 text-white text-center">
              <div className="text-6xl mb-2">✓</div>
              <h2 className="text-2xl font-bold">Driver Found!</h2>
              <p className="text-white/80 text-sm">Your ride is on the way</p>
            </div>
            <div className="p-8 space-y-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center text-xl">🚕</div>
                <div>
                  <h3 className="font-bold text-lg text-black">{driverName}</h3>
                  <p className="text-gray-500 text-sm">Rating: 4.9 ★</p>
                </div>
              </div>
              
              <div className="h-px bg-gray-200"></div>

              {/* DYNAMIC CHAT BUTTON */}
              {driverUsername ? (
                <a 
                  href={`https://t.me/${driverUsername}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block w-full text-center bg-blue-500 text-white p-4 rounded-xl font-bold hover:bg-blue-600 transition"
                >
                  💬 Chat with {driverName}
                </a>
              ) : (
                <button disabled className="w-full bg-gray-100 text-gray-400 p-4 rounded-xl font-bold">
                  (Driver has no username)
                </button>
              )}
            </div>
          </div>
        )}

        {/* --- SCREEN 4: ARRIVED --- */}
        {screen === 'arrived' && (
          <div className="p-0 animate-in fade-in zoom-in duration-300">
            <div className="bg-yellow-400 p-8 text-black text-center">
              <div className="text-6xl mb-2">📍</div>
              <h2 className="text-3xl font-bold">DRIVER HERE</h2>
              <p className="text-black/70 text-sm font-medium mt-1">Look for {driverName}</p>
            </div>
            <div className="p-8 text-center space-y-4">
              <p className="text-gray-600">Please meet your driver at the pickup point.</p>
              <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-500">
                 Ride Status: <strong>Waiting for Passenger</strong>
              </div>
            </div>
          </div>
        )}

        {/* --- SCREEN 5: COMPLETED --- */}
        {screen === 'completed' && (
          <div className="p-0 animate-in fade-in zoom-in duration-300">
            <div className="bg-black p-8 text-white text-center">
              <div className="text-6xl mb-2">🏁</div>
              <h2 className="text-2xl font-bold">Ride Complete</h2>
              <p className="text-white/70 text-sm">Thank you for riding with us!</p>
            </div>
            <div className="p-8 space-y-6">
              <div className="text-center">
                <p className="text-gray-500 mb-2">Total Fare</p>
                <p className="text-4xl font-bold text-black">$12.50</p>
              </div>
              <button 
                onClick={resetApp}
                className="w-full border-2 border-black bg-black text-white p-4 rounded-xl font-bold hover:bg-gray-800 transition"
              >
                Book Another Ride
              </button>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}