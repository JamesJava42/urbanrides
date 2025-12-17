"use client";
import { useState, useEffect } from 'react';
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue, push } from "firebase/database";

// --- CONFIGURATION ---
const MAPBOX_TOKEN = "pk.eyJ1IjoibXJlZGR5MyIsImEiOiJjbWo5Z2ZscnIwMnF1M2dxN2ZmbDFhbndrIn0.7BkiOhLKLpTO-Qp_3eYiHw";
const PRICE_PER_MILE = 1.5;

// --- FIREBASE ---
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
  
  // Date & Time
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
  const [mapStatus, setMapStatus] = useState<string>('neutral'); 

  // Search
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
      }
    } else {
      setSuggestions([]);
    }
  };

  const selectAddress = (item: any) => {
    const coords = item.center;
    if (activeField === 'pickup') { setPickup(item.place_name); setCoordsP(coords); } 
    else { setDestination(item.place_name); setCoordsD(coords); }
    setSuggestions([]);
    
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
    <div className="space-y-5 animate-in fade-in duration-500">
        
        {/* Status Light */}
        <div className="flex justify-end">
             <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${mapStatus === 'success' ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-100 text-gray-400'}`}>
                {mapStatus === 'success' ? '● Maps Active' : '● Ready'}
            </span>
        </div>

        {/* INPUTS */}
        <div className="space-y-4 relative">
            
            {/* Pickup */}
            <div className="relative group">
                <label className="text-xs font-semibold text-indigo-900 uppercase ml-1">Pickup Location</label>
                <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1 focus-within:ring-2 focus-within:ring-indigo-500 transition-all shadow-sm">
                   <span className="pl-3 text-indigo-400">📍</span>
                   <input type="text" value={pickup} onChange={(e)=>handleSearch(e.target.value, 'pickup')} placeholder="Enter pickup address" 
                      className="w-full p-3 bg-transparent outline-none text-slate-700 font-medium placeholder-slate-400"
                   />
                </div>
                {/* DROPDOWN */}
                {activeField === 'pickup' && suggestions.length > 0 && (
                    <div className="absolute z-50 top-full left-0 w-full bg-white shadow-2xl border border-slate-100 rounded-xl mt-2 max-h-60 overflow-y-auto ring-1 ring-black/5">
                        {suggestions.map((s,i)=>(<div key={i} onClick={()=>selectAddress(s)} className="p-3 hover:bg-indigo-50 cursor-pointer text-sm border-b border-slate-50 text-slate-600">{s.place_name}</div>))}
                    </div>
                )}
            </div>

            {/* Destination */}
            <div className="relative group">
                <label className="text-xs font-semibold text-indigo-900 uppercase ml-1">Where to?</label>
                <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1 focus-within:ring-2 focus-within:ring-indigo-500 transition-all shadow-sm">
                   <span className="pl-3 text-indigo-400">🏁</span>
                   <input type="text" value={destination} onChange={(e)=>handleSearch(e.target.value, 'dest')} placeholder="Enter destination" 
                      className="w-full p-3 bg-transparent outline-none text-slate-700 font-medium placeholder-slate-400"
                   />
                </div>
                {/* DROPDOWN */}
                {activeField === 'dest' && suggestions.length > 0 && (
                    <div className="absolute z-50 top-full left-0 w-full bg-white shadow-2xl border border-slate-100 rounded-xl mt-2 max-h-60 overflow-y-auto ring-1 ring-black/5">
                        {suggestions.map((s,i)=>(<div key={i} onClick={()=>selectAddress(s)} className="p-3 hover:bg-indigo-50 cursor-pointer text-sm border-b border-slate-50 text-slate-600">{s.place_name}</div>))}
                    </div>
                )}
            </div>

            {/* Date/Time/Pax */}
            <div className="flex gap-3">
                <div className="flex-1">
                     <label className="text-[10px] font-bold text-slate-400 uppercase">Date</label>
                     <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-slate-600"/>
                </div>
                <div className="flex-1">
                     <label className="text-[10px] font-bold text-slate-400 uppercase">Time</label>
                     <input type="time" value={time} onChange={e=>setTime(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-slate-600"/>
                </div>
                <div className="w-20">
                     <label className="text-[10px] font-bold text-slate-400 uppercase">Pax</label>
                     <select value={passengers} onChange={e=>setPassengers(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm h-[46px] outline-none focus:ring-2 focus:ring-indigo-500 text-slate-600">
                        <option>1</option><option>2</option><option>3</option><option>4</option>
                     </select>
                </div>
            </div>

            {/* Phone */}
            <div>
                <label className="text-xs font-semibold text-indigo-900 uppercase ml-1">Phone Number</label>
                <input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="(555) 000-0000" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"/>
            </div>

        </div>

        {/* Pricing Card */}
        <div className="bg-gradient-to-r from-indigo-900 to-blue-900 text-white p-5 rounded-2xl flex justify-between items-center shadow-lg shadow-indigo-200">
            <div>
                <p className="text-[10px] text-indigo-200 font-bold uppercase tracking-widest">ESTIMATED FARE</p>
                <p className="text-3xl font-bold">{price}</p>
            </div>
            <div className="text-right">
                <p className="text-[10px] text-indigo-200 font-bold uppercase tracking-widest">DISTANCE</p>
                <p className="text-xl font-medium">{distance || '--'}</p>
            </div>
        </div>

        <button onClick={()=>onSubmit({pickup, destination, phone, passengers, price, distance, date, time})} disabled={isLoading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-indigo-200 transition-all active:scale-95 disabled:opacity-50">
            {isLoading ? 'CALCULATING...' : 'CONFIRM RIDE'}
        </button>
    </div>
  );
}

/// ==========================================
// MODULE 2: RIDE STATUS & CHAT (Updated)
// ==========================================
function RideStatusModule({ rideId, onReset }: any) {
    const [status, setStatus] = useState('PENDING');
    const [driver, setDriver] = useState({ name: 'Finding Driver...', username: '' });
    const [rideDetails, setRideDetails] = useState<any>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [input, setInput] = useState('');

    // PAYMENT NUMBER (Change this to your real payment number)
    const PAYMENT_NUMBER = "123-456-7890"; 

    useEffect(() => {
        const rideRef = ref(db, `rides/${rideId}`);
        return onValue(rideRef, (snapshot) => {
            const data = snapshot.val();
            if(data) {
                setStatus(data.status);
                setRideDetails(data);
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

    const cancelRide = async () => {
        if(!confirm("Are you sure you want to cancel?")) return;
        // 1. Update DB
        await fetch('/api/cancel-ride', { 
            method: 'POST', 
            body: JSON.stringify({ rideId, reason: "User changed mind" }) 
        });
    };

    // --- SCENARIO: RIDE COMPLETED (PAYMENT POP-UP) ---
    if(status === 'COMPLETED') {
        return (
            <div className="text-center py-8 space-y-6 animate-in zoom-in">
                <div className="bg-green-100 p-6 rounded-3xl border border-green-200 shadow-xl">
                    <div className="w-16 h-16 bg-green-500 text-white rounded-full flex items-center justify-center text-3xl mx-auto shadow-lg mb-4">✓</div>
                    <h2 className="text-2xl font-black text-green-800 uppercase tracking-wide">Ride Finished</h2>
                    
                    <div className="my-6 bg-white p-4 rounded-xl border border-dashed border-green-300">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total to Pay</p>
                        <p className="text-4xl font-black text-slate-800">{rideDetails?.price || '$0.00'}</p>
                    </div>

                    <div className="space-y-2">
                        <p className="text-sm font-bold text-green-700">PLEASE PAY TO:</p>
                        <div className="text-xl font-mono font-bold text-slate-800 bg-white/50 py-2 rounded-lg select-all">
                            {PAYMENT_NUMBER}
                        </div>
                    </div>
                </div>
                <button onClick={onReset} className="w-full bg-slate-900 text-white p-4 rounded-xl font-bold hover:bg-slate-800 transition-colors">
                    Book New Ride
                </button>
            </div>
        );
    }

    // --- SCENARIO: CANCELLED (By Driver or User) ---
    if(status === 'CANCELLED') {
        return (
            <div className="text-center py-12 space-y-6 animate-in zoom-in">
                <div className="w-24 h-24 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-5xl mx-auto">✕</div>
                <h2 className="text-2xl font-bold text-slate-800">Ride Cancelled</h2>
                <p className="text-slate-500">The ride was cancelled.</p>
                <button onClick={onReset} className="w-full bg-slate-900 text-white p-4 rounded-xl font-bold">Try Again</button>
            </div>
        );
    }

    // --- SCENARIO: ACTIVE RIDE ---
    return (
        <div className="flex flex-col h-[550px] animate-in slide-in-from-bottom-4">
            {/* Status Header */}
            <div className={`p-5 text-center font-bold text-white rounded-t-2xl shadow-md transition-colors duration-500 ${status === 'ARRIVED' ? 'bg-amber-500' : status === 'ACCEPTED' ? 'bg-green-600' : 'bg-indigo-600'}`}>
                {status === 'PENDING' ? 'SEARCHING FOR DRIVERS...' : 
                 status === 'ACCEPTED' ? `✓ DRIVER: ${driver.name}` : 
                 '📍 DRIVER ARRIVED'}
            </div>

            {/* Chat Window */}
            <div className="flex-1 bg-slate-50 overflow-y-auto p-4 space-y-3 border-x border-slate-100">
                {status === 'PENDING' && (
                    <div className="flex flex-col items-center justify-center h-full space-y-6 opacity-50">
                        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                        <p className="text-sm text-slate-500">Contacting drivers...</p>
                        <button onClick={cancelRide} className="text-xs font-bold text-red-400 border border-red-200 px-4 py-2 rounded-full hover:bg-red-50">
                            Cancel Request
                        </button>
                    </div>
                )}
                {messages.map((m, i) => (
                    <div key={i} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] p-3 text-sm shadow-sm rounded-2xl ${m.sender === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white text-slate-700 border border-slate-200 rounded-bl-none'}`}>
                            {m.text}
                        </div>
                    </div>
                ))}
            </div>

            {/* Input Area */}
            {(status === 'ACCEPTED' || status === 'ARRIVED') && (
                <div className="p-4 bg-white border border-t-0 rounded-b-2xl space-y-3 shadow-lg">
                    {/* Driver Contact Info */}
                    <div className="flex justify-between items-center bg-indigo-50 p-3 rounded-xl border border-indigo-100">
                         <div className="flex items-center gap-2">
                             <div className="w-8 h-8 bg-indigo-200 rounded-full flex items-center justify-center text-indigo-700 font-bold">
                                 {driver.name.charAt(0)}
                             </div>
                             <div className="text-xs">
                                 <p className="font-bold text-indigo-900">{driver.name}</p>
                                 <p className="text-indigo-400">Your Driver</p>
                             </div>
                         </div>
                         {/* Link to Telegram Chat */}
                         {driver.username && (
                            <a href={`https://t.me/${driver.username}`} target="_blank" className="bg-white border border-indigo-200 text-indigo-600 px-3 py-2 rounded-lg text-xs font-bold hover:bg-indigo-600 hover:text-white transition-colors">
                                Message 💬
                            </a>
                         )}
                    </div>

                    <div className="flex gap-2">
                        <input value={input} onChange={e=>setInput(e.target.value)} placeholder="Type a message..." className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"/>
                        <button onClick={sendMsg} className="bg-indigo-600 text-white px-5 rounded-xl font-bold hover:bg-indigo-700">➢</button>
                    </div>
                    <button onClick={cancelRide} className="w-full text-[10px] font-bold text-red-300 hover:text-red-500 py-1">Cancel Ride</button>
                </div>
            )}
        </div>
    );
}
// ==========================================
// MAIN PAGE
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
    <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans text-slate-900">
      <div className="w-full max-w-md bg-white shadow-2xl overflow-visible border border-white rounded-3xl ring-1 ring-slate-900/5">
        
        {/* HEADER */}
        <div className="bg-slate-900 p-6 rounded-t-3xl flex justify-between items-center relative overflow-hidden">
           {/* Background decoration */}
           <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500 rounded-full blur-3xl opacity-20 -mr-10 -mt-10"></div>
           
           <h1 className="text-xl font-black tracking-widest text-white z-10">URBAN<span className="text-indigo-400">RIDE</span></h1>
           <div className="z-10 px-3 py-1 bg-indigo-500/20 backdrop-blur-md border border-indigo-500/30 text-indigo-200 text-[10px] font-bold uppercase tracking-widest rounded-full">Premium</div>
        </div>

        {/* CONTENT */}
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