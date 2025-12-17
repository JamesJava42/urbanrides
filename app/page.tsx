"use client";
import { useState, useEffect } from 'react';
import { initializeApp } from "firebase/app";
import { getDatabase, ref, push, onValue } from "firebase/database";
import AddressSearch from './AddressSearch';

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
// MODULE 1: VIBRANT BOOKING FORM
// ==========================================
function BookingModule({ onRideBooked }: any) {
    const [pickupData, setPickupData] = useState<any>({ address: '' });
    const [dropoffData, setDropoffData] = useState<any>({ address: '' });
    const [phone, setPhone] = useState('');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [loading, setLoading] = useState(false);

    // LOGIC FIX: Button enables even if lat/lng are null (Manual typing allowed)
    const isValid = pickupData.address?.length > 2 && 
                    dropoffData.address?.length > 2 && 
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
                    pickup: pickupData.address,
                    dropoff: dropoffData.address,
                    pickupLat: pickupData.lat || null,
                    pickupLng: pickupData.lng || null,
                    dropoffLat: dropoffData.lat || null,
                    dropoffLng: dropoffData.lng || null,
                    phone, date, time
                })
            });

            const data = await res.json();
            if (data.success) onRideBooked(data.rideId);
            else { alert("Booking failed."); setLoading(false); }
        } catch (e) {
            console.error(e);
            alert("Connection Error");
            setLoading(false);
        }
    };

    return (
        <div className="bg-white/90 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-2xl shadow-indigo-500/20 border border-white animate-in fade-in zoom-in duration-500">
            <div className="text-center mb-8">
                <h2 className="text-3xl font-black bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
                    Plan Your Ride
                </h2>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Premium Dispatch</p>
            </div>
            
            <div className="space-y-2">
                {/* Z-Index Fix: Pickup is 30, Destination is 20 */}
                <div className="relative z-30">
                    <AddressSearch label="📍 Where From?" onSelect={setPickupData} />
                </div>
                <div className="relative z-20">
                    <AddressSearch label="🏁 Where To?" onSelect={setDropoffData} />
                </div>
                
                <div className="relative z-10 grid grid-cols-1 gap-4 pt-2">
                    <div>
                        <label className="block text-xs font-black text-violet-600 uppercase tracking-widest mb-2 ml-1">Mobile Number</label>
                        <input 
                            placeholder="123 456 7890" 
                            type="tel"
                            className="w-full p-4 bg-white border-2 border-violet-100 rounded-2xl outline-none focus:border-fuchsia-500 focus:ring-4 focus:ring-fuchsia-500/20 transition-all font-bold text-slate-700 shadow-sm"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <input type="date" className="p-4 bg-violet-50 border-0 rounded-2xl font-bold text-violet-900 outline-none" onChange={e => setDate(e.target.value)}/>
                        <input type="time" className="p-4 bg-violet-50 border-0 rounded-2xl font-bold text-violet-900 outline-none" onChange={e => setTime(e.target.value)}/>
                    </div>
                </div>
            </div>

            <button 
                onClick={handleBook}
                disabled={!isValid || loading}
                className={`mt-8 w-full py-5 rounded-2xl font-black text-lg tracking-wide transition-all shadow-xl shadow-fuchsia-500/30
                    ${!isValid 
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                        : 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:scale-[1.02] hover:shadow-2xl hover:shadow-fuchsia-500/40 active:scale-95'
                    }
                `}
            >
                {loading ? '✨ CONNECTING...' : 'CONFIRM RIDE ➔'}
            </button>
        </div>
    );
}

