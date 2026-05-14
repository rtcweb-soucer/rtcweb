import * as React from 'react';
import { Customer } from '../types';
import { X } from 'lucide-react';
import CustomerForm from './CustomerForm';

interface CustomerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (customer: Customer) => Promise<void> | void;
    initialData?: Partial<Customer> | null;
    mode?: 'add' | 'edit';
}

const CustomerModal = ({ isOpen, onClose, onSave, initialData, mode = 'add' }: CustomerModalProps) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
                <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-xl font-black text-slate-900">{mode === 'edit' ? 'Editar Cliente' : 'Novo Cliente'}</h3>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-900 transition-colors">
                        <X size={24} />
                    </button>
                </div>
                <div className="p-8">
                    <CustomerForm 
                        initialData={initialData} 
                        onSave={async (data) => {
                            await onSave(data);
                            onClose();
                        }}
                        onCancel={onClose}
                        mode={mode}
                    />
                </div>
            </div>
        </div>
    );
};

export default CustomerModal;
