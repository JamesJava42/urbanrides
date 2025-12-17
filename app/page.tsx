"use client";
import { useState, useEffect } from 'react';
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue, push } from "firebase/database";

// ✅ YOUR MAPBOX TOKEN IS INTEGRATED HERE
const MAPBOX_TOKEN = "pk.eyJ1IjoibXJlZGR5MyIsImEiOiJjbWo5Z2ZscnIwMnF1M2dxN2ZmbDFhbndrIn0.7BkiOhLKLpTO-Qp_3eYiHw";
const PRICE_PER_MILE = 1.5;

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
  
  // Inputs
  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [phone, setPhone] = useState('');
  const [passengers, setPassengers] = useState('1');
  
  // Smart Data
  const [pickupCoords, setPickupCoords] = useState<number[] | null>(null);
  const [destCoords, setDestCoords] = useState<number[] | null>(null);
  const [distance, setDistance] = useState('');
  const [price, setPrice] = useState('$0.00');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [activeField, setActiveField] = useState('');

  // App State
  const [currentRideId, setCurrentRideId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [driverName, setDriverName] = useState('Driver');
  const [driverUsername, setDriverUsername] = useState('');
  
  // Chat
  const [chatMessage, setChatMessage] = useState('');
  const [messages, setMessages] = useState<any[]>([]);

  // --- MAPBOX ADDRESS SEARCH ---
  const handleSearch = async (query: string, field: string) => {
    if (field === 'pickup') setPickup(query);
    else setDestination(query);
    setActiveField(field);

    if (query.length > 2) {
      try {
        const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&country=us&types=address,poi`);
        const data = await res.json();
        setSuggestions(data.features || []);
      } catch(e) { console.error(e); }
    } else {
      setSuggestions([]);
    }
  };

  const selectAddress = (feature: any) => {
    const coords = feature.center; // [lng, lat]
    if (activeField === 'pickup') {
        setPickup(feature.place_name);
        setPickupCoords(coords);
    } else {
        setDestination(feature.place_name);
        setDestCoords(coords);
    }
    setSuggestions([]);
    
    // If both set, calculate price
    if (activeField === 'pickup' ? destCoords : pickupCoords) {
        calculateRoute(activeField === 'pickup' ? coords : pickupCoords, activeField === 'pickup' ? destCoords : coords);
    }
  };

  const calculateRoute = async (start: any, end: any) => {
      if(!start || !end) return;
      try {
        const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${start[0]},${start[1]};${end[0]},${end[1]}?access_token=${MAPBOX_TOKEN}`;
        const res = await fetch(url);
        const data = await res.json();
        
        if(data.routes && data.routes[0]) {
            const meters = data.routes[0].distance;
            const miles = (meters / 1609.34).toFixed(1);
            const cost = (parseFloat(miles) * PRICE_PER_MILE).toFixed(2);
            
            setDistance(`${miles} miles`);
            setPrice(`$${cost}`);
        }
      } catch(e) { console.error("Route Error", e); }
  };

  // --- RIDE LOGIC ---
  const handleRequestRide = async () => {
    if(!pickup || !destination || !phone) { alert("Please fill all details"); return; }
    setIsLoading(true);
    setScreen('searching');
    
    const rideId = 'ride_' + Date.now();
    setCurrentRideId(rideId);

    // Save to Firebase
    await set(ref(db, 'rides/' + rideId), {
      status: 'PENDING',
      pickup, destination, phone, passengers,
      price, distance, timestamp: Date.now()
    });

    // Send to Telegram
    await fetch('/api/ride-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pickup, destination, price, distance, passengers, rideId, phone })
    });

    setIsLoading(false);
  };

  // --- CHAT & UPDATES ---
  useEffect(() => {
    if (!currentRideId) return;
    const rideRef = ref(db, 'rides/' + currentRideId);
    
    const unsubscribe = onValue(rideRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        if (data.driverName) setDriverName(data.driverName);
        if (data.driverUsername) setDriverUsername(data.driverUsername);
        
        if (data.status === 'ACCEPTED') setScreen('accepted');
        else if (data.status === 'ARRIVED') setScreen('arrived');
        else if (data.status === 'COMPLETED') setScreen('completed');
        
        // Chat Messages
        if (data.messages) {
            setMessages(Object.values(data.messages));
        }
      }
    });
    return () => unsubscribe();
  }, [currentRideId]);

  const sendMessage = async () => {
    if(!chatMessage) return;
    const msg = chatMessage;
    setChatMessage('');
    
    // Save to Firebase (Instant UI update)
    await push(ref(db, `rides/${currentRideId}/messages`), {
        sender: 'user', text: msg, timestamp: Date.now()
    });
    
    // Notify Driver via Telegram
    await fetch('/api/send-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rideId: currentRideId, message: msg })
    });
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-100 font-sans text-black">
      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden border border-gray-200">
        
        {/* HEADER */}
        <div className="bg-black p-5 text-white flex justify-between items-center">
            <h1 className="font-bold text-xl tracking-widest">URBAN RIDE</h1>
            <div className="text-xs uppercase tracking-wide opacity-70">Premium</div>
        </div>

        {/* --- BOOKING SCREEN --- */}
        {screen === 'booking' && (
          <div className="p-6 space-y-5 relative">
            
            {/* Pickup Input */}
            <div>
                <label className="text-xs font-bold text-gray-500 uppercase ml-1">Pickup Location</label>
                <input 
                    type="text" 
                    value={pickup}
                    onChange={(e) => handleSearch(e.target.value, 'pickup')}
                    placeholder="Search pickup..." 
                    className="w-full p-3 bg-gray-50 border-b-2 border-gray-200 focus:border-black outline-none transition-colors"
                />
            </div>

            {/* Destination Input */}
            <div>
                <label className="text-xs font-bold text-gray-500 uppercase ml-1">Destination</label>
                <input 
                    type="text" 
                    value={destination}
                    onChange={(e) => handleSearch(e.target.value, 'dest')}
                    placeholder="Search destination..." 
                    className="w-full p-3 bg-gray-50 border-b-2 border-gray-200 focus:border-black outline-none transition-colors"
                />
            </div>

            {/* AUTOCOMPLETE DROPDOWN */}
            {suggestions.length > 0 && (
                <div className="absolute z-10 bg-white shadow-xl border rounded-lg w-3/4 left-6 mt-[-10px]">
                    {suggestions.map((item, i) => (
                        <div key={i} onClick={() => selectAddress(item)} className="p-3 border-b hover:bg-gray-100 cursor-pointer text-sm truncate">
                            {item.place_name}
                        </div>
                    ))}
                </div>
            )}

            {/* Phone & Pax */}
            <div className="flex gap-4">
                <div className="flex-1">
                    <label className="text-xs font-bold text-gray-500 uppercase ml-1">Phone</label>
                    <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="555-0123" className="w-full p-3 bg-gray-50 border-b-2 border-gray-200 focus:border-black outline-none" />
                </div>
                <div className="w-20">
                    <label className="text-xs font-bold text-gray-500 uppercase ml-1">Pax</label>
                    <select value={passengers} onChange={e => setPassengers(e.target.value)} className="w-full p-3 bg-gray-50 border-b-2 border-gray-200 outline-none">
                        <option>1</option><option>2</option><option>3</option><option>4</option>
                    </select>
                </div>
            </div>

            {/* Price Box */}
            <div className="flex justify-between items-center bg-black text-white p-4 rounded-lg shadow-lg mt-4">
                <div>
                    <p className="text-xs text-gray-400">ESTIMATED PRICE</p>
                    <p className="text-2xl font-bold">{price}</p>
                </div>
                <div className="text-right">
                    <p className="text-xs text-gray-400">DISTANCE</p>
                    <p className="font-medium">{distance || "0 mi"}</p>
                </div>
            </div>

            <button onClick={handleRequestRide} disabled={isLoading} className="w-full bg-black hover:bg-gray-800 text-white p-4 rounded-lg font-bold text-lg transition-all shadow-md">
                {isLoading ? "CALCULATING..." : "REQUEST RIDE"}
            </button>
          </div>
        )}

        {/* --- SEARCHING --- */}
        {screen === 'searching' && (
          <div className="p-12 text-center space-y-6">
             <div className="w-16 h-16 border-4 border-gray-200 border-t-black rounded-full animate-spin mx-auto"></div>
             <h2 className="text-xl font-bold uppercase tracking-wider">Contacting Drivers</h2>
             <p className="text-sm text-gray-500">Please wait while we find a match...</p>
          </div>
        )}

        {/* --- ACCEPTED / ARRIVED (WITH CHAT) --- */}
        {(screen === 'accepted' || screen === 'arrived') && (
            <div className="flex flex-col h-[600px]">
                <div className={`${screen === 'arrived' ? 'bg-yellow-400 text-black' : 'bg-green-600 text-white'} p-4 text-center font-bold shadow-md`}>
                    {screen === 'arrived' ? '📍 DRIVER ARRIVED' : `✓ DRIVER FOUND: ${driverName}`}
                </div>
                
                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50">
                    {messages.map((m, i) => (
                        <div key={i} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] p-3 rounded-xl text-sm shadow-sm ${m.sender === 'user' ? 'bg-black text-white' : 'bg-white border text-black'}`}>
                                {m.text}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Actions */}
                <div className="p-3 bg-white border-t space-y-3">
                     <div className="flex gap-2">
                        <input value={chatMessage} onChange={e => setChatMessage(e.target.value)} placeholder="Message driver..." className="flex-1 p-3 border rounded-lg outline-none" />
                        <button onClick={sendMessage} className="bg-black text-white px-4 rounded-lg font-bold">SEND</button>
                     </div>
                     
                     {/* CONTACT DRIVER BUTTONS */}
                     {driverUsername && (
                        <a href={`https://t.me/${driverUsername}`} target="_blank" className="block text-center w-full bg-blue-500 text-white p-3 rounded-lg font-bold">
                            🔵 Open Telegram Chat
                        </a>
                     )}
                </div>
            </div>
        )}

        {/* --- COMPLETED --- */}
        {screen === 'completed' && (
             <div className="p-10 text-center space-y-6">
                <h2 className="text-3xl font-bold">RIDE COMPLETED</h2>
                <div className="text-5xl">🏁</div>
                <p className="text-gray-500">Total: {price}</p>
                <button onClick={() => setScreen('booking')} className="w-full bg-black text-white p-4 rounded-lg font-bold">BOOK NEW RIDE</button>
             </div>
        )}

      </div>
    </main>
  );
}