import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, User, X, Check } from 'lucide-react';
import { Customer } from '../types';
import { normalizeString } from '../utils/searchUtils';

interface SearchableCustomerSelectProps {
    customers: Customer[];
    value: string;
    onChange: (id: string) => void;
    placeholder?: string;
    className?: string;
}

const SearchableCustomerSelect: React.FC<SearchableCustomerSelectProps> = ({
    customers,
    value,
    onChange,
    placeholder = "Buscar cliente...",
    className = ""
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedCustomer = useMemo(() =>
        customers.find(c => c.id === value),
        [customers, value]
    );

    const filteredCustomers = useMemo(() => {
        if (!searchTerm) return customers.slice(0, 10);
        const normalizedSearch = normalizeString(searchTerm).trim();
        const documentSearch = searchTerm.replace(/\D/g, '');

        return customers.filter(c => {
            const nameMatch = normalizeString(c.name).includes(normalizedSearch);
            const tradeMatch = c.tradeName && normalizeString(c.tradeName).includes(normalizedSearch);
            const docMatch = documentSearch && c.document && c.document.replace(/\D/g, '').includes(documentSearch);
            return nameMatch || tradeMatch || docMatch;
        }).slice(0, 50);
    }, [customers, searchTerm]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 transition-all outline-none flex items-center justify-between cursor-pointer group"
            >
                <div className="flex items-center gap-2 truncate">
                    <User size={16} className={selectedCustomer ? "text-blue-500" : "text-slate-400"} />
                    <span className={selectedCustomer ? "text-slate-900" : "text-slate-400"}>
                        {selectedCustomer ? selectedCustomer.name : placeholder}
                    </span>
                </div>
                <Search size={16} className="text-slate-400 group-hover:text-blue-500 transition-colors" />
            </div>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-2xl shadow-2xl z-[300] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-3 border-b border-slate-50 relative">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                            type="text"
                            autoComplete="off"
                            name="customer-search-input"
                            placeholder="Digite o nome ou CPF/CNPJ..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-xs font-bold text-slate-700 focus:ring-0 outline-none"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    <div className="max-h-60 overflow-y-auto divide-y divide-slate-50 custom-scrollbar">
                        {filteredCustomers.length === 0 ? (
                            <div className="px-4 py-8 text-center text-slate-400">
                                <p className="text-xs font-medium">Nenhum cliente encontrado</p>
                            </div>
                        ) : (
                            filteredCustomers.map(c => (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => {
                                        onChange(c.id);
                                        setIsOpen(false);
                                        setSearchTerm('');
                                    }}
                                    className={`w-full p-3 md:p-4 text-left hover:bg-slate-50 transition-all flex items-center justify-between group ${value === c.id ? 'bg-blue-50/50' : ''}`}
                                >
                                    <div className="space-y-0.5 min-w-0 flex-1">
                                        <p className={`text-[11px] md:text-xs font-black uppercase tracking-tight truncate ${value === c.id ? 'text-blue-600' : 'text-slate-900'}`}>
                                            {c.name}
                                        </p>
                                        <p className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase truncate">
                                            {c.document} • {c.address.city}/{c.address.state}
                                        </p>
                                    </div>
                                    {value === c.id && (
                                        <div className="shrink-0 ml-2 p-1 bg-blue-600 text-white rounded-full">
                                            <Check size={10} />
                                        </div>
                                    )}
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
