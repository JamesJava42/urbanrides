"use client";
import { useState, useEffect } from 'react';
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue } from "firebase/database";

// 1. Firebase Config (Keep your exact keys)
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
  const [screen, setScreen] = useState('booking');
  const [pickup, setPickup] = useState('Downtown Area');
  const [destination, setDestination] = useState('Airport');
  const [details, setDetails] = useState('');
  
  // NEW: Phone & Pax
  const [phone, setPhone] = useState('');
  const [passengers, setPassengers] = useState('1');

  const [currentRideId, setCurrentRideId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [driverName, setDriverName] = useState('Driver');
  const [driverUsername, setDriverUsername] = useState('');
  const [rideStatus, setRideStatus] = useState('');

  const price = "$25.00"; 
  const distance = "8.4 miles";

  const handleRequestRide = async () => {
    if(!details || !phone) {
      alert("Please enter exact location and phone number");
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
        destination: destination,
        details: details,
        phone: phone,          
        passengers: passengers,
        price: price,
        distance: distance,
        timestamp: Date.now()
      });

      await fetch('/api/ride-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          pickup: `${pickup} (${details})`, 
          destination: destination, 
          price: price, 
          distance: distance,
          passengers: passengers,
          rideId: rideId 
        })
      });

    } catch (error) {
      console.error(error);
      setScreen('booking');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!currentRideId) return;
    const rideRef = ref(db, 'rides/' + currentRideId);
    
    const unsubscribe = onValue(rideRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setRideStatus(data.status);
        if (data.driverName) setDriverName(data.driverName);
        if (data.driverUsername) setDriverUsername(data.driverUsername);

        if (data.status === 'ACCEPTED') setScreen('accepted');
        else if (data.status === 'ARRIVED') setScreen('arrived');
        else if (data.status === 'COMPLETED') setScreen('completed');
        else if (data.status === 'CANCELLED') {
           alert("Driver cancelled. Please request again.");
           setScreen('booking');
        }
      }
    });
    return () => unsubscribe();
  }, [currentRideId]);

  const resetApp = () => {
    setScreen('booking');
    setDetails('');
    setPhone('');
    setCurrentRideId(null);
    setDriverName('Driver');
    setDriverUsername('');
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-slate-100 text-slate-900">
      
      {/* CARD CONTAINER */}
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 transition-all duration-300">
        
        {/* HEADER */}
        <div className="bg-slate-900 p-6 text-white flex justify-between items-center shadow-md z-10 relative">
          <div>
            <h1 className="font-bold text-xl tracking-wide">URBAN RIDE</h1>
            <p className="text-slate-400 text-xs mt-0.5">Premium Service</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold">
            U
          </div>
        </div>

        {/* --- BOOKING SCREEN --- */}
        {screen === 'booking' && (
          <div className="p-6 space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* Route Selection */}
            <div className="space-y-3">
              <div className="relative">
                <div className="absolute left-4 top-3.5 text-green-500 text-lg">●</div>
                <select value={pickup} onChange={(e) => setPickup(e.target.value)} className="w-full pl-10 p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-slate-900">
                  <option value="Downtown">Downtown Area</option>
                  <option value="North Station">North Station</option>
                  <option value="City Park">City Park</option>
                </select>
              </div>

              <div className="relative">
                <div className="absolute left-4 top-3.5 text-red-500 text-lg">●</div>
                <select value={destination} onChange={(e) => setDestination(e.target.value)} className="w-full pl-10 p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-slate-900">
                  <option value="Airport">City Airport</option>
                  <option value="Mall">Central Mall</option>
                  <option value="Hotel">Grand Hotel</option>
                </select>
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* Details Input */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">Exact Pickup Spot</label>
              <input 
                type="text" 
                value={details} 
                onChange={(e) => setDetails(e.target.value)} 
                placeholder="e.g. In front of Starbucks" 
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all" 
              />
            </div>

            {/* Phone & Pax Row */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">My Phone</label>
                <input 
                  type="tel" 
                  value={phone} 
                  onChange={(e) => setPhone(e.target.value)} 
                  placeholder="555-0123" 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900" 
                />
              </div>
              <div className="w-24">
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">Pax</label>
                <select 
                  value={passengers} 
                  onChange={(e) => setPassengers(e.target.value)} 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option>1</option><option>2</option><option>3</option><option>4</option>
                </select>
              </div>
            </div>

            {/* Price Estimate */}
            <div className="flex justify-between items-center bg-slate-900 text-white p-4 rounded-xl shadow-lg mt-2">
              <div>
                <p className="text-slate-400 text-xs">Estimated Fare</p>
                <p className="font-bold text-xl">{price}</p>
              </div>
              <div className="text-right">
                <p className="text-slate-400 text-xs">Distance</p>
                <p className="font-medium">{distance}</p>
              </div>
            </div>

            {/* Main Button */}
            <button 
              onClick={handleRequestRide}
              disabled={isLoading}
              className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold text-lg hover:bg-blue-700 transition-all active:scale-95 shadow-md disabled:bg-slate-300"
            >
              {isLoading ? "Looking for Drivers..." : "CONFIRM RIDE"}
            </button>
          </div>
        )}

        {/* --- SEARCHING SCREEN --- */}
        {screen === 'searching' && (
          <div className="p-10 text-center space-y-8 min-h-[400px] flex flex-col justify-center animate-in fade-in duration-500">
            <div className="relative mx-auto w-24 h-24">
              <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Connecting...</h2>
              <p className="text-slate-500 mt-2 text-sm px-4">We are sending your request to the nearest drivers.</p>
            </div>
            <button onClick={() => setScreen('booking')} className="text-red-500 text-sm font-semibold hover:bg-red-50 px-4 py-2 rounded-lg transition">
              Cancel Request
            </button>
          </div>
        )}

        {/* --- ACCEPTED SCREEN --- */}
        {screen === 'accepted' && (
          <div className="min-h-[400px] animate-in slide-in-from-bottom-10 fade-in duration-500">
             <div className="bg-green-500 p-8 text-white text-center rounded-b-3xl shadow-lg relative z-10">
               <div className="text-5xl mb-3 animate-bounce">🚖</div>
               <h2 className="text-2xl font-bold">Driver Found!</h2>
               <p className="text-green-100 text-sm mt-1">Arrival in 4 mins</p>
             </div>
             
             <div className="p-8 space-y-6">
                <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <div className="w-14 h-14 bg-slate-200 rounded-full flex items-center justify-center text-2xl shadow-inner">👤</div>
                  <div>
                    <h3 className="font-bold text-lg text-slate-900">{driverName}</h3>
                    <div className="flex items-center text-yellow-500 text-sm">
                      ★★★★★ <span className="text-slate-400 ml-1">(5.0)</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {driverUsername ? (
                    <a 
                      href={`https://t.me/${driverUsername}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center justify-center w-full bg-blue-500 text-white p-4 rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-600 transition-all active:scale-95"
                    >
                      💬 Chat with Driver
                    </a>
                  ) : (
                    <div className="text-center text-slate-400 text-sm italic">Driver has no chat enabled</div>
                  )}
                  
                  <button className="w-full bg-slate-100 text-slate-500 p-4 rounded-xl font-bold hover:bg-slate-200 transition">
                    Call Driver
                  </button>
                </div>
             </div>
          </div>
        )}

        {/* --- ARRIVED SCREEN --- */}
        {screen === 'arrived' && (
          <div className="min-h-[400px] bg-yellow-50 animate-in zoom-in fade-in duration-500 flex flex-col items-center justify-center p-8 text-center">
             <div className="w-24 h-24 bg-yellow-400 rounded-full flex items-center justify-center text-4xl shadow-xl shadow-yellow-200 mb-6 animate-pulse">
               📍
             </div>
             <h2 className="text-3xl font-black text-slate-900">DRIVER IS HERE</h2>
             <p className="text-slate-600 mt-2 text-lg">Please meet {driverName} at the pickup point.</p>
             
             <div className="mt-8 bg-white p-4 rounded-xl shadow-sm border border-yellow-100 w-full max-w-xs">
               <p className="text-xs text-slate-400 uppercase font-bold">Vehicle</p>
               <p className="text-slate-800 font-bold">Toyota Prius • Silver</p>
             </div>
          </div>
        )}

        {/* --- COMPLETED SCREEN --- */}
        {screen === 'completed' && (
          <div className="min-h-[400px] bg-slate-900 text-white animate-in fade-in duration-700 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center text-4xl shadow-2xl shadow-green-500/50 mb-6">
              ✓
            </div>
            <h2 className="text-3xl font-bold">Ride Complete</h2>
            <p className="text-slate-400 mt-2">Thank you for riding with us.</p>
            
            <div className="mt-8 mb-8 text-center">
              <p className="text-slate-500 text-sm">Total Fare</p>
              <p className="text-4xl font-bold text-white tracking-tight">{price}</p>
            </div>

            <button 
              onClick={resetApp} 
              className="w-full bg-white text-black p-4 rounded-xl font-bold hover:bg-slate-200 transition active:scale-95"
            >
              Book Another Ride
            </button>
          </div>
        )}

      </div>
    </main>
  );
}