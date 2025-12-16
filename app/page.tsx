"use client";
import { useState, useEffect } from 'react';
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue } from "firebase/database";

// Firebase Config
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
  
  // NEW INPUTS
  const [phone, setPhone] = useState('');
  const [passengers, setPassengers] = useState('1');

  const [currentRideId, setCurrentRideId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [driverName, setDriverName] = useState('Driver');
  const [rideStatus, setRideStatus] = useState('');

  // Simulating Distance/Price Calculation
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
      // 1. Save FULL details to Firebase
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

      // 2. Send to Telegram
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
    setCurrentRideId(null);
    setDriverName('Driver');
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-200">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100">
        
        <div className="bg-black p-5 text-white text-center">
          <h1 className="font-bold text-2xl tracking-wider">URBAN RIDE</h1>
        </div>

        {screen === 'booking' && (
          <div className="p-6 space-y-4">
            
            {/* Pickup */}
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Pickup Zone</label>
              <select value={pickup} onChange={(e) => setPickup(e.target.value)} className="w-full p-3 border rounded-xl bg-gray-50">
                <option value="Downtown">Downtown Area</option>
                <option value="North Station">North Station</option>
              </select>
            </div>

            {/* Destination */}
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Destination</label>
              <select value={destination} onChange={(e) => setDestination(e.target.value)} className="w-full p-3 border rounded-xl bg-gray-50">
                <option value="Airport">City Airport</option>
                <option value="Mall">Central Mall</option>
              </select>
            </div>

            {/* Exact Details */}
            <input type="text" value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Exact Spot (e.g. Starbucks)" className="w-full p-3 border rounded-xl" />

            {/* Phone & Pax */}
            <div className="flex gap-2">
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone Number" className="flex-1 p-3 border rounded-xl" />
              <select value={passengers} onChange={(e) => setPassengers(e.target.value)} className="w-20 p-3 border rounded-xl">
                <option>1</option><option>2</option><option>3</option><option>4</option>
              </select>
            </div>

            <div className="bg-gray-50 p-4 rounded-xl flex justify-between items-center">
              <span className="text-gray-500 text-sm">{distance}</span>
              <span className="text-black font-bold text-xl">{price}</span>
            </div>

            <button onClick={handleRequestRide} disabled={isLoading} className="w-full bg-black text-white p-4 rounded-xl font-bold">{isLoading ? "Processing..." : "REQUEST RIDE"}</button>
          </div>
        )}

        {screen === 'searching' && (
          <div className="p-12 text-center space-y-8">
            <div className="w-16 h-16 border-4 border-gray-200 border-t-black rounded-full animate-spin mx-auto"></div>
            <h2 className="text-2xl font-bold">Contacting Drivers...</h2>
          </div>
        )}

        {screen === 'accepted' && (
          <div className="p-0">
             <div className="bg-green-500 p-6 text-white text-center">
               <h2 className="text-2xl font-bold">Driver Found!</h2>
             </div>
             <div className="p-8 text-center space-y-4">
                <h3 className="text-xl font-bold">{driverName}</h3>
                <p>is on the way.</p>
             </div>
          </div>
        )}

        {screen === 'arrived' && (
          <div className="p-0">
             <div className="bg-yellow-400 p-6 text-black text-center">
               <h2 className="text-2xl font-bold">DRIVER HERE</h2>
             </div>
             <div className="p-8 text-center"><p>Please meet outside.</p></div>
          </div>
        )}

        {screen === 'completed' && (
          <div className="p-8 text-center space-y-6">
            <h2 className="text-3xl font-bold">Ride Complete</h2>
            <button onClick={resetApp} className="w-full bg-black text-white p-4 rounded-xl font-bold">Book Again</button>
          </div>
        )}
      </div>
    </main>
  );
}