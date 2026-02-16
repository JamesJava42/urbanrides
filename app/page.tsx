'use client';

import { useEffect, useMemo, useState } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, onValue, push, ref } from 'firebase/database';
import AddressSearch from './AddressSearch';
import {
  BASE_FARE_USD,
  MAX_TRIP_MILES,
  PER_MILE_FARE_USD,
  RideLifecycleStatus,
  STATUS_LABELS,
  calculateFare,
  getRegionName,
  milesBetweenPoints,
  toPriceLabel,
} from '@/lib/rideRules';

type AddressSelection = {
  address: string;
  lat: number | null;
  lng: number | null;
};

type ChatMessage = {
  sender: 'user' | 'driver';
  text: string;
};

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: 'https://urbanride4244-default-rtdb.firebaseio.com/',
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

function BookingModule({ onRideBooked }: { onRideBooked: (rideId: string) => void }) {
  const [pickupData, setPickupData] = useState<AddressSelection>({ address: '', lat: null, lng: null });
  const [dropoffData, setDropoffData] = useState<AddressSelection>({ address: '', lat: null, lng: null });
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [riderMiles, setRiderMiles] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const estimatedMiles = useMemo(() => {
    if (pickupData.lat === null || pickupData.lng === null || dropoffData.lat === null || dropoffData.lng === null) {
      return null;
    }
    return milesBetweenPoints(pickupData.lat, pickupData.lng, dropoffData.lat, dropoffData.lng);
  }, [dropoffData.lat, dropoffData.lng, pickupData.lat, pickupData.lng]);

  const previewFare = useMemo(() => {
    const numeric = Number(riderMiles);
    if (Number.isNaN(numeric) || numeric <= 0) return null;
    return toPriceLabel(calculateFare(numeric));
  }, [riderMiles]);

  const isValid =
    pickupData.address.length > 2 &&
    dropoffData.address.length > 2 &&
    pickupData.lat !== null &&
    pickupData.lng !== null &&
    dropoffData.lat !== null &&
    dropoffData.lng !== null &&
    phone.length > 9 &&
    email.includes('@') &&
    Number(riderMiles) > 0 &&
    Number(riderMiles) <= MAX_TRIP_MILES &&
    date !== '' &&
    time !== '';

  const onBook = async () => {
    if (!isValid) return;
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/ride-request', {
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
          email,
          date,
          time,
          riderMiles: Number(riderMiles),
        }),
      });

      const payload = await response.json();
      if (!payload.success) {
        setError(payload.error || 'Unable to book ride.');
        return;
      }

      onRideBooked(payload.rideId);
    } catch (requestError) {
      console.error(requestError);
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
      <h1 className="text-2xl font-bold text-slate-900">UrbanRides</h1>
      <p className="mt-1 text-sm text-slate-600">Early-stage startup booking flow for {getRegionName()}.</p>

      <div className="mt-4 rounded-xl bg-violet-50 p-4 text-sm text-violet-900">
        <p>• One-way rides only • Max {MAX_TRIP_MILES} miles</p>
        <p>• Fare = ${BASE_FARE_USD} base + ${PER_MILE_FARE_USD}/mile</p>
        {estimatedMiles !== null ? <p>• System estimated miles: {estimatedMiles.toFixed(1)}</p> : null}
        {previewFare ? <p>• Estimated fare from your miles: {previewFare}</p> : null}
      </div>

      <div className="mt-4 space-y-3">
        <AddressSearch label="Pickup" onSelect={setPickupData} />
        <AddressSearch label="Dropoff" onSelect={setDropoffData} />

        <input
          type="number"
          placeholder="Total one-way miles"
          className="w-full rounded-xl border border-slate-300 p-3"
          value={riderMiles}
          onChange={(event) => setRiderMiles(event.target.value)}
          min="0"
          max={MAX_TRIP_MILES}
          step="0.1"
        />

        {estimatedMiles !== null && (
          <button
            type="button"
            onClick={() => setRiderMiles(estimatedMiles.toFixed(1))}
            className="w-full rounded-lg border border-violet-300 p-2 text-sm font-medium text-violet-700"
          >
            Use estimated miles ({estimatedMiles.toFixed(1)})
          </button>
        )}

        <input
          type="tel"
          placeholder="Phone number"
          className="w-full rounded-xl border border-slate-300 p-3"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
        />
        <input
          type="email"
          placeholder="Email"
          className="w-full rounded-xl border border-slate-300 p-3"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />

        <div className="grid grid-cols-2 gap-3">
          <input type="date" className="rounded-xl border border-slate-300 p-3" onChange={(event) => setDate(event.target.value)} />
          <input type="time" className="rounded-xl border border-slate-300 p-3" onChange={(event) => setTime(event.target.value)} />
        </div>
      </div>

      {error ? <p className="mt-3 text-sm font-medium text-red-600">{error}</p> : null}

      <button
        type="button"
        onClick={onBook}
        disabled={!isValid || loading}
        className="mt-4 w-full rounded-xl bg-violet-600 p-3 font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {loading ? 'Booking...' : 'Submit ride request'}
      </button>
    </div>
  );
}

