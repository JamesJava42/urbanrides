"use client";
import { useState, useEffect } from 'react';
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue, push } from "firebase/database";

// --- CONFIGURATION ---
const MAPBOX_TOKEN = "pk.eyJ1IjoibXJlZGR5MyIsImEiOiJjbWo5Z2ZscnIwMnF1M2dxN2ZmbDFhbndrIn0.7BkiOhLKLpTO-Qp_3eYiHw";
const PRICE_PER_MILE = 1.5;

// --- FIREBASE SETUP ---
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

// ==========================================
// MODULE 1: THE BOOKING FORM
// ==========================================
function BookingModule({ onSubmit, isLoading }: any) {
  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  
  // NEW: Date & Time
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  
  const [phone, setPhone] = useState('');
  const [passengers, setPassengers] = useState('1');
  
  // Map Logic
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [activeField, setActiveField] = useState('');
  const [price, setPrice] = useState('$0.00');
  const [distance, setDistance] = useState('');
  const [coordsP, setCoordsP] = useState<number[]|null>(null);
  const [coordsD, setCoordsD] = useState<number[]|null>(null);
  const [mapStatus, setMapStatus] = useState<string>('neutral'); // neutral, success, error

  // Search Address
  const handleSearch = async (query: string, field: string) => {
    if (field === 'pickup') setPickup(query); else setDestination(query);
    setActiveField(field);

    if (query.length > 2) {
      try {
        const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&country=us&types=address,poi`);
        if (!res.ok) throw new Error("API Error");
        const data = await res.json();
        setSuggestions(data.features || []);
        setMapStatus('success');
      } catch (e) {
        setMapStatus('error');
        console.error("Mapbox Error:", e);
      }
    } else {
      setSuggestions([]);
    }
  };

  // Select Address
  const selectAddress = (item: any) => {
    const coords = item.center;
    if (activeField === 'pickup') { setPickup(item.place_name); setCoordsP(coords); } 
    else { setDestination(item.place_name); setCoordsD(coords); }
    
    setSuggestions([]);
    
    // Calculate Price if both filled
    if (activeField === 'pickup' ? coordsD : coordsP) {
       calcPrice(activeField === 'pickup' ? coords : coordsP, activeField === 'pickup' ? coordsD : coords);
    }
  };

  const calcPrice = async (start: any, end: any) => {
     if(!start || !end) return;
     try {
       const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${start[0]},${start[1]};${end[0]},${end[1]}?access_token=${MAPBOX_TOKEN}`;
       const res = await fetch(url);
       const data = await res.json();
       if(data.routes?.[0]) {
           const miles = (data.routes[0].distance / 1609.34).toFixed(1);
           const cost = (parseFloat(miles) * PRICE_PER_MILE).toFixed(2);
           setDistance(`${miles} mi`);
           setPrice(`$${cost}`);
       }
     } catch(e) { console.error(e); }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
        
        {/* Map Status Indicator */}
        <div className="flex justify-end">
            <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${mapStatus === 'error' ? 'bg-red-100 text-red-600' : mapStatus === 'success' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                {mapStatus === 'error' ? 'Maps Offline' : mapStatus === 'success' ? 'Maps Active' : 'Maps Ready'}
            </span>
        </div>

        {/* INPUTS CONTAINER */}
        <div className="space-y-4 relative">
            
            {/* Pickup */}
            <div className="relative">
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Pickup Location</label>
                <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-3 focus-within:ring-2 focus-within:ring-blue-500">
                    <span className="text-green-500 mr-3">●</span>
                    <input type="text" value={pickup} onChange={(e)=>handleSearch(e.target.value, 'pickup')} placeholder="Enter pickup address" className="bg-transparent w-full outline-none text-slate-900 font-medium"/>
                </div>
                {/* DROPDOWN (Fixed Z-Index) */}
                {activeField === 'pickup' && suggestions.length > 0 && (
                    <div className="absolute z-50 top-full left-0 w-full bg-white shadow-2xl border border-slate-200 rounded-lg mt-1 max-h-60 overflow-y-auto">
                        {suggestions.map((s,i)=>(<div key={i} onClick={()=>selectAddress(s)} className="p-3 hover:bg-blue-50 cursor-pointer text-sm border-b">{s.place_name}</div>))}
                    </div>
                )}
            </div>

            {/* Destination */}
            <div className="relative">
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Destination</label>
                <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-3 focus-within:ring-2 focus-within:ring-blue-500">
                    <span className="text-red-500 mr-3">●</span>
                    <input type="text" value={destination} onChange={(e)=>handleSearch(e.target.value, 'dest')} placeholder="Enter destination" className="bg-transparent w-full outline-none text-slate-900 font-medium"/>
                </div>
                {/* DROPDOWN */}
                {activeField === 'dest' && suggestions.length > 0 && (
                    <div className="absolute z-50 top-full left-0 w-full bg-white shadow-2xl border border-slate-200 rounded-lg mt-1 max-h-60 overflow-y-auto">
                        {suggestions.map((s,i)=>(<div key={i} onClick={()=>selectAddress(s)} className="p-3 hover:bg-blue-50 cursor-pointer text-sm border-b">{s.place_name}</div>))}
                    </div>
                )}
            </div>

            {/* Date & Time & Pax Row */}
            <div className="flex gap-2">
                <div className="flex-1">
                     <label className="text-[10px] font-bold text-slate-400 uppercase">Date</label>
                     <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="w-full p-2 bg-slate-50 border rounded text-sm"/>
                </div>
                <div className="flex-1">
                     <label className="text-[10px] font-bold text-slate-400 uppercase">Time</label>
                     <input type="time" value={time} onChange={e=>setTime(e.target.value)} className="w-full p-2 bg-slate-50 border rounded text-sm"/>
                </div>
                <div className="w-16">
                     <label className="text-[10px] font-bold text-slate-400 uppercase">Pax</label>
                     <select value={passengers} onChange={e=>setPassengers(e.target.value)} className="w-full p-2 bg-slate-50 border rounded text-sm h-[38px]">
                        <option>1</option><option>2</option><option>3</option><option>4</option>
                     </select>
                </div>
            </div>

            {/* Phone */}
            <div>
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">My Phone Number</label>
                <input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="(555) 000-0000" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            </div>

        </div>

        {/* Pricing Card */}
        <div className="bg-slate-900 text-white p-4 rounded-xl flex justify-between items-center shadow-lg">
            <div>
                <p className="text-xs text-slate-400 font-bold uppercase">Estimated Fare</p>
                <p className="text-2xl font-bold tracking-tight">{price}</p>
            </div>
            <div className="text-right">
                <p className="text-xs text-slate-400 font-bold uppercase">Distance</p>
                <p className="text-lg font-medium">{distance || '--'}</p>
            </div>
        </div>

        <button onClick={()=>onSubmit({pickup, destination, phone, passengers, price, distance, date, time})} disabled={isLoading} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold text-lg shadow-blue-200 shadow-lg transition-all active:scale-95 disabled:opacity-50">
            {isLoading ? 'Processing Request...' : 'Confirm Booking'}
        </button>
    </div>
  );
}

// ==========================================
// MODULE 2: RIDE STATUS & CHAT
// ==========================================
function RideStatusModule({ rideId, onReset }: any) {
    const [status, setStatus] = useState('PENDING');
    const [driver, setDriver] = useState({ name: 'Finding Driver...', username: '' });
    const [messages, setMessages] = useState<any[]>([]);
    const [input, setInput] = useState('');

    useEffect(() => {
        const rideRef = ref(db, `rides/${rideId}`);
        return onValue(rideRef, (snapshot) => {
            const data = snapshot.val();
            if(data) {
                setStatus(data.status);
                if(data.driverName) setDriver({ name: data.driverName, username: data.driverUsername });
                if(data.messages) setMessages(Object.values(data.messages));
            }
        });
    }, [rideId]);

    const sendMsg = async () => {
        if(!input) return;
        await push(ref(db, `rides/${rideId}/messages`), { sender: 'user', text: input, timestamp: Date.now() });
        await fetch('/api/send-chat', { method: 'POST', body: JSON.stringify({ rideId, message: input }) });
        setInput('');
    };

    if(status === 'COMPLETED') {
        return (
            <div className="text-center py-10 space-y-6 animate-in zoom-in">
                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-4xl mx-auto">✓</div>
                <h2 className="text-2xl font-bold text-slate-800">Ride Completed</h2>
                <button onClick={onReset} className="w-full bg-slate-900 text-white p-4 rounded-xl font-bold">Book New Ride</button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[500px] animate-in slide-in-from-bottom-4">
            {/* Status Header */}
            <div className={`p-4 text-center rounded-t-xl font-bold text-white shadow-md ${status === 'ARRIVED' ? 'bg-yellow-500' : status === 'ACCEPTED' ? 'bg-green-600' : 'bg-blue-500'}`}>
                {status === 'PENDING' ? 'SEARCHING FOR DRIVERS...' : 
                 status === 'ACCEPTED' ? `DRIVER FOUND: ${driver.name}` : 
                 'DRIVER ARRIVED'}
            </div>

            {/* Chat Window */}
            <div className="flex-1 bg-slate-50 border-x border-slate-200 overflow-y-auto p-4 space-y-3">
                {status === 'PENDING' && (
                    <div className="flex justify-center mt-10"><div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div></div>
                )}
                {messages.map((m, i) => (
                    <div key={i} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] p-3 rounded-2xl text-sm shadow-sm ${m.sender === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-slate-800 border rounded-bl-none'}`}>
                            {m.text}
                        </div>
                    </div>
                ))}
            </div>

            {/* Input Area */}
            {(status === 'ACCEPTED' || status === 'ARRIVED') && (
                <div className="p-3 bg-white border border-t-0 rounded-b-xl space-y-3">
                    <div className="flex gap-2">
                        <input value={input} onChange={e=>setInput(e.target.value)} placeholder="Message driver..." className="flex-1 p-3 bg-slate-100 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"/>
                        <button onClick={sendMsg} className="bg-blue-600 text-white px-4 rounded-lg font-bold">➢</button>
                    </div>
                    {driver.username && (
                        <a href={`https://t.me/${driver.username}`} target="_blank" className="block text-center text-xs font-bold text-blue-500 hover:underline">
                            Open in Telegram App
                        </a>
                    )}
                </div>
            )}
        </div>
    );
}

// ==========================================
// MAIN PAGE CONTROLLER
// ==========================================
export default function Home() {
  const [currentRideId, setCurrentRideId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleBooking = async (data: any) => {
    if(!data.pickup || !data.phone) { alert("Please enter Location and Phone"); return; }
    setLoading(true);
    const rideId = 'ride_' + Date.now();
    setCurrentRideId(rideId);

    const payload = { ...data, status: 'PENDING', timestamp: Date.now() };

    await set(ref(db, 'rides/' + rideId), payload);
    await fetch('/api/ride-request', { 
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ ...payload, rideId }) 
    });
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-slate-200 flex items-center justify-center p-4 font-sans text-slate-900">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-visible border border-slate-100">
        
        {/* App Header */}
        <div className="bg-white p-6 border-b border-slate-100 flex justify-between items-center rounded-t-3xl">
           <div>
             <h1 className="text-2xl font-black tracking-tight text-slate-900">URBAN<span className="text-blue-600">RIDE</span></h1>
             <p className="text-xs text-slate-400 font-medium">Fast • Safe • Reliable</p>
           </div>
           {/* User Avatar Placeholder */}
           <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-lg">👤</div>
        </div>

        {/* Content Area */}
        <div className="p-6">
           {!currentRideId ? (
              <BookingModule onSubmit={handleBooking} isLoading={loading} />
           ) : (
              <RideStatusModule rideId={currentRideId} onReset={()=>setCurrentRideId(null)} />
           )}
        </div>

      </div>
    </main>
  );
}