// ==========================================
// MODULE 2: VIBRANT STATUS CARD
// ==========================================
function RideStatusModule({ rideId, onReset }: any) {
    const [status, setStatus] = useState('PENDING');
    const [price, setPrice] = useState('$25.00'); 
    const [driver, setDriver] = useState({ name: 'Searching...', phone: '' });
    const [messages, setMessages] = useState<any[]>([]);
    const [input, setInput] = useState('');

    useEffect(() => {
        const rideRef = ref(db, `rides/${rideId}`);
        return onValue(rideRef, (snapshot) => {
            const data = snapshot.val();
            if(data) {
                setStatus(data.status);
                if(data.price) setPrice(data.price); 
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

    // --- COMPLETED ---
    if(status === 'COMPLETED') return (
        <div className="text-center py-12 px-6 animate-in zoom-in bg-white rounded-[2.5rem] shadow-2xl shadow-green-500/20">
            <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-600 text-white rounded-full flex items-center justify-center text-5xl mx-auto mb-6 shadow-lg shadow-green-500/30">✓</div>
            <h2 className="text-3xl font-black text-slate-800">Ride Finished!</h2>
            <div className="my-8 p-6 bg-green-50 rounded-3xl border border-green-100">
                <p className="text-xs font-bold text-green-500 uppercase tracking-widest">TOTAL AMOUNT</p>
                <div className="text-5xl font-black text-green-600 mt-2">{price}</div>
            </div>
            <button onClick={onReset} className="w-full bg-slate-900 text-white p-5 rounded-2xl font-bold hover:scale-[1.02] transition-transform shadow-xl">Book New Ride</button>
        </div>
    );

    // --- ACTIVE ---
    return (
        <div className="flex flex-col h-[650px] bg-white rounded-[2.5rem] overflow-hidden shadow-2xl shadow-indigo-500/30">
            {/* DYNAMIC HEADER */}
            <div className={`p-8 text-white text-center transition-all duration-500 
                ${status === 'PENDING' 
                    ? 'bg-gradient-to-br from-amber-400 to-orange-500' 
                    : 'bg-gradient-to-br from-violet-600 to-fuchsia-600'}
            `}>
                {status === 'PENDING' ? (
                    <div className="flex flex-col items-center">
                        <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mb-4"></div>
                        <div className="font-black tracking-widest text-sm uppercase">Finding Nearby Driver...</div>
                    </div>
                ) : (
                    <div className="animate-in slide-in-from-top">
                        <div className="text-[10px] font-bold text-white/70 uppercase tracking-widest mb-2">YOUR DRIVER</div>
                        <div className="text-4xl font-black tracking-tight">{driver.name}</div>
                        <div className="text-xl font-mono text-white/90 mt-2 bg-white/20 inline-block px-4 py-1 rounded-lg">{driver.phone}</div>
                        
                        {status === 'ARRIVED' && (
                            <div className="mt-6 bg-white text-fuchsia-600 text-xs font-black py-2 px-4 rounded-full shadow-lg animate-bounce">
                                🚨 DRIVER IS HERE
                            </div>
                        )}
                    </div>
                )}
            </div>
            
            {/* MESSAGES */}
            <div className="flex-1 bg-slate-50 p-6 overflow-y-auto space-y-4">
                {messages.length === 0 && status === 'ACCEPTED' && (
                    <div className="text-center mt-10 opacity-50">
                        <div className="text-4xl mb-2">👋</div>
                        <div className="text-xs font-bold uppercase tracking-widest">Say Hello to your Driver</div>
                    </div>
                )}
                {messages.map((m, i) => (
                    <div key={i} className={`p-4 rounded-2xl max-w-[85%] text-sm font-bold shadow-sm ${m.sender === 'user' ? 'bg-fuchsia-600 text-white ml-auto rounded-tr-sm shadow-fuchsia-200' : 'bg-white text-slate-700 rounded-tl-sm shadow-sm'}`}>
                        {m.text}
                    </div>
                ))}
            </div>

            {/* CONTROLS */}
            {(status === 'ACCEPTED' || status === 'ARRIVED') ? (
                 <div className="p-6 bg-white border-t border-slate-100">
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <a href={`https://wa.me/${driver.phone?.replace(/[^0-9]/g, '')}`} target="_blank" className="flex items-center justify-center gap-2 bg-[#25D366] text-white py-4 rounded-xl font-bold text-sm shadow-lg shadow-green-500/20 hover:scale-[1.02] transition-transform">
                            WhatsApp
                        </a>
                        <a href={`tel:${driver.phone}`} className="flex items-center justify-center gap-2 bg-slate-800 text-white py-4 rounded-xl font-bold text-sm shadow-lg shadow-slate-500/20 hover:scale-[1.02] transition-transform">
                            Call Driver
                        </a>
                    </div>
                    <div className="flex gap-2">
                        <input value={input} onChange={e=>setInput(e.target.value)} className="flex-1 bg-slate-100 p-4 rounded-xl outline-none font-bold text-slate-700 focus:ring-2 focus:ring-fuchsia-500 transition-all" placeholder="Type message..." />
                        <button onClick={sendMsg} className="bg-fuchsia-100 text-fuchsia-600 px-6 rounded-xl font-black text-xl hover:bg-fuchsia-200 transition-colors">➢</button>
                    </div>
                 </div>
            ) : (
                 <div className="p-6 bg-white border-t">
                    <button onClick={() => fetch('/api/cancel-ride', { method: 'POST', body: JSON.stringify({ rideId }) })} className="w-full p-4 border-2 border-red-100 text-red-400 font-bold rounded-xl hover:bg-red-50 transition-colors text-xs tracking-widest uppercase">
                        Cancel Request
                    </button>
                 </div>
            )}
        </div>
    );
}

// ==========================================
// MAIN LAYOUT
// ==========================================
export default function Home() {
  const [currentRideId, setCurrentRideId] = useState<string | null>(null);
  useEffect(() => { const saved = localStorage.getItem('urbanRide_activeId'); if (saved) setCurrentRideId(saved); }, []);
  const handleReset = () => { localStorage.removeItem('urbanRide_activeId'); setCurrentRideId(null); };

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md">
         {!currentRideId ? <BookingModule onRideBooked={(id: string) => { localStorage.setItem('urbanRide_activeId', id); setCurrentRideId(id); }} /> : <RideStatusModule rideId={currentRideId} onReset={handleReset} />}
      </div>
    </main>
  );
}