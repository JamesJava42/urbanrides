"use client";
import { useState, useEffect } from 'react';

export default function AddressSearch({ label, onSelect }: any) {
    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (query.length > 2) {
                try {
                    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=5`);
                    const data = await res.json();
                    setSuggestions(data);
                    setIsOpen(true);
                } catch (error) {
                    console.error("Search Error", error);
                }
            } else {
                setSuggestions([]);
                setIsOpen(false);
            }
        }, 500);
        return () => clearTimeout(delayDebounceFn);
    }, [query]);

    const handleSelect = (place: any) => {
        setQuery(place.display_name.split(',')[0]);
        setIsOpen(false);
        onSelect({
            address: place.display_name,
            lat: place.lat,
            lng: place.lon
        });
    };

    return (
        <div className="relative z-50">
            <input 
                placeholder={label}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
            />
            {isOpen && suggestions.length > 0 && (
                <ul className="absolute w-full bg-white border border-slate-200 rounded-lg mt-1 shadow-xl max-h-48 overflow-y-auto z-50">
                    {suggestions.map((place, i) => (
                        <li key={i} onClick={() => handleSelect(place)} className="p-3 hover:bg-indigo-50 cursor-pointer text-sm text-slate-600 border-b border-slate-50">
                            <span className="font-bold text-slate-800">{place.display_name.split(',')[0]}</span>
                            <br/>
                            <span className="text-xs">{place.display_name}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}