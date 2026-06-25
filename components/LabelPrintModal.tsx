import * as React from 'react';
import { useState, useEffect } from 'react';
import { X, Printer } from 'lucide-react';
import { Order, Product, ProductionDetailing, TechnicalSheet } from '../types';
import { dataService } from '../services/dataService';

interface LabelPrintModalProps {
  order: Order;
  printData: any; // data from dataService.getOrderProductionData
  products: Product[];
  onClose: () => void;
}

export const LabelPrintModal = ({ order, printData, products, onClose }: LabelPrintModalProps) => {
  const printRef = React.useRef<HTMLDivElement>(null);
  const [detailings, setDetailings] = useState<ProductionDetailing[]>([]);

  useEffect(() => {
    const loadDetailings = async () => {
      try {
        const data = await dataService.getProductionDetailings();
        setDetailings(data);
      } catch (e) {
        console.error("Error loading detailings", e);
      }
    };
    loadDetailings();
  }, []);

  const handlePrint = () => {
    if (printRef.current) {
      const htmlContent = printRef.current.innerHTML;
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Imprimir Etiquetas</title>
              <style>
                body { font-family: sans-serif; margin: 0; padding: 0; background: #fff; }
                .label-page { 
                  width: 100mm; /* Exemplo: largura de impressora térmica */
                  margin: 0 auto;
                  padding: 10px;
                  page-break-after: always;
                }
                .label-header { border-bottom: 2px dashed #000; margin-bottom: 10px; padding-bottom: 10px; }
                .label-title { font-size: 16px; font-weight: bold; margin: 0; }
                .label-info { font-size: 12px; margin: 4px 0; }
                .cut-item { font-size: 14px; font-weight: bold; margin: 5px 0; border-bottom: 1px solid #eee; padding-bottom: 2px; }
                .cut-list { margin-top: 10px; }
                @media print {
                  @page { margin: 0; size: auto; }
                  body { margin: 0; }
                }
              </style>
            </head>
            <body>
              ${htmlContent}
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 250);
      }
    }
  };

  const evaluateFormula = (formula: string, width: number, height: number): string => {
    try {
      // Replace L and A ignoring case
      let expr = formula.replace(/L/gi, width.toString()).replace(/A/gi, height.toString());
      // Simple math evaluation using Function
      const result = new Function('return ' + expr)();
      if (isNaN(result)) return 'Erro na Fórm.';
      return Number(result).toFixed(3); // Up to 3 decimal places
    } catch (e) {
      return 'Erro na Fórm.';
    }
  };

  const getLabels = () => {
    const labels: any[] = [];
    const items = printData?.technicalSheet?.items || [];
    
    items.forEach((item: any, idx: number) => {
      // If quantity > 1, maybe print multiple labels, but let's do one per item entry for now
      // Or multiply the label? Let's assume one label per item in the TechnicalSheet.
      for (let i = 0; i < (item.quantity || 1); i++) {
        const product = products.find(p => p.id === item.productId);
        if (!product || !product.productionDetailingId) continue; // Only items with detailing
        
        const detailing = detailings.find(d => d.id === product.productionDetailingId);
        if (!detailing) continue;

        // Find matching rule
        const w = parseFloat(item.width) || 0;
        const h = parseFloat(item.height) || 0;

        const rule = detailing.rules?.find(r => {
          const minW = r.minWidth ?? 0;
          const maxW = r.maxWidth ?? Infinity;
          const minH = r.minHeight ?? 0;
          const maxH = r.maxHeight ?? Infinity;
          return w >= minW && w <= maxW && h >= minH && h <= maxH;
        });

        if (rule) {
          const cuts = (rule.cutFormulas || []).map(f => {
            if (f.type === 'MEASURE') {
              return { name: f.name, value: evaluateFormula(f.formula || '0', w, h) + ' m' };
            } else {
              return { name: f.name, value: (f.quantity || 1) + ' un' };
            }
          });

          labels.push({
            id: `${item.id}-${i}`,
            customerName: printData?.customer?.name || 'Cliente',
            orderNumber: order.contractNumber || order.quoteNumber || order.id.substring(0, 8),
            productName: product.nome,
            environment: item.environment,
            width: w,
            height: h,
            cuts: cuts
          });
        }
      }
    });

    return labels;
  };

  const labels = getLabels();

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-[600px] w-full max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10 rounded-t-3xl">
          <h3 className="text-lg font-black text-slate-800">Imprimir Etiquetas</h3>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              disabled={labels.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all disabled:opacity-50"
            >
              <Printer size={18} /> Imprimir
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto bg-slate-50 flex-1">
          {labels.length === 0 ? (
            <div className="text-center text-slate-500 py-10">
              Nenhuma etiqueta disponível para impressão.
              <br/>Verifique se os produtos deste pedido possuem Perfis de Detalhamento com Fórmulas de Corte configuradas e Medidas preenchidas.
            </div>
          ) : (
            <div ref={printRef} className="space-y-6 flex flex-col items-center">
              {labels.map((lbl, i) => (
                <div key={lbl.id} className="label-page bg-white p-4 border-2 border-slate-800 w-[100mm] shadow-sm relative">
                  <div className="label-header">
                    <h2 className="label-title">PEDIDO: {lbl.orderNumber}</h2>
                    <p className="label-info font-bold mt-1">CLIENTE: {lbl.customerName}</p>
                    <p className="label-info">AMBIENTE: {lbl.environment || 'N/A'}</p>
                  </div>
                  
                  <div className="mb-3">
                    <p className="label-info font-bold">{lbl.productName}</p>
                    <p className="label-info">
                      Medida Final: <b>{lbl.width.toFixed(2)} L x {lbl.height.toFixed(2)} A</b>
                    </p>
                  </div>

                  <div className="cut-list">
                    <p className="label-info font-black mb-2 uppercase border-b border-slate-300">Cortes / Materiais:</p>
                    {lbl.cuts.length === 0 && <p className="text-xs italic">Sem cortes cadastrados</p>}
                    {lbl.cuts.map((cut: any, idx: number) => (
                      <div key={idx} className="cut-item flex justify-between">
                        <span>{cut.name}</span>
                        <span>{cut.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
