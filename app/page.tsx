"use client";
import { useState, useEffect } from 'react';
import { initializeApp } from "firebase/app";
import { getDatabase, ref, push, onValue } from "firebase/database";
import AddressSearch from './AddressSearch';

// --- FIREBASE CONFIG ---
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
// MODULE 1: BOOKING FORM (Premium UI)
// ==========================================
function BookingModule({ onRideBooked }: any) {
    const [pickupData, setPickupData] = useState<any>(null);
    const [dropoffData, setDropoffData] = useState<any>(null);
    const [phone, setPhone] = useState('');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [loading, setLoading] = useState(false);

    // Ensure user selects addresses from the dropdown (so we have coords)
    const isValid = pickupData && dropoffData && phone.length > 9 && date !== '' && time !== '';

    const handleBook = async () => {
        if (!isValid) return;
        setLoading(true);

        try {
            const res = await fetch('/api/ride-request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pickup: pickupData.address,
                    dropoff: dropoffData.address,
                    pickupLat: pickupData.lat,
                    pickupLng: pickupData.lng,
                    dropoffLat: dropoffData.lat,
                    dropoffLng: dropoffData.lng,
                    phone,
                    date,
                    time
                })
            });

            const data = await res.json();
            if (data.success) {
                onRideBooked(data.rideId);
            } else {
                alert("Booking failed. Please try again.");
                setLoading(false);
            }
        } catch (e) {
            console.error(e);
            alert("Server Error");
            setLoading(false);
        }
    };

    return (
        <div className="p-6 bg-white rounded-3xl shadow-xl animate-in fade-in space-y-5">
            <h2 className="text-2xl font-black text-slate-800 mb-2">Book a Ride</h2>
            
            <div className="space-y-1 relative">
                {/* Z-Index ensures suggestions float over other inputs */}
                <div className="relative z-30">
                    <AddressSearch label="📍 Pickup" onSelect={setPickupData} />
                </div>
                <div className="relative z-20">
                    <AddressSearch label="🏁 Destination" onSelect={setDropoffData} />
                </div>
                
                <div className="relative z-10 pt-2 space-y-3">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 ml-1">Phone</label>
                        <input 
                            placeholder="(555) 123-4567" 
                            type="tel"
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2">
                        <input type="date" className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl" onChange={e => setDate(e.target.value)}/>
                        <input type="time" className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl" onChange={e => setTime(e.target.value)}/>
                    </div>
                </div>
            </div>

            <button 
                onClick={handleBook}
                disabled={!isValid || loading}
                className={`w-full py-4 rounded-xl font-bold text-lg transition-all shadow-lg transform active:scale-95
                    ${!isValid 
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                        : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-indigo-500/30'
                    }
                `}
            >
                {loading ? '⏳ Calculating...' : 'CONFIRM RIDE ➔'}
            </button>
        </div>
    );
}

