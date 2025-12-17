"use client";
import { useState, useEffect, useRef } from 'react';

export default function AddressSearch({ label, onSelect }: any) {
    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Close dropdown if clicking outside
    useEffect(() => {
        function handleClickOutside(event: any) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    // LOGIC FIX: Enable button immediately when typing
    const handleInput = (text: string) => {
        setQuery(text);
        // Send text immediately so validation passes
        onSelect({ address: text, lat: null, lng: null }); 
    };

    // API Search with delay
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (query.length > 2) {
                try {
                    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=4`);
                    const data = await res.json();
                    setSuggestions(data);
                    setIsOpen(true);
                } catch (error) { console.error(error); }
            } else {
                setSuggestions([]);
                setIsOpen(false);
            }
        }, 300);
        return () => clearTimeout(delayDebounceFn);
    }, [query]);

    const handleSelect = (place: any) => {
        const shortName = place.display_name.split(',')[0];
        setQuery(shortName);
        setIsOpen(false);
        // Send exact coordinates
        onSelect({
            address: place.display_name,
            lat: place.lat,
            lng: place.lon
        });
    };

    return (
        <div ref={wrapperRef} className="relative mb-5">
            <label className="block text-xs font-black text-violet-600 uppercase tracking-widest mb-2 ml-1">{label}</label>
            <div className="relative">
                <input 
                    placeholder="Search location..."
                    className="w-full p-4 bg-white border-2 border-violet-100 rounded-2xl outline-none focus:border-fuchsia-500 focus:ring-4 focus:ring-fuchsia-500/20 transition-all font-bold text-slate-700 shadow-sm placeholder-slate-300"
                    value={query}
                    onChange={(e) => handleInput(e.target.value)}
                    onFocus={() => query.length > 2 && setIsOpen(true)}
                />
                
                {/* VIBRANT DROPDOWN */}
                {isOpen && suggestions.length > 0 && (
                    <ul className="absolute left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl shadow-violet-500/20 border border-violet-50 overflow-hidden z-[100] animate-in slide-in-from-top-2">
                        {suggestions.map((place, i) => (
                            <li 
                                key={i} 
                                onClick={() => handleSelect(place)}
                                className="p-4 hover:bg-gradient-to-r hover:from-violet-50 hover:to-fuchsia-50 cursor-pointer border-b border-slate-50 last:border-0 transition-colors flex items-center gap-3"
                            >
                                <span className="bg-violet-100 text-violet-600 w-8 h-8 rounded-full flex items-center justify-center text-xs">📍</span>
                                <div>
                                    <span className="font-bold text-slate-700 text-sm block">{place.display_name.split(',')[0]}</span>
                                    <span className="text-[10px] text-slate-400 block truncate max-w-[220px]">{place.display_name}</span>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}