'use client';

import { useEffect, useRef, useState } from 'react';

type AddressSelection = {
  address: string;
  lat: number | null;
  lng: number | null;
};

type NominatimResult = {
  display_name: string;
  lat: string;
  lon: string;
};

export default function AddressSearch({ label, onSelect }: { label: string; onSelect: (value: AddressSelection) => void }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && event.target instanceof Node && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInput = (text: string) => {
    setQuery(text);
    onSelect({ address: text, lat: null, lng: null });
  };

  useEffect(() => {
    const timeout = setTimeout(async () => {
      if (query.length < 3) {
        setSuggestions([]);
        setIsOpen(false);
        return;
      }

      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=4`);
        const data = (await response.json()) as NominatimResult[];
        setSuggestions(data);
        setIsOpen(true);
      } catch (error) {
        console.error(error);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [query]);

  const onSelectSuggestion = (place: NominatimResult) => {
    setQuery(place.display_name.split(',')[0]);
    setIsOpen(false);
    onSelect({
      address: place.display_name,
      lat: Number(place.lat),
      lng: Number(place.lon),
    });
  };

  return (
    <div ref={wrapperRef} className="relative">
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      <input
        placeholder="Search location"
        className="w-full rounded-xl border border-slate-300 p-3"
        value={query}
        onChange={(event) => handleInput(event.target.value)}
        onFocus={() => query.length > 2 && setIsOpen(true)}
      />

      {isOpen && suggestions.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          {suggestions.map((place) => (
            <li
              key={`${place.display_name}-${place.lat}-${place.lon}`}
              onClick={() => onSelectSuggestion(place)}
              className="cursor-pointer border-b border-slate-100 p-3 text-sm text-slate-700 last:border-b-0 hover:bg-slate-50"
            >
              {place.display_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
