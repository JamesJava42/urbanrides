'use client';

import { useEffect, useMemo, useState } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, onValue, ref } from 'firebase/database';
import { RideLifecycleStatus, STATUS_LABELS } from '@/lib/rideRules';

type RideRecord = {
  rideId: string;
  pickup: string;
  dropoff: string;
  date: string;
  time: string;
  phone: string;
  email: string;
  price: string;
  riderMiles: number;
  status: RideLifecycleStatus;
  driverName?: string;
  driverPhone?: string;
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

const statusChoices: RideLifecycleStatus[] = [
  'PENDING',
  'ACCEPTED',
  'ARRIVED',
  'COMPLETED',
  'FAILED_PICKUP',
  'COMMUNICATION_FAILED',
  'PASSENGER_NO_SHOW',
  'NO_DRIVER_AVAILABLE',
  'CANCELLED',
];

export default function AdminPage() {
  const [rides, setRides] = useState<RideRecord[]>([]);
  const [adminKey, setAdminKey] = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('urbanrides_admin_key') || '';
  });
  const [noteByRide, setNoteByRide] = useState<Record<string, string>>({});
  const [driverByRide, setDriverByRide] = useState<Record<string, string>>({});
  const [phoneByRide, setPhoneByRide] = useState<Record<string, string>>({});
  const [statusByRide, setStatusByRide] = useState<Record<string, RideLifecycleStatus>>({});

  useEffect(() => {
    const unsubscribe = onValue(ref(db, 'rides'), (snapshot) => {
      if (!snapshot.exists()) {
        setRides([]);
        return;
      }

      const raw = snapshot.val() as Record<string, RideRecord>;
      const next = Object.values(raw).sort((a, b) => (b.rideId > a.rideId ? 1 : -1));
      setRides(next);
    });

    return () => unsubscribe();
  }, []);

  const stats = useMemo(() => {
    const total = rides.length;
    const pending = rides.filter((ride) => ride.status === 'PENDING').length;
    const completed = rides.filter((ride) => ride.status === 'COMPLETED').length;
    const failed = rides.filter((ride) => ['FAILED_PICKUP', 'COMMUNICATION_FAILED', 'PASSENGER_NO_SHOW', 'NO_DRIVER_AVAILABLE'].includes(ride.status)).length;
    return { total, pending, completed, failed };
  }, [rides]);

  const updateRide = async (rideId: string) => {
    if (!adminKey.trim()) {
      alert('Enter admin key first.');
      return;
    }

    localStorage.setItem('urbanrides_admin_key', adminKey.trim());

    const status = statusByRide[rideId] || 'PENDING';
    const note = noteByRide[rideId] || '';

    const response = await fetch('/api/admin-update-ride', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': adminKey.trim(),
      },
      body: JSON.stringify({
        rideId,
        status,
        note,
        driverName: driverByRide[rideId] || undefined,
        driverPhone: phoneByRide[rideId] || undefined,
      }),
    });

    const payload = await response.json();
    if (!payload.success) {
      alert(payload.error || 'Update failed');
      return;
    }

    alert('Ride updated.');
  };

  return (
    <main className="min-h-screen bg-slate-100 p-4">
      <div className="mx-auto max-w-6xl space-y-4">
        <h1 className="text-3xl font-bold text-slate-900">UrbanRides Admin Dashboard</h1>
        <p className="text-sm text-slate-600">Track rides, assign outcomes, and audit daily operations.</p>

        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-white p-4 shadow">Total rides: <b>{stats.total}</b></div>
          <div className="rounded-xl bg-white p-4 shadow">Pending: <b>{stats.pending}</b></div>
          <div className="rounded-xl bg-white p-4 shadow">Completed: <b>{stats.completed}</b></div>
          <div className="rounded-xl bg-white p-4 shadow">Operational failures: <b>{stats.failed}</b></div>
        </div>

        <div className="rounded-xl bg-white p-4 shadow">
          <label className="mb-1 block text-sm font-semibold">Admin key</label>
          <input
            value={adminKey}
            onChange={(event) => setAdminKey(event.target.value)}
            className="w-full rounded-lg border border-slate-300 p-2"
            placeholder="Required for status updates"
          />
        </div>

        <div className="overflow-x-auto rounded-xl bg-white shadow">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="p-3">Ride</th>
                <th className="p-3">Rider</th>
                <th className="p-3">Trip</th>
                <th className="p-3">Status</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {rides.map((ride) => (
                <tr key={ride.rideId} className="border-t border-slate-100 align-top">
                  <td className="p-3">
                    <p className="font-semibold">{ride.rideId}</p>
                    <p>{ride.date} {ride.time}</p>
                    <p>Fare {ride.price}</p>
                    <p>Miles {ride.riderMiles}</p>
                  </td>
                  <td className="p-3">
                    <p>{ride.phone}</p>
                    <p>{ride.email}</p>
                  </td>
                  <td className="p-3">
                    <p>From: {ride.pickup}</p>
                    <p>To: {ride.dropoff}</p>
                    <p className="text-xs text-slate-500">Driver: {ride.driverName || 'Unassigned'}</p>
                  </td>
                  <td className="p-3">
                    <p className="font-semibold">{STATUS_LABELS[ride.status]}</p>
                    <select
                      className="mt-2 w-full rounded border border-slate-300 p-1"
                      value={statusByRide[ride.rideId] || ride.status}
                      onChange={(event) => setStatusByRide((prev) => ({ ...prev, [ride.rideId]: event.target.value as RideLifecycleStatus }))}
                    >
                      {statusChoices.map((statusOption) => (
                        <option key={statusOption} value={statusOption}>{STATUS_LABELS[statusOption]}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3 space-y-2">
                    <input
                      className="w-full rounded border border-slate-300 p-1"
                      placeholder="Driver name"
                      value={driverByRide[ride.rideId] || ''}
                      onChange={(event) => setDriverByRide((prev) => ({ ...prev, [ride.rideId]: event.target.value }))}
                    />
                    <input
                      className="w-full rounded border border-slate-300 p-1"
                      placeholder="Driver phone"
                      value={phoneByRide[ride.rideId] || ''}
                      onChange={(event) => setPhoneByRide((prev) => ({ ...prev, [ride.rideId]: event.target.value }))}
                    />
                    <input
                      className="w-full rounded border border-slate-300 p-1"
                      placeholder="Status note"
                      value={noteByRide[ride.rideId] || ''}
                      onChange={(event) => setNoteByRide((prev) => ({ ...prev, [ride.rideId]: event.target.value }))}
                    />
                    <button
                      type="button"
                      onClick={() => updateRide(ride.rideId)}
                      className="w-full rounded bg-violet-600 p-2 font-semibold text-white"
                    >
                      Save update
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
