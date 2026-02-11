import * as React from 'react';
import { Seller } from '../types';

interface CommissionExtractPrintProps {
    seller: Seller;
    data: {
        orderId: string;
        customerName: string;
        sellerName: string;
        paymentDate: string;
        installmentValue: number;
        commissionRate: number;
        commissionValue: number;
        discount: number;
        installmentNumber: number;
        totalInstallments: number;
    }[];
    totalComissao: number;
    totalVolume: number;
    period: string;
}

const CommissionExtractPrint = ({ seller, data, totalComissao, totalVolume, period }: CommissionExtractPrintProps) => {
    return (
        <div className="print-container bg-white p-4 sm:p-8 max-w-[210mm] mx-auto text-slate-900 font-sans">
            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    .print-container, .print-container * { visibility: visible; }
                    .print-container {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        padding: 10mm;
                    }
                    .no-print { display: none !important; }
                }
            `}</style>

            {/* Header */}
            <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-6">
                <div>
                    <img src="https://www.rtcdecor.com.br/wp-content/uploads/2014/06/RTC-logo-atualizada-2.jpg" alt="RTC Logo" className="h-10 mb-3" />
                    <h1 className="text-xl font-black uppercase tracking-tighter text-slate-900">Extrato de Comissão</h1>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Vendedor: {seller.name}</p>
                </div>
                <div className="text-right">
                    <p className="text-[9px] font-black uppercase text-slate-400">Referente a</p>
                    <p className="text-sm font-black">{period}</p>
                    <p className="text-[9px] font-black uppercase text-slate-400 mt-2">Data de Emissão</p>
                    <p className="text-xs font-bold text-slate-600">{new Date().toLocaleDateString('pt-BR')}</p>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-sm">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total a Receber</p>
                    <p className="text-2xl font-black text-emerald-600">R$ {totalComissao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-sm">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Volume de Vendas (Base)</p>
                    <p className="text-lg font-black text-slate-700">R$ {totalVolume.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
            </div>

            {/* Table */}
            <table className="w-full text-left border-collapse text-xs">
                <thead>
                    <tr className="border-b-2 border-slate-200 bg-slate-50">
                        <th className="py-2 px-2 font-black uppercase text-slate-500 text-[9px]">Data Pagto</th>
                        <th className="py-2 px-2 font-black uppercase text-slate-500 text-[9px]">Pedido / Cliente</th>
                        <th className="py-2 px-2 font-black uppercase text-slate-500 text-[9px] text-center">Desc.</th>
                        <th className="py-2 px-2 font-black uppercase text-slate-500 text-[9px] text-center">Taxa</th>
                        <th className="py-2 px-2 font-black uppercase text-slate-500 text-[9px] text-right">Base</th>
                        <th className="py-2 px-2 font-black uppercase text-slate-500 text-[9px] text-right">Comissão</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {data.map((d, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="py-3 px-2 font-medium text-slate-600">
                                {new Date(d.paymentDate).toLocaleDateString('pt-BR')}
                            </td>
                            <td className="py-3 px-2">
                                <p className="font-bold text-slate-900 leading-tight">{d.customerName}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <p className="text-[8px] font-black text-blue-600 uppercase">Pedido {d.orderId}</p>
                                    <span className="text-[8px] bg-slate-100 px-1 py-0.2 rounded text-slate-500 font-black">
                                        Parc. {String(d.installmentNumber).padStart(2, '0')}/{String(d.totalInstallments).padStart(2, '0')}
                                    </span>
                                </div>
                            </td>
                            <td className="py-3 px-2 text-center">
                                <span className="text-[9px] font-black text-slate-500">{d.discount.toFixed(1)}%</span>
                            </td>
                            <td className="py-3 px-2 text-center font-black text-slate-700">
                                {(d.commissionRate * 100).toFixed(0)}%
                            </td>
                            <td className="py-3 px-2 text-right font-medium text-slate-500">
                                R$ {d.installmentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-3 px-2 text-right font-black text-emerald-600">
                                R$ {d.commissionValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Footer */}
            <div className="mt-12 pt-6 border-t border-slate-200 text-center">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.4em]">RTC DECOR • QUALIDADE E EXCELÊNCIA</p>
                <p className="text-[8px] text-slate-300 mt-2">Documento gerado eletronicamente em {new Date().toLocaleString('pt-BR')}</p>
            </div>
        </div>
    );
};

export default CommissionExtractPrint;
