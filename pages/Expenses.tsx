
import * as React from 'react';
import { useState, useMemo, useEffect } from 'react';
import { Expense, Order, Customer } from '../types';
import {
    Receipt,
    Search,
    Filter,
    TrendingUp,
    TrendingDown,
    Calendar,
    Briefcase,
    DollarSign,
    AlertCircle
} from 'lucide-react';
import { dataService } from '../services/dataService';

interface ExpensesProps {
    orders: Order[];
    customers: Customer[];
}

const Expenses = ({ orders, customers }: ExpensesProps) => {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');

    useEffect(() => {
        const loadExpenses = async () => {
            try {
                const data = await dataService.getExpenses();
                setExpenses(data);
            } catch (err) {
                console.error("Failed to load expenses:", err);
            } finally {
                setLoading(false);
            }
        };
        loadExpenses();
    }, []);

    const filteredExpenses = useMemo(() => {
        return expenses.filter(e => {
            const matchSearch = e.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                e.orderId.includes(searchTerm);
            const matchCategory = categoryFilter === '' || e.category === categoryFilter;
            return matchSearch && matchCategory;
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [expenses, searchTerm, categoryFilter]);

    const stats = useMemo(() => {
        return {
            total: filteredExpenses.reduce((acc, e) => acc + e.value, 0),
            count: filteredExpenses.length
        };
    }, [filteredExpenses]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Gestão de Despesas</h2>
                    <p className="text-slate-500">Acompanhamento de quebras, taxas e descontos.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-rose-50 text-rose-600 rounded-xl"><TrendingDown size={20} /></div>
                        <span className="text-[10px] font-black text-rose-500 bg-rose-50 px-2 py-1 rounded-full uppercase tracking-widest">Despesas Totais</span>
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Total Acumulado</p>
                    <p className="text-2xl font-black text-rose-600 mt-2">R$ {stats.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    <p className="text-xs text-slate-500 mt-1 font-medium">{stats.count} registros no total</p>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <AlertCircle className="text-blue-500" size={32} />
                    <div>
                        <p className="text-sm font-bold text-slate-700">Nota sobre Comissões</p>
                        <p className="text-xs text-slate-500">As despesas listadas aqui (como quebras de recebimento) não afetam o cálculo das comissões dos vendedores, que são baseadas no valor bruto dos pedidos.</p>
                    </div>
                </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 space-y-1 w-full">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pesquisa</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Descrição ou Pedido..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                </div>
                <div className="w-full md:w-64 space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Categoria</label>
                    <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700"
                    >
                        <option value="">Todas Categorias</option>
                        <option value="TAX">Taxas</option>
                        <option value="FEE">Quebras/Tarifas</option>
                        <option value="DISCOUNT">Descontos</option>
                        <option value="OTHER">Outros</option>
                    </select>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase">Data</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase">Descrição</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase">Pedido</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase">Categoria</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase text-right">Valor</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 italic font-medium">
                            {filteredExpenses.length === 0 ? (
                                <tr><td colSpan={5} className="px-6 py-20 text-center text-slate-400 italic">Nenhuma despesa encontrada.</td></tr>
                            ) : (
                                filteredExpenses.map((expense) => {
                                    const customer = orders.find(o => o.id === expense.orderId)?.customerId;
                                    const customerName = customers.find(c => c.id === customer)?.name;
                                    return (
                                        <tr key={expense.id} className="hover:bg-slate-50 transition-colors cursor-pointer">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <Calendar size={14} className="text-slate-400" />
                                                    <span className="text-sm font-bold text-slate-700">{new Date(expense.date).toLocaleDateString()}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-sm font-bold text-slate-900">{expense.description}</p>
                                                <p className="text-[10px] text-slate-400">{customerName}</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-[10px] font-black bg-blue-50 text-blue-600 px-2 py-1 rounded-full uppercase tracking-tighter border border-blue-100">
                                                    #{expense.orderId}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{expense.category}</span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="text-sm font-black text-rose-600">
                                                    R$ {expense.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Expenses;
