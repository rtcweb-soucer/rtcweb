import React, { useState, useEffect, useMemo } from 'react';
import { Order, Customer, Product, ProductionStage } from '../types';
import { supabase } from '../services/supabase';
import { 
  Printer, 
  Copy, 
  Check, 
  X, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  Factory, 
  Search, 
  Boxes, 
  Scissors, 
  Hammer, 
  Truck, 
  ClipboardList,
  FileText
} from 'lucide-react';

interface PCPExecutiveReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  customers: Customer[];
  products: Product[];
}

export const PCPExecutiveReportModal: React.FC<PCPExecutiveReportModalProps> = ({
  isOpen,
  onClose,
  orders,
  customers,
  products
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'delayed' | 'ontime' | 'stages'>('all');
  const [copied, setCopied] = useState(false);
  const [extraCustomerMap, setExtraCustomerMap] = useState<Map<string, string>>(new Map());

  // Busca clientes diretamente do banco caso não estejam no cache ou na prop customers
  useEffect(() => {
    if (!orders || orders.length === 0) return;

    const knownIds = new Set<string>();
    customers.forEach(c => knownIds.add(c.id));
    extraCustomerMap.forEach((_, id) => knownIds.add(id));

    const missingIds = orders
      .filter(o => o.customerId && !o.customerName && !knownIds.has(o.customerId))
      .map(o => o.customerId!)
      .filter(Boolean);

    const uniqueMissing = [...new Set(missingIds)];
    if (uniqueMissing.length === 0) return;

    supabase
      .from('customers')
      .select('id, name, trade_name')
      .in('id', uniqueMissing)
      .then(({ data, error }) => {
        if (!error && data && data.length > 0) {
          setExtraCustomerMap(prev => {
            const next = new Map(prev);
            data.forEach((c: any) => {
              next.set(c.id, c.trade_name || c.name);
            });
            return next;
          });
        }
      });
  }, [orders, customers]);

  // Process data for the report
  const reportData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Active production orders (exclude finished/delivered)
    const activeOrders = orders.filter(o => 
      o.productionStage !== ProductionStage.READY &&
      (o.status as string) !== 'FINISHED' &&
      (o.status as string) !== 'DELIVERED'
    );

    const customerMap = new Map<string, string>();
    customers.forEach(c => {
      customerMap.set(c.id, c.tradeName || c.name);
    });

    const delayedList: any[] = [];
    const onTimeList: any[] = [];
    const stageCounts: Record<string, { total: number; delayed: number }> = {
      [ProductionStage.NEW_ORDER]: { total: 0, delayed: 0 },
      [ProductionStage.PREPARATION]: { total: 0, delayed: 0 },
      [ProductionStage.PROVISIONING]: { total: 0, delayed: 0 },
      [ProductionStage.CUTTING_WELDING]: { total: 0, delayed: 0 },
      [ProductionStage.ASSEMBLY]: { total: 0, delayed: 0 },
      [ProductionStage.INSTALLATION]: { total: 0, delayed: 0 },
    };

    activeOrders.forEach(order => {
      const stage = (order.productionStage || ProductionStage.NEW_ORDER) as string;
      if (!stageCounts[stage]) {
        stageCounts[stage] = { total: 0, delayed: 0 };
      }
      stageCounts[stage].total++;

      const customerName = order.customerName ||
                           (order.customerId ? customerMap.get(order.customerId) : null) || 
                           (order.customerId ? extraCustomerMap.get(order.customerId) : null) ||
                           'Cliente não identificado';

      const contract = order.contractNumber || order.quoteNumber || order.id.slice(0, 8);

      let productsSummary = 'Diversos';
      if (order.itemsSnapshot) {
        try {
          const items = typeof order.itemsSnapshot === 'string' 
            ? JSON.parse(order.itemsSnapshot) 
            : order.itemsSnapshot;
          if (Array.isArray(items)) {
            const types = [...new Set(items.map((i: any) => i.productType || 'Produto'))];
            if (types.length > 0) {
              productsSummary = types.join(', ');
            }
          }
        } catch (e) {
          // ignore json parse error
        }
      }

      let isDelayed = false;
      let daysDelayed = 0;
      let deadlineFormatted = 'Não definida';

      if (order.deliveryDeadline) {
        const deadline = new Date(order.deliveryDeadline);
        deadline.setHours(0, 0, 0, 0);
        deadlineFormatted = new Date(order.deliveryDeadline).toLocaleDateString('pt-BR');

        if (deadline < today) {
          isDelayed = true;
          const diffMs = today.getTime() - deadline.getTime();
          daysDelayed = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
          stageCounts[stage].delayed++;
        }
      }

      const itemData = {
        id: order.id,
        contract,
        customer: customerName,
        stage,
        isDelayed,
        daysDelayed,
        deadlineFormatted,
        deadlineRaw: order.deliveryDeadline,
        products: productsSummary,
        totalValue: order.totalValue || 0,
        createdAt: order.createdAt
      };

      if (isDelayed) {
        delayedList.push(itemData);
      } else {
        onTimeList.push(itemData);
      }
    });

    // Sort delayed by highest delay first
    delayedList.sort((a, b) => b.daysDelayed - a.daysDelayed);

    // Sort on-time by earliest deadline
    onTimeList.sort((a, b) => {
      if (!a.deadlineRaw) return 1;
      if (!b.deadlineRaw) return -1;
      return new Date(a.deadlineRaw).getTime() - new Date(b.deadlineRaw).getTime();
    });

    // Find bottleneck stage (stage with most delayed, or most orders)
    let bottleneckStage = ProductionStage.PREPARATION as string;
    let maxDelayed = -1;
    Object.entries(stageCounts).forEach(([stg, count]) => {
      if (count.delayed > maxDelayed) {
        maxDelayed = count.delayed;
        bottleneckStage = stg;
      }
    });

    return {
      activeOrders,
      delayedList,
      onTimeList,
      stageCounts,
      totalCount: activeOrders.length,
      delayedCount: delayedList.length,
      onTimeCount: onTimeList.length,
      bottleneckStage
    };
  }, [orders, customers, products, extraCustomerMap]);

  if (!isOpen) return null;

  // Filter items based on active tab and search
  const filteredItems = useMemo(() => {
    let list: any[] = [];
    if (activeTab === 'delayed') {
      list = reportData.delayedList;
    } else if (activeTab === 'ontime') {
      list = reportData.onTimeList;
    } else {
      list = [...reportData.delayedList, ...reportData.onTimeList];
    }

    if (!searchTerm.trim()) return list;

    const term = searchTerm.toLowerCase();
    return list.filter(item => 
      item.customer.toLowerCase().includes(term) ||
      item.contract.toLowerCase().includes(term) ||
      item.stage.toLowerCase().includes(term) ||
      item.products.toLowerCase().includes(term)
    );
  }, [reportData, activeTab, searchTerm]);

  // Generate WhatsApp formatted text
  const generateWhatsAppSummary = () => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR');
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    let msg = `🚨 *RELATÓRIO DE PRODUÇÃO (PCP) - RTC* 🏭\n`;
    msg += `📅 *Posição da Fábrica:* ${dateStr} às ${timeStr}\n\n`;

    msg += `📊 *RESUMO GERAL:*\n`;
    msg += `• Pedidos no Prazo: *${reportData.onTimeCount}*\n`;
    msg += `• Pedidos Atrasados: *${reportData.delayedCount}*\n`;
    msg += `• Total em Fábrica: *${reportData.totalCount}*\n\n`;

    msg += `🏭 *VOLUME POR ETAPA:*\n`;
    Object.entries(reportData.stageCounts).forEach(([stage, counts]) => {
      const delayAlert = counts.delayed > 0 ? ` (🚨 ${counts.delayed} em atraso)` : '';
      msg += `• ${stage}: *${counts.total} pedidos*${delayAlert}\n`;
    });

    msg += `\n📉 *DETALHAMENTO DOS ATRASOS (CRÍTICOS):*\n`;
    if (reportData.delayedList.length === 0) {
      msg += `✅ *Nenhum pedido em atraso. Parabéns à equipe!*\n`;
    } else {
      reportData.delayedList.forEach(d => {
        msg += `\n🔴 *${d.customer}*\n`;
        msg += `• Contrato: *${d.contract}*\n`;
        msg += `• Etapa Atual: *${d.stage}*\n`;
        msg += `• Atraso: *${d.daysDelayed} dia(s)* (Limite: ${d.deadlineFormatted})\n`;
        msg += `• Produto(s): ${d.products}\n`;
      });
    }

    msg += `\n⚠️ *Aviso Operacional:* Priorizar pedidos no topo da lista para destravamento do fluxo fabril.`;
    return msg;
  };

  const handleCopyWhatsApp = () => {
    const text = generateWhatsAppSummary();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  // Open clean printable window for PDF output
  const handlePrintPDF = () => {
    const now = new Date();
    const emissionDate = now.toLocaleDateString('pt-BR');
    const emissionTime = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const printWindow = window.open('', '_blank', 'width=1100,height=850');
    if (!printWindow) {
      alert('Por favor, permita pop-ups no navegador para visualizar o PDF.');
      return;
    }

    const stageRows = Object.entries(reportData.stageCounts).map(([stage, counts]) => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 8px 12px; font-weight: 600; color: #1e293b;">${stage}</td>
        <td style="padding: 8px 12px; text-align: center; font-weight: 700; color: #0f172a;">${counts.total}</td>
        <td style="padding: 8px 12px; text-align: center; font-weight: 700; color: ${counts.delayed > 0 ? '#e11d48' : '#10b981'};">
          ${counts.delayed > 0 ? `🚨 ${counts.delayed}` : '0'}
        </td>
      </tr>
    `).join('');

    const delayedRows = reportData.delayedList.map(d => `
      <tr style="border-bottom: 1px solid #fecdd3; background-color: #fff1f2;">
        <td style="padding: 8px 10px; font-weight: 800; color: #be123c; text-align: center;">
          +${d.daysDelayed}d
        </td>
        <td style="padding: 8px 10px; font-weight: 700; color: #0f172a;">${d.contract}</td>
        <td style="padding: 8px 10px; font-weight: 600; color: #1e293b;">${d.customer}</td>
        <td style="padding: 8px 10px; font-weight: 700; color: #475569;">${d.stage}</td>
        <td style="padding: 8px 10px; color: #64748b; font-size: 11px;">${d.deadlineFormatted}</td>
        <td style="padding: 8px 10px; color: #334155; font-size: 11px;">${d.products}</td>
      </tr>
    `).join('');

    const onTimeRows = reportData.onTimeList.map(d => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 6px 10px; font-weight: 700; color: #0f172a;">${d.contract}</td>
        <td style="padding: 6px 10px; color: #1e293b;">${d.customer}</td>
        <td style="padding: 6px 10px; color: #475569;">${d.stage}</td>
        <td style="padding: 6px 10px; color: #10b981; font-weight: 600; font-size: 11px;">${d.deadlineFormatted}</td>
        <td style="padding: 6px 10px; color: #64748b; font-size: 11px;">${d.products}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pt-br">
        <head>
          <meta charset="UTF-8">
          <title>Relatorio_PCP_RTC_${emissionDate.replace(/\//g, '-')}</title>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
          <style>
            * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            body { 
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; 
              margin: 0; 
              padding: 20px; 
              background: #fff; 
              color: #0f172a;
              font-size: 12px;
            }
            @page { 
              size: A4 portrait; 
              margin: 10mm; 
            }
            @media print {
              body { padding: 0; }
              .no-print { display: none !important; }
              .page-break { page-break-before: always; }
            }
            .header {
              border-bottom: 3px solid #1e293b;
              padding-bottom: 14px;
              margin-bottom: 20px;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
            }
            .title {
              font-size: 20px;
              font-weight: 900;
              text-transform: uppercase;
              color: #0f172a;
              margin: 0 0 4px 0;
            }
            .subtitle {
              font-size: 11px;
              font-weight: 600;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .kpis {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 12px;
              margin-bottom: 20px;
            }
            .kpi-card {
              border: 1px solid #e2e8f0;
              padding: 12px;
              border-radius: 8px;
              background-color: #f8fafc;
            }
            .kpi-title {
              font-size: 10px;
              font-weight: 800;
              text-transform: uppercase;
              color: #64748b;
              margin-bottom: 4px;
            }
            .kpi-value {
              font-size: 22px;
              font-weight: 900;
            }
            .section-title {
              font-size: 13px;
              font-weight: 900;
              text-transform: uppercase;
              margin: 20px 0 8px 0;
              padding-bottom: 4px;
              border-bottom: 2px solid #cbd5e1;
              color: #1e293b;
              display: flex;
              justify-content: space-between;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 16px;
            }
            th {
              background-color: #0f172a;
              color: #ffffff;
              padding: 8px 10px;
              font-size: 10px;
              font-weight: 800;
              text-transform: uppercase;
              text-align: left;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="title">RTC - TOLDOS & CORTINAS</div>
              <div class="subtitle">Relatório Executivo de Produção (PCP) • Raio-X da Fábrica</div>
            </div>
            <div style="text-align: right; font-size: 11px; color: #475569;">
              <div><strong>Emissão:</strong> ${emissionDate} às ${emissionTime}</div>
              <div><strong>Diretoria de Operações</strong></div>
            </div>
          </div>

          <!-- KPI Cards -->
          <div class="kpis">
            <div class="kpi-card" style="border-left: 4px solid #3b82f6;">
              <div class="kpi-title">Total em Produção</div>
              <div class="kpi-value" style="color: #1e40af;">${reportData.totalCount}</div>
            </div>
            <div class="kpi-card" style="border-left: 4px solid #10b981;">
              <div class="kpi-title">No Prazo</div>
              <div class="kpi-value" style="color: #047857;">${reportData.onTimeCount}</div>
            </div>
            <div class="kpi-card" style="border-left: 4px solid #ef4444; background-color: #fff1f2;">
              <div class="kpi-title">Em Atraso</div>
              <div class="kpi-value" style="color: #b91c1c;">${reportData.delayedCount}</div>
            </div>
            <div class="kpi-card" style="border-left: 4px solid #f59e0b;">
              <div class="kpi-title">Gargalo Principal</div>
              <div class="kpi-value" style="color: #b45309; font-size: 15px; margin-top: 4px;">${reportData.bottleneckStage}</div>
            </div>
          </div>

          <!-- Raio-X por Etapa -->
          <div class="section-title">
            <span>Volume por Etapa Atual do Fluxo</span>
            <span style="font-size: 10px; color: #64748b;">Total: ${reportData.totalCount} pedidos</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Etapa do PCP</th>
                <th style="text-align: center;">Total de Pedidos</th>
                <th style="text-align: center;">Pedidos Atrasados</th>
              </tr>
            </thead>
            <tbody>
              ${stageRows}
            </tbody>
          </table>

          <!-- Pedidos em Atraso -->
          <div class="section-title" style="color: #be123c; border-color: #fca5a5;">
            <span>🚨 Detalhamento dos Pedidos em Atraso (Prioridade Operacional)</span>
            <span>${reportData.delayedCount} pedido(s)</span>
          </div>
          ${reportData.delayedList.length === 0 ? `
            <div style="padding: 16px; background-color: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; font-weight: 700; border-radius: 6px; text-align: center;">
              Nenhum pedido em atraso na fábrica.
            </div>
          ` : `
            <table>
              <thead>
                <tr style="background-color: #be123c;">
                  <th style="text-align: center; width: 60px;">Atraso</th>
                  <th style="width: 100px;">Contrato</th>
                  <th>Cliente</th>
                  <th>Etapa Atual</th>
                  <th style="width: 80px;">Prazo</th>
                  <th>Produto(s)</th>
                </tr>
              </thead>
              <tbody>
                ${delayedRows}
              </tbody>
            </table>
          `}

          <!-- Pedidos no Prazo -->
          <div class="section-title" style="margin-top: 24px;">
            <span>Pedidos Dentro do Prazo</span>
            <span>${reportData.onTimeCount} pedido(s)</span>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 100px;">Contrato</th>
                <th>Cliente</th>
                <th>Etapa Atual</th>
                <th style="width: 80px;">Prazo</th>
                <th>Produto(s)</th>
              </tr>
            </thead>
            <tbody>
              ${onTimeRows}
            </tbody>
          </table>

          <div style="margin-top: 30px; padding-top: 10px; border-top: 1px solid #cbd5e1; text-align: center; font-size: 10px; color: #94a3b8;">
            RTC Toldos & Cortinas • Relatório gerado automaticamente pelo Sistema de Gestão PCP
          </div>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 400);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Header do Modal */}
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-md">
              <Factory size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black text-slate-900">Relatório Executivo de Produção (PCP)</h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-indigo-100 text-indigo-700 tracking-wider">
                  Raio-X da Fábrica
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Controle de prazos, gargalos por etapa e lista ordenada de prioridades para impressão ou envio.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintPDF}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
              title="Abrir pré-visualização e gerar arquivo PDF"
            >
              <Printer size={15} />
              <span>Gerar PDF / Imprimir</span>
            </button>

            <button
              onClick={handleCopyWhatsApp}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border shadow-sm active:scale-95 ${
                copied 
                  ? 'bg-emerald-600 text-white border-emerald-600' 
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
              }`}
              title="Copiar texto formatado para enviar no WhatsApp"
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
              <span>{copied ? 'Copiado!' : 'Copiar p/ WhatsApp'}</span>
            </button>

            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all ml-1"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="p-5 border-b border-slate-100 bg-white grid grid-cols-2 md:grid-cols-4 gap-3.5 shrink-0">
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Total em Fábrica</span>
              <ClipboardList size={16} className="text-indigo-500" />
            </div>
            <div className="text-2xl font-black text-slate-900">{reportData.totalCount}</div>
            <div className="text-[11px] text-slate-400 font-medium">ordens ativas no fluxo</div>
          </div>

          <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-100">
            <div className="flex items-center justify-between text-emerald-700 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">No Prazo</span>
              <CheckCircle2 size={16} className="text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-emerald-700">{reportData.onTimeCount}</div>
            <div className="text-[11px] text-emerald-600/80 font-bold">
              {reportData.totalCount > 0 ? ((reportData.onTimeCount / reportData.totalCount) * 100).toFixed(0) : 100}% da produção
            </div>
          </div>

          <div className="p-3.5 bg-rose-50/70 rounded-xl border border-rose-100">
            <div className="flex items-center justify-between text-rose-700 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Atrasados</span>
              <AlertTriangle size={16} className="text-rose-600" />
            </div>
            <div className="text-2xl font-black text-rose-700">{reportData.delayedCount}</div>
            <div className="text-[11px] text-rose-600/80 font-bold">
              {reportData.totalCount > 0 ? ((reportData.delayedCount / reportData.totalCount) * 100).toFixed(0) : 0}% em atraso
            </div>
          </div>

          <div className="p-3.5 bg-amber-50/60 rounded-xl border border-amber-100">
            <div className="flex items-center justify-between text-amber-700 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Gargalo Principal</span>
              <Clock size={16} className="text-amber-600" />
            </div>
            <div className="text-lg font-black text-amber-900 truncate" title={reportData.bottleneckStage}>
              {reportData.bottleneckStage}
            </div>
            <div className="text-[11px] text-amber-700/80 font-medium">
              {reportData.stageCounts[reportData.bottleneckStage]?.delayed || 0} pedidos atrasados aqui
            </div>
          </div>
        </div>

        {/* Filtros e Abas */}
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex flex-wrap justify-between items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5 bg-slate-200/60 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos ({reportData.totalCount})
            </button>
            <button
              onClick={() => setActiveTab('delayed')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'delayed' ? 'bg-rose-600 text-white shadow-sm' : 'text-rose-600 hover:bg-rose-50'
              }`}
            >
              <AlertTriangle size={13} />
              Em Atraso ({reportData.delayedCount})
            </button>
            <button
              onClick={() => setActiveTab('ontime')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'ontime' ? 'bg-emerald-600 text-white shadow-sm' : 'text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              <CheckCircle2 size={13} />
              No Prazo ({reportData.onTimeCount})
            </button>
            <button
              onClick={() => setActiveTab('stages')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'stages' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Volume por Etapa
            </button>
          </div>

          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
            <Search size={14} className="text-slate-400" />
            <input 
              type="text"
              placeholder="Filtrar por contrato ou cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="text-xs bg-transparent border-none focus:outline-none w-48 text-slate-700 placeholder:text-slate-400"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="text-slate-400 hover:text-slate-600">
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Conteúdo Principal com Scroll */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'stages' ? (
            /* Vista de Volume por Etapa */
            <div className="space-y-4">
              <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-2">
                Distribuição dos Pedidos no Kanban
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(reportData.stageCounts).map(([stage, counts]) => (
                  <div key={stage} className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm hover:border-slate-300 transition-all">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-black text-slate-800 uppercase">{stage}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-black bg-slate-100 text-slate-700">
                        {counts.total} pedidos
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs mt-3 pt-3 border-t border-slate-100">
                      <div className="flex items-center gap-1.5 text-emerald-600 font-bold">
                        <CheckCircle2 size={14} />
                        <span>{counts.total - counts.delayed} no prazo</span>
                      </div>
                      {counts.delayed > 0 && (
                        <div className="flex items-center gap-1.5 text-rose-600 font-bold ml-auto">
                          <AlertTriangle size={14} />
                          <span>{counts.delayed} atrasado(s)</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Tabela de Pedidos */
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-black uppercase text-slate-500 bg-slate-50/60">
                    <th className="py-2.5 px-3">Status / Atraso</th>
                    <th className="py-2.5 px-3">Contrato</th>
                    <th className="py-2.5 px-3">Cliente</th>
                    <th className="py-2.5 px-3">Etapa Atual</th>
                    <th className="py-2.5 px-3">Prazo Limite</th>
                    <th className="py-2.5 px-3">Produtos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 font-medium">
                        Nenhum pedido encontrado para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => (
                      <tr 
                        key={item.id} 
                        className={`hover:bg-slate-50 transition-colors ${
                          item.isDelayed ? 'bg-rose-50/30' : ''
                        }`}
                      >
                        <td className="py-3 px-3">
                          {item.isDelayed ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-black bg-rose-100 text-rose-700">
                              <AlertTriangle size={12} />
                              +{item.daysDelayed} dias
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-700">
                              <CheckCircle2 size={12} />
                              No Prazo
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-900">{item.contract}</td>
                        <td className="py-3 px-3 font-semibold text-slate-800">{item.customer}</td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700">
                            {item.stage}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-600 font-medium">
                          {item.deadlineFormatted}
                        </td>
                        <td className="py-3 px-3 text-slate-500 max-w-xs truncate" title={item.products}>
                          {item.products}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer com instruções rápidas */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex flex-wrap justify-between items-center text-xs text-slate-500 shrink-0">
          <div>
            Dica: Ao clicar em <strong>"Gerar PDF / Imprimir"</strong>, selecione o destino <em>"Salvar como PDF"</em> no navegador.
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 shadow-sm transition-all"
            >
              Fechar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
