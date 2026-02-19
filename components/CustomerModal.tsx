import * as React from 'react';
import { useState, useEffect } from 'react';
import { Customer } from '../types';
import {
    X,
    SearchCode
} from 'lucide-react';

interface CustomerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (customer: Customer) => Promise<void> | void;
    initialData?: Partial<Customer> | null;
    mode?: 'add' | 'edit';
}

const CustomerModal = ({ isOpen, onClose, onSave, initialData, mode = 'add' }: CustomerModalProps) => {
    const [formData, setFormData] = useState<Partial<Customer>>({
        type: 'CPF',
        address: { cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '' }
    });
    const [loadingSearch, setLoadingSearch] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setFormData({
                    ...initialData,
                    address: initialData.address || { cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '' }
                });
            } else {
                setFormData({
                    type: 'CPF',
                    address: { cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '' }
                });
            }
        }
    }, [isOpen, initialData]);

    const handleCepLookup = async (cep: string) => {
        const cleanedCep = cep.replace(/\D/g, '');
        if (cleanedCep.length === 8) {
            setLoadingSearch(true);
            try {
                const response = await fetch(`https://viacep.com.br/ws/${cleanedCep}/json/`);
                const data = await response.json();

                if (!data.erro) {
                    setFormData(prev => ({
                        ...prev,
                        address: {
                            ...prev.address!,
                            cep,
                            street: data.logradouro || prev.address?.street || '',
                            neighborhood: data.bairro || prev.address?.neighborhood || '',
                            city: data.localidade || prev.address?.city || '',
                            state: data.uf || prev.address?.state || '',
                            ibge: data.ibge || prev.address?.ibge || ''
                        }
                    }));
                }
            } catch (error) {
                console.error("Erro ao buscar CEP:", error);
            } finally {
                setLoadingSearch(false);
            }
        }
    };

    const handleCnpjLookup = async () => {
        if (!formData.document) return;
        const cleanCnpj = formData.document.replace(/\D/g, '');
        if (cleanCnpj.length !== 14) {
            alert("CNPJ inválido (deve ter 14 dígitos)");
            return;
        }

        setLoadingSearch(true);
        try {
            const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
            if (!response.ok) throw new Error("CNPJ não encontrado");
            const data = await response.json();

            setFormData(prev => ({
                ...prev,
                name: data.razao_social || '',
                tradeName: data.nome_fantasia || '',
                email: data.email || prev.email || '',
                phone: data.ddd_telefone_1 ? `(${data.ddd_telefone_1.substring(0, 2)}) ${data.ddd_telefone_1.substring(2)}` : prev.phone || '',
                address: {
                    ...prev.address!,
                    cep: data.cep || '',
                    street: data.logradouro || '',
                    number: data.numero || '',
                    complement: data.complemento || '',
                    neighborhood: data.bairro || '',
                    city: data.municipio || '',
                    state: data.uf || '',
                    ibge: data.ibge || ''
                }
            }));
        } catch (error) {
            console.error("Erro ao buscar CNPJ:", error);
            alert("Erro ao consultar CNPJ. Verifique se o número está correto.");
        } finally {
            setLoadingSearch(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const customerToSave = {
            ...formData,
            id: formData.id || crypto.randomUUID()
        } as Customer;

        await onSave(customerToSave);
        onClose();
    };

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
                <form onSubmit={handleSubmit} className="p-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[60vh] overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-slate-200">
                        <div className="col-span-full">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Tipo</label>
                            <div className="flex gap-2">
                                {['CPF', 'CNPJ'].map((t) => (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, type: t as any })}
                                        className={`flex-1 py-2 text-sm font-bold rounded-xl border ${formData.type === t ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-500'}`}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Documento *</label>
                            <div className="relative">
                                <input type="text" required value={formData.document || ''} onChange={(e) => setFormData({ ...formData, document: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm pr-10" />
                                {formData.type === 'CNPJ' && (
                                    <button
                                        type="button"
                                        onClick={handleCnpjLookup}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-600 hover:text-blue-800 p-1"
                                        title="Consultar CNPJ"
                                    >
                                        <SearchCode size={18} className={loadingSearch ? 'animate-pulse' : ''} />
                                    </button>
                                )}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">E-mail *</label>
                            <input type="email" required value={formData.email || ''} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                        </div>
                        <div className="col-span-full">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome Completo / Razão Social *</label>
                            <input type="text" required value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                        </div>
                        {formData.type === 'CNPJ' && (
                            <div className="col-span-full">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome Fantasia</label>
                                <input type="text" value={formData.tradeName || ''} onChange={(e) => setFormData({ ...formData, tradeName: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                            </div>
                        )}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">CEP *</label>
                            <input type="text" required value={formData.address?.cep || ''} onChange={(e) => { handleCepLookup(e.target.value); setFormData(p => ({ ...p, address: { ...p.address!, cep: e.target.value } })) }} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Telefone Principal *</label>
                            <input type="text" required value={formData.phone || ''} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Telefone Secundário</label>
                            <input type="text" value={formData.phone2 || ''} onChange={(e) => setFormData({ ...formData, phone2: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                        </div>
                        <div className="col-span-full grid grid-cols-2 md:grid-cols-6 gap-4">
                            <div className="col-span-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Rua/Logradouro</label>
                                <input type="text" value={formData.address?.street || ''} onChange={(e) => setFormData(p => ({ ...p, address: { ...p.address!, street: e.target.value } }))} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nº</label>
                                <input type="text" value={formData.address?.number || ''} onChange={(e) => setFormData(p => ({ ...p, address: { ...p.address!, number: e.target.value } }))} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Comp.</label>
                                <input type="text" value={formData.address?.complement || ''} onChange={(e) => setFormData(p => ({ ...p, address: { ...p.address!, complement: e.target.value } }))} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" placeholder="Ex: Apto 10" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Bairro</label>
                                <input type="text" value={formData.address?.neighborhood || ''} onChange={(e) => setFormData(p => ({ ...p, address: { ...p.address!, neighborhood: e.target.value } }))} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cidade</label>
                                <input type="text" value={formData.address?.city || ''} onChange={(e) => setFormData(p => ({ ...p, address: { ...p.address!, city: e.target.value } }))} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">UF</label>
                                <input type="text" value={formData.address?.state || ''} onChange={(e) => setFormData(p => ({ ...p, address: { ...p.address!, state: e.target.value } }))} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm uppercase" />
                            </div>
                        </div>

                        {formData.type === 'CNPJ' && (
                            <div className="col-span-full bg-blue-50/50 p-4 rounded-2xl border border-blue-100 space-y-4">
                                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Dados de Contato (PJ)</p>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome do Contato</label>
                                        <input type="text" value={formData.contactName || ''} onChange={(e) => setFormData({ ...formData, contactName: e.target.value })} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm" placeholder="Ex: João Silva" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Telefone do Contato</label>
                                        <input type="text" value={formData.contactPhone || ''} onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">E-mail do Contato</label>
                                        <input type="email" value={formData.contactEmail || ''} onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm" />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="flex gap-4 pt-4 border-t border-slate-100 mt-6">
                        <button type="button" onClick={onClose} className="flex-1 py-3 bg-slate-100 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-200 transition-colors">Cancelar</button>
                        <button type="submit" className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-all">Salvar Alterações</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CustomerModal;
