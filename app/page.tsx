"use client";
import { useState, useEffect } from 'react';
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue } from "firebase/database";

// 1. Initialize Firebase with Environment Variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: "https://urbanride4244-default-rtdb.firebaseio.com/"
};

// Initialize App
// Note: We check if window exists to avoid server-side errors in some setups, 
// though standard Next.js handles this fine.
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export default function Home() {
  const [screen, setScreen] = useState('booking');
  const [pickup, setPickup] = useState('Downtown Area');
  const [details, setDetails] = useState('');
  const [currentRideId, setCurrentRideId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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
      // 1. Save to Firebase
      await set(ref(db, 'rides/' + rideId), {
        status: 'PENDING',
        pickup: pickup,
        details: details,
        timestamp: Date.now()
      });

      // 2. Trigger Telegram
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

      if (!res.ok) {
        throw new Error("Failed to send to Telegram");
      }

    } catch (error) {
      console.error(error);
      alert("Error connecting. Check console.");
      setScreen('booking');
    } finally {
      setIsLoading(false);
    }
  };

  // Listener: Watch for Driver Acceptance
  useEffect(() => {
    if (!currentRideId) return;
    const rideRef = ref(db, 'rides/' + currentRideId);
    
    const unsubscribe = onValue(rideRef, (snapshot) => {
      const data = snapshot.val();
      if (data && data.status === 'ACCEPTED') {
        setScreen('accepted');
      }
    });
    return () => unsubscribe();
  }, [currentRideId]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-200">
      
      {/* Mobile Card Container */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100">
        
        {/* Header */}
        <div className="bg-black p-5 text-white text-center">
          <h1 className="font-bold text-2xl tracking-wider">URBAN RIDE</h1>
          <p className="text-gray-400 text-xs mt-1">FAST & RELIABLE</p>
        </div>

        {/* --- SCREEN 1: BOOKING --- */}
        {screen === 'booking' && (
          <div className="p-6 space-y-6">
            
            {/* Pickup Zone */}
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

            {/* Exact Details */}
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

            {/* Price Estimate */}
            <div className="bg-gray-50 p-4 rounded-xl flex justify-between items-center">
              <span className="text-gray-500 text-sm">Est. Price</span>
              <span className="text-black font-bold text-xl">$12.50</span>
            </div>

            {/* Action Button */}
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
          <div className="p-0">
            <div className="bg-green-500 p-6 text-white text-center">
              <div className="text-6xl mb-2">✓</div>
              <h2 className="text-2xl font-bold">Driver Found!</h2>
            </div>
            <div className="p-8 space-y-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center text-xl">👤</div>
                <div>
                  <h3 className="font-bold text-lg text-black">John Doe</h3>
                  <p className="text-gray-500 text-sm">Silver Toyota Camry</p>
                </div>
              </div>
              <div className="h-px bg-gray-200"></div>
              <button 
                onClick={() => alert('Opening Telegram...')} 
                className="w-full border-2 border-black text-black p-4 rounded-xl font-bold hover:bg-gray-50 transition"
              >
                Message Driver
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}