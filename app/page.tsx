"use client";
import { useState, useEffect, useRef } from 'react';
import { initializeApp } from "firebase/app";
import { getDatabase, ref, push, onValue, update } from "firebase/database";

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
// MODULE 1: BOOKING FORM (Verified & Robust)
// ==========================================
function BookingModule({ onRideBooked }: any) {
    const [pickup, setPickup] = useState('');
    const [dropoff, setDropoff] = useState('');
    const [phone, setPhone] = useState('');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [loading, setLoading] = useState(false);

    // Sprint 1: Validation Check
    const isValid = pickup.length > 3 && 
                    dropoff.length > 3 && 
                    phone.length > 9 && 
                    date !== '' && 
                    time !== '';

    const handleBook = async () => {
        if (!isValid) return;
        setLoading(true);

        try {
            const res = await fetch('/api/ride-request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pickup,
                    dropoff,
                    phone,
                    date,
                    time,
                    price: "$25.00" // Hardcoded for MVP, replace with calc later
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
        <div className="p-6 space-y-4 bg-white rounded-xl shadow-lg animate-in fade-in">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Book a Ride</h2>
            
            <div className="space-y-3">
                <input 
                    placeholder="📍 Pickup Address" 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                    value={pickup}
                    onChange={(e) => setPickup(e.target.value)}
                />
                <input 
                    placeholder="🏁 Destination" 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                    value={dropoff}
                    onChange={(e) => setDropoff(e.target.value)}
                />
                <input 
                    placeholder="📞 Phone Number" 
                    type="tel"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                />
                <div className="flex gap-2">
                    <input type="date" className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-lg" onChange={e => setDate(e.target.value)}/>
                    <input type="time" className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-lg" onChange={e => setTime(e.target.value)}/>
                </div>
            </div>

            <button 
                onClick={handleBook}
                disabled={!isValid || loading}
                className={`w-full py-4 rounded-xl font-bold text-lg transition-all shadow-md
                    ${!isValid 
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                        : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-lg'
                    }
                `}
            >
                {loading ? '⏳ BOOKING...' : 'CONFIRM RIDE ➔'}
            </button>
        </div>
    );
}

// ==========================================
// MODULE 2: RIDE STATUS & CHAT (Updated)
// ==========================================
function RideStatusModule({ rideId, onReset }: any) {
    const [status, setStatus] = useState('PENDING');
    const [driver, setDriver] = useState({ name: 'Finding Driver...', phone: '' });
    const [rideDetails, setRideDetails] = useState<any>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [input, setInput] = useState('');

    // PAYMENT NUMBER
    const PAYMENT_NUMBER = "123-456-7890"; 

    useEffect(() => {
        const rideRef = ref(db, `rides/${rideId}`);
        return onValue(rideRef, (snapshot) => {
            const data = snapshot.val();
            if(data) {
                setStatus(data.status);
                setRideDetails(data);
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
        if(!confirm("Are you sure you want to cancel?")) return;
        await fetch('/api/cancel-ride', { 
            method: 'POST', 
            body: JSON.stringify({ rideId }) 
        });
    };

    // --- SCENARIO 1: RIDE COMPLETED (Payment Popup) ---
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

    // --- SCENARIO 2: CANCELLED ---
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

    // --- SCENARIO 3: ACTIVE TRACKING ---
    return (
        <div className="flex flex-col h-[600px] animate-in slide-in-from-bottom-4">
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

            {/* Driver Info & Actions */}
            {(status === 'ACCEPTED' || status === 'ARRIVED') && (
                <div className="p-4 bg-white border border-t-0 rounded-b-2xl space-y-3 shadow-lg">
                    
                    {/* DRIVER INFO */}
                    <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 space-y-3">
                         <div className="flex items-center gap-3">
                             <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-sm">
                                 {driver.name.charAt(0)}
                             </div>
                             <div>
                                 <p className="font-bold text-indigo-900 text-sm">{driver.name}</p>
                                 <p className="text-indigo-400 text-xs uppercase tracking-wide">Verified Driver</p>
                             </div>
                         </div>
                         
                         {/* CONTACT BUTTONS */}
                         <div className="grid grid-cols-2 gap-2">
                             <a href={`https://wa.me/${driver.phone?.replace('+', '')}`} target="_blank" className="flex items-center justify-center gap-2 bg-green-500 text-white py-2 rounded-lg font-bold text-xs hover:bg-green-600 transition-colors shadow-sm">
                                 <span>💬</span> WhatsApp
                             </a>
                             <a href={`tel:${driver.phone}`} className="flex items-center justify-center gap-2 bg-slate-800 text-white py-2 rounded-lg font-bold text-xs hover:bg-slate-900 transition-colors shadow-sm">
                                 <span>📞</span> Call
                             </a>
                         </div>
                    </div>
                    
                    {/* CHAT INPUT */}
                    <div className="flex gap-2">
                        <input value={input} onChange={e=>setInput(e.target.value)} placeholder="Message driver..." className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"/>
                        <button onClick={sendMsg} className="bg-indigo-100 text-indigo-600 px-4 rounded-xl font-bold hover:bg-indigo-200">➢</button>
                    </div>

                    <button onClick={cancelRide} className="w-full text-[10px] font-bold text-red-300 hover:text-red-500 py-1">Cancel Ride</button>
                </div>
            )}
        </div>
    );
}

// ==========================================
// MAIN APP COMPONENT (Sprint 2 - Persistence)
// ==========================================
export default function Home() {
  const [currentRideId, setCurrentRideId] = useState<string | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);

  // 1. ON LOAD: Check LocalStorage
  useEffect(() => {
    const savedRide = localStorage.getItem('urbanRide_activeId');
    if (savedRide) {
      setCurrentRideId(savedRide);
    }
    setLoadingConfig(false);
  }, []);

  // 2. ON BOOKING: Save ID
  const handleRideBooked = (rideId: string) => {
    localStorage.setItem('urbanRide_activeId', rideId);
    setCurrentRideId(rideId);
  };

  // 3. ON RESET: Clear ID
  const handleReset = () => {
    localStorage.removeItem('urbanRide_activeId');
    setCurrentRideId(null);
  };

  if (loadingConfig) return <div className="p-10 text-center">Loading...</div>;

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="bg-slate-900 p-6 text-center">
          <h1 className="text-2xl font-black text-white tracking-tighter">
            URBAN<span className="text-indigo-500">RIDE</span>
          </h1>
          <p className="text-slate-400 text-xs tracking-widest uppercase mt-1">Premium Dispatch</p>
        </div>

        {/* Dynamic Content */}
        <div className="bg-slate-50">
          {!currentRideId ? (
            <BookingModule onRideBooked={handleRideBooked} />
          ) : (
            <RideStatusModule rideId={currentRideId} onReset={handleReset} />
          )}
        </div>

      </div>
    </main>
  );
}