// ==========================================
// MODULE 2: RIDE STATUS (Premium UI + WhatsApp Buttons)
// ==========================================
function RideStatusModule({ rideId, onReset }: any) {
    const [status, setStatus] = useState('PENDING');
    const [price, setPrice] = useState('$25.00'); 
    const [driver, setDriver] = useState({ name: 'Finding Driver...', phone: '' });
    const [messages, setMessages] = useState<any[]>([]);
    const [input, setInput] = useState('');

    useEffect(() => {
        const rideRef = ref(db, `rides/${rideId}`);
        return onValue(rideRef, (snapshot) => {
            const data = snapshot.val();
            if(data) {
                setStatus(data.status);
                if(data.price) setPrice(data.price); 
                // Fix: map data.driverPhone to state.phone
                if(data.driverName) setDriver({ name: data.driverName, phone: data.driverPhone });
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
        if(!confirm("Cancel this ride?")) return;
        await fetch('/api/cancel-ride', { method: 'POST', body: JSON.stringify({ rideId }) });
    };

    // --- FINISHED SCREEN ---
    if(status === 'COMPLETED') return (
        <div className="text-center py-12 px-6 animate-in zoom-in">
            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-4xl mx-auto mb-6 shadow-sm">✓</div>
            <h2 className="text-3xl font-black text-slate-800">Ride Finished</h2>
            <div className="bg-slate-50 p-6 rounded-2xl my-6 border border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Total to Pay</p>
                <div className="text-5xl font-black text-green-600">{price}</div>
            </div>
            <button onClick={onReset} className="w-full bg-slate-900 text-white p-4 rounded-xl font-bold shadow-lg hover:bg-slate-800 transition-all">
                Book Another Ride
            </button>
        </div>
    );
    
    // --- CANCELLED SCREEN ---
    if(status === 'CANCELLED') return (
        <div className="text-center py-12 px-6 animate-in zoom-in">
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center text-4xl mx-auto mb-6">✕</div>
            <h2 className="text-2xl font-bold text-slate-800">Ride Cancelled</h2>
            <button onClick={onReset} className="mt-8 w-full bg-slate-900 text-white p-4 rounded-xl font-bold">Try Again</button>
        </div>
    );

    // --- ACTIVE TRACKING SCREEN ---
    return (
        <div className="flex flex-col h-[600px] bg-white rounded-3xl overflow-hidden shadow-2xl">
            {/* HEADER */}
            <div className={`p-6 text-white text-center transition-colors duration-500 ${status === 'ACCEPTED' || status === 'ARRIVED' ? 'bg-green-600' : 'bg-slate-900'}`}>
                {status === 'PENDING' ? (
                    <div className="flex flex-col items-center py-2">
                        <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin mb-3"></div>
                        <div className="font-bold tracking-widest text-sm">SEARCHING FOR DRIVER...</div>
                    </div>
                ) : (
                    <div className="animate-in slide-in-from-top">
                        <div className="text-xs font-bold opacity-75 uppercase tracking-widest mb-1">Your Driver</div>
                        <div className="text-2xl font-black">{driver.name}</div>
                        
                        {/* ✅ FIX IS HERE: Use driver.phone, not driver.driverPhone */}
                        <div className="text-xl font-mono mt-1 opacity-90">{driver.phone}</div>
                        
                        {status === 'ARRIVED' && <div className="mt-2 bg-white text-green-700 text-xs font-bold py-1 px-3 rounded-full inline-block">🚨 DRIVER HAS ARRIVED</div>}
                    </div>
                )}
            </div>
            
            {/* CHAT */}
            <div className="flex-1 bg-slate-50 p-4 overflow-y-auto space-y-3">
                {messages.length === 0 && status === 'ACCEPTED' && (
                    <div className="text-center text-slate-400 text-sm mt-10 italic">Driver connected. Say hello!</div>
                )}
                {messages.map((m, i) => (
                    <div key={i} className={`p-3 rounded-2xl max-w-[85%] text-sm shadow-sm ${m.sender === 'user' ? 'bg-indigo-600 text-white ml-auto rounded-tr-none' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none'}`}>
                        {m.text}
                    </div>
                ))}
            </div>

            {/* ACTION AREA (WhatsApp & Call Buttons) */}
            {(status === 'ACCEPTED' || status === 'ARRIVED') ? (
                 <div className="p-4 bg-white border-t border-slate-100">
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <a href={`https://wa.me/${driver.phone?.replace(/[^0-9]/g, '')}`} target="_blank" className="flex items-center justify-center gap-2 bg-green-500 text-white py-3 rounded-xl font-bold text-sm shadow-sm hover:bg-green-600 transition-colors">
                            💬 WhatsApp
                        </a>
                        <a href={`tel:${driver.phone}`} className="flex items-center justify-center gap-2 bg-slate-800 text-white py-3 rounded-xl font-bold text-sm shadow-sm hover:bg-slate-900 transition-colors">
                            📞 Call
                        </a>
                    </div>
                    <div className="flex gap-2">
                        <input value={input} onChange={e=>setInput(e.target.value)} className="flex-1 bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all" placeholder="Message driver..." />
                        <button onClick={sendMsg} className="bg-indigo-100 text-indigo-600 px-5 rounded-xl font-bold hover:bg-indigo-200 transition-colors">➢</button>
                    </div>
                 </div>
            ) : (
                 <div className="p-4 bg-white border-t">
                    <button onClick={cancelRide} className="w-full p-4 border-2 border-red-50 text-red-400 font-bold rounded-xl hover:bg-red-50 transition-colors text-sm">Cancel Request</button>
                 </div>
            )}
        </div>
    );
}

// ==========================================
// MAIN APP COMPONENT
// ==========================================
export default function Home() {
  const [currentRideId, setCurrentRideId] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('urbanRide_activeId');
    if (saved) setCurrentRideId(saved);
  }, []);

  const handleBooked = (id: string) => {
    localStorage.setItem('urbanRide_activeId', id);
    setCurrentRideId(id);
  };

  const handleReset = () => {
    localStorage.removeItem('urbanRide_activeId');
    setCurrentRideId(null);
  };

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* LOGO */}
        <div className="text-center mb-6">
             <h1 className="text-3xl font-black text-slate-900 tracking-tighter">
                URBAN<span className="text-indigo-600">RIDE</span>
             </h1>
             <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Premium Dispatch</p>
        </div>

        {/* APP CONTAINER */}
        {!currentRideId ? <BookingModule onRideBooked={handleBooked} /> : <RideStatusModule rideId={currentRideId} onReset={handleReset} />}
      </div>
    </main>
  );
}