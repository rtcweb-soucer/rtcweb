
import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { Customer } from '../types';
import { Search, CheckCircle2 } from 'lucide-react';
import { normalizeString } from '../utils/searchUtils';

interface SearchableCustomerSelectProps {
    value: string;
    onChange: (customerId: string) => void;
    customers: Customer[];
    placeholder?: string;
    className?: string;
}

const SearchableCustomerSelect = ({
    value,
    onChange,
    customers,
    placeholder = "Selecionar cliente...",
    className = ""
}: SearchableCustomerSelectProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const wrapperRef = useRef<HTMLDivElement>(null);

    const selectedCustomer = customers.find(c => c.id === value);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filtered = customers.filter(c =>
        !searchTerm ||
        normalizeString(c.name).includes(normalizeString(searchTerm)) ||
        (c.document && normalizeString(c.document).includes(normalizeString(searchTerm)))
    );

    return (
        <div className={`relative ${className}`} ref={wrapperRef}>
            <div
                onClick={() => {
                    setIsOpen(!isOpen);
                    if (!isOpen) setSearchTerm('');
                }}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus-within:ring-2 focus-within:ring-blue-500 cursor-pointer flex items-center justify-between transition-all"
            >
                <span className={`font-medium truncate ${selectedCustomer ? 'text-slate-900' : 'text-slate-400'}`}>
                    {selectedCustomer ? selectedCustomer.name : placeholder}
                </span>
                <Search size={16} className="text-slate-400" />
            </div>

            {isOpen && (
                <div className="absolute z-[200] top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                    <div className="p-3 border-b border-slate-50 bg-slate-50/50">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                            <input
                                autoFocus
                                type="text"
                                placeholder="Pesquisar..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    </div>
                    <div className="max-h-60 overflow-y-auto custom-scrollbar">
                        {filtered.length === 0 ? (
                            <div className="p-4 text-center text-xs text-slate-400">Nenhum cliente encontrado</div>
                        ) : (
                            filtered.map(c => (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => {
                                        onChange(c.id);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors flex items-center justify-between group ${c.id === value ? 'bg-blue-50/50' : ''}`}
                                >
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-sm font-bold text-slate-900 group-hover:text-blue-700">{c.name}</span>
                                        <span className="text-[10px] text-slate-400 font-medium">{c.document} • {c.address?.neighborhood}</span>
                                    </div>
                                    {c.id === value && <CheckCircle2 size={16} className="text-emerald-500" />}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SearchableCustomerSelect;