function RideStatusModule({ rideId, onReset }: { rideId: string; onReset: () => void }) {
  const [status, setStatus] = useState<RideLifecycleStatus>('PENDING');
  const [price, setPrice] = useState('$0.00');
  const [driver, setDriver] = useState({ name: 'Waiting for dispatch', phone: '' });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');

  useEffect(() => {
    const unsubscribe = onValue(ref(db, `rides/${rideId}`), (snapshot) => {
      if (!snapshot.exists()) return;
      const ride = snapshot.val();
      setStatus((ride.status || 'PENDING') as RideLifecycleStatus);
      setPrice(ride.price || '$0.00');
      setDriver({ name: ride.driverName || 'Waiting for dispatch', phone: ride.driverPhone || '' });
      setMessages(ride.messages ? (Object.values(ride.messages) as ChatMessage[]) : []);
    });

    return () => unsubscribe();
  }, [rideId]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const payload = { sender: 'user' as const, text: input.trim() };
    await push(ref(db, `rides/${rideId}/messages`), payload);
    await fetch('/api/send-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rideId, message: payload.text }),
    });
    setInput('');
  };

  const terminalStatuses: RideLifecycleStatus[] = ['COMPLETED', 'CANCELLED', 'FAILED_PICKUP', 'COMMUNICATION_FAILED', 'PASSENGER_NO_SHOW', 'NO_DRIVER_AVAILABLE'];

  if (terminalStatuses.includes(status)) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
        <p className="text-sm font-semibold text-slate-500">Ride closed</p>
        <h2 className="mt-1 text-2xl font-bold text-slate-900">{STATUS_LABELS[status]}</h2>
        <p className="mt-2 text-slate-600">Final fare: {price}</p>
        <button type="button" onClick={onReset} className="mt-4 w-full rounded-xl bg-slate-900 p-3 font-semibold text-white">
          Start new ride
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ride status</p>
      <h2 className="mt-1 text-2xl font-bold text-slate-900">{STATUS_LABELS[status]}</h2>
      <p className="mt-2 text-sm text-slate-600">Fare {price}</p>
      <p className="text-sm text-slate-600">Driver: {driver.name}</p>

      {(status === 'ACCEPTED' || status === 'ARRIVED') && (
        <div className="mt-4 space-y-2">
          <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl bg-slate-50 p-3">
            {messages.map((message, index) => (
              <div key={`${message.sender}-${index}`} className="rounded-lg bg-white p-2 text-sm text-slate-700">
                {message.text}
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              className="flex-1 rounded-xl border border-slate-300 p-3"
              placeholder="Message driver"
            />
            <button type="button" onClick={sendMessage} className="rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white">
              Send
            </button>
          </div>
        </div>
      )}

      {status === 'PENDING' && (
        <button
          type="button"
          onClick={() =>
            fetch('/api/cancel-ride', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ rideId }),
            })
          }
          className="mt-4 w-full rounded-xl border border-red-200 p-3 text-sm font-semibold text-red-600"
        >
          Cancel ride
        </button>
      )}
    </div>
  );
}

export default function Home() {
  const [currentRideId, setCurrentRideId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('urbanRide_activeId');
  });

  const onRideBooked = (rideId: string) => {
    localStorage.setItem('urbanRide_activeId', rideId);
    setCurrentRideId(rideId);
  };

  const onReset = () => {
    localStorage.removeItem('urbanRide_activeId');
    setCurrentRideId(null);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md">
        {currentRideId ? <RideStatusModule rideId={currentRideId} onReset={onReset} /> : <BookingModule onRideBooked={onRideBooked} />}
        <a href="/admin" className="mt-4 block text-center text-sm font-medium text-violet-700 underline">
          Open admin dashboard
        </a>
      </div>
    </main>
  );
}
