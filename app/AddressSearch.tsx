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
                    // Uses OpenStreetMap (Free - No API Key needed)
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
        }, 500); // 500ms delay to stop flickering

        return () => clearTimeout(delayDebounceFn);
    }, [query]);

    const handleSelect = (place: any) => {
        // Set the visible text to the short name
        setQuery(place.display_name.split(',')[0]);
        setIsOpen(false);
        // Send full details (including Coordinates) to the parent
        onSelect({
            address: place.display_name,
            lat: place.lat,
            lng: place.lon
        });
    };

    return (
        <div className="relative z-50 mb-3">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 ml-1">{label}</label>
            <input 
                placeholder="Type to search..."
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700 transition-all"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
            />
            
            {/* The Suggestion Dropdown */}
            {isOpen && suggestions.length > 0 && (
                <ul className="absolute w-full bg-white border border-slate-200 rounded-xl mt-2 shadow-2xl max-h-60 overflow-y-auto z-[100] animate-in slide-in-from-top-2">
                    {suggestions.map((place, i) => (
                        <li 
                            key={i} 
                            onClick={() => handleSelect(place)}
                            className="p-4 hover:bg-indigo-50 cursor-pointer border-b border-slate-50 last:border-0 transition-colors"
                        >
                            <span className="font-bold text-slate-800 block">{place.display_name.split(',')[0]}</span>
                            <span className="text-xs text-slate-500 block mt-1 truncate">{place.display_name}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}