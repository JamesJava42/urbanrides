"use client";
import { useState, useEffect } from 'react';
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
// MODULE 1: BOOKING FORM (OLD UX - SIMPLE INPUTS)
// ==========================================
function BookingModule({ onRideBooked }: any) {
    const [pickup, setPickup] = useState('');
    const [dropoff, setDropoff] = useState('');
    const [phone, setPhone] = useState('');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [loading, setLoading] = useState(false);

    // SIMPLE VALIDATION (Just checks text length)
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
                    pickup,   // Sending plain text
                    dropoff,  // Sending plain text
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
        <div className="p-6 space-y-4 bg-white rounded-xl shadow-lg animate-in fade-in">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Book a Ride</h2>
            
            <div className="space-y-3">
                {/* OLD UX: Simple Inputs */}
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
// MODULE 2: RIDE STATUS (Restored Layout)
// ==========================================
function RideStatusModule({ rideId, onReset }: any) {
    const [status, setStatus] = useState('PENDING');
    const [driver, setDriver] = useState({ name: 'Finding Driver...', phone: '' });
    const [messages, setMessages] = useState<any[]>([]);
    const [input, setInput] = useState('');

    useEffect(() => {
        const rideRef = ref(db, `rides/${rideId}`);
        return onValue(rideRef, (snapshot) => {
            const data = snapshot.val();
            if(data) {
                setStatus(data.status);
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

    if(status === 'COMPLETED') return <div className="text-center py-10"><h2 className="text-2xl font-bold text-green-600">Ride Completed</h2><button onClick={onReset} className="mt-4 bg-slate-900 text-white px-6 py-3 rounded-xl">New Ride</button></div>;
    
    if(status === 'CANCELLED') return <div className="text-center py-10"><h2 className="text-2xl font-bold text-red-600">Ride Cancelled</h2><button onClick={onReset} className="mt-4 bg-slate-900 text-white px-6 py-3 rounded-xl">Try Again</button></div>;

    return (
        <div className="flex flex-col h-[600px]">
            <div className={`p-4 text-white text-center font-bold ${status === 'ACCEPTED' ? 'bg-green-600' : 'bg-indigo-600'}`}>
                {status === 'PENDING' ? 'SEARCHING...' : `DRIVER: ${driver.name}`}
            </div>
            
            <div className="flex-1 bg-slate-50 p-4 overflow-y-auto space-y-2">
                {messages.map((m, i) => (
                    <div key={i} className={`p-2 rounded-lg max-w-[80%] text-sm ${m.sender === 'user' ? 'bg-indigo-600 text-white ml-auto' : 'bg-white border text-slate-800'}`}>
                        {m.text}
                    </div>
                ))}
            </div>

            {(status === 'ACCEPTED' || status === 'ARRIVED') && (
                 <div className="p-3 bg-white border-t flex gap-2">
                    <input value={input} onChange={e=>setInput(e.target.value)} className="flex-1 border p-2 rounded-lg" placeholder="Message driver..." />
                    <button onClick={sendMsg} className="bg-indigo-600 text-white px-4 rounded-lg">Send</button>
                 </div>
            )}
             
            {status === 'PENDING' && <button onClick={cancelRide} className="m-4 p-3 border border-red-200 text-red-500 rounded-lg">Cancel Request</button>}
        </div>
    );
}

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
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden">
        <div className="bg-slate-900 p-6 text-center text-white font-black text-2xl">URBAN<span className="text-indigo-500">RIDE</span></div>
        {!currentRideId ? <BookingModule onRideBooked={handleBooked} /> : <RideStatusModule rideId={currentRideId} onReset={handleReset} />}
      </div>
    </main>
  );
}