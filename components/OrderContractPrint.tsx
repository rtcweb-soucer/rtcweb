import React, { forwardRef } from 'react';
import { Order, Customer, Product, Seller, TechnicalSheet, MeasurementItem } from '../types';
import { 
  Layers, 
  CreditCard, 
  Info,
  MessageCircle,
  Copy,
  RefreshCw
} from 'lucide-react';

interface OrderContractPrintProps {
  order: Order;
  customers: Customer[];
  sellers: Seller[];
  products: Product[];
  technicalSheets: TechnicalSheet[];
  showActions?: boolean; 
  onGeneratePayment?: (inst: any) => void;
  onGenerateMasterPayment?: () => void;
  onWhatsAppShare?: (inst: any) => void;
  onCopyValue?: (text: string) => void;
  isGenerating?: string | null;
}

const OrderContractPrint = forwardRef<HTMLDivElement, OrderContractPrintProps>(({
  order,
  customers,
  sellers,
  products,
  technicalSheets,
  showActions = false,
  onGeneratePayment,
  onGenerateMasterPayment,
  onWhatsAppShare,
  onCopyValue,
  isGenerating
}, ref) => {
  const customer = customers.find(c => c.id === order.customerId);
  const seller = sellers.find(s => s.id === order.sellerId);
  const originalSheet = technicalSheets.find(s => s.id === order.technicalSheetId);

  const orderItems = (() => {
    if (order.itemsSnapshot && order.itemsSnapshot.length > 0) {
      return order.itemsSnapshot;
    }
    if (!originalSheet) return [];
    if (!order.itemIds) return originalSheet.items;
    return originalSheet.items.filter((item: MeasurementItem) => order.itemIds?.includes(item.id));
  })();

  const calculateItemPrice = (item: MeasurementItem) => {
    if (order.itemPrices && order.itemPrices[item.id] !== undefined) {
      return order.itemPrices[item.id];
    }

    const product = products.find((p: Product) => p.id === item.productId);
    if (!product) return 0;

    const area = (item.width * item.height) || 1;
    const baseValue = product.unidade === 'M2' ? product.valor * area : product.valor;

    const originalTotal = orderItems.reduce((acc: number, it: MeasurementItem) => {
      const p = products.find((prod: Product) => prod.id === it.productId);
      if (!p) return acc;
      const a = (it.width * it.height) || 1;
      return acc + (p.unidade === 'M2' ? p.valor * a : p.valor);
    }, 0);

    if (originalTotal > 0 && order.totalValue !== originalTotal) {
      if (order.itemPrices && Object.keys(order.itemPrices).length > 0) {
        return baseValue;
      }
      const ratio = order.totalValue / originalTotal;
      return baseValue * ratio;
    }
    return baseValue;
  };

  if (!customer) return <div className="p-10 text-center font-bold text-slate-400">Dados do cliente não encontrados.</div>;

  return (
    <div ref={ref} className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 print:shadow-none print:border-none print:m-0 print:rounded-none">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <td>
              <div className="p-6 pb-4 mb-4 bg-white border-b-2 border-slate-100 flex justify-between items-start gap-8">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 bg-white rounded-2xl flex items-center justify-center p-2 shadow-sm border border-slate-200">
                    <img src="https://www.rtcdecor.com.br/wp-content/uploads/2014/06/RTC-logo-atualizada-2.jpg" alt="RTC Logo" className="logo-img object-contain" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none" style={{ fontFamily: "'Playfair Display', serif" }}>Contrato de Venda</h1>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="bg-blue-600 text-white px-1.5 py-0.5 rounded text-[9px] font-black tracking-widest uppercase">
                        {order.contractNumber
                          ? `${order.quoteNumber || order.id} / ${order.contractNumber}`
                          : `Nº ${order.quoteNumber || order.id}`}
                      </span>
                      <span className="text-slate-400 font-medium text-[9px]">Data: {new Date(order.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5 px-2 py-1 bg-yellow-50 border border-yellow-200 rounded-md w-fit">
                      <span className="text-[8px] font-black text-yellow-700 uppercase tracking-widest">Consultor:</span>
                      <span className="text-[10px] font-black text-slate-900 uppercase">{seller?.name || 'NÃO DEFINIDO'}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right space-y-0">
                  <p className="text-[8px] font-black text-blue-600 uppercase tracking-widest mb-0.5">Contratada</p>
                  <p className="text-xs font-black text-slate-900">RTC TOLDOS E COBERTURAS LTDA</p>
                  <p className="text-[9px] text-slate-500 font-medium">CNPJ: 12.655.737/0001-21</p>
                  <p className="text-[9px] text-slate-500 font-medium">(21) 4062-7090 | (21) 2201-8118</p>
                  <p className="text-[9px] text-emerald-600 font-bold">WhatsApp: (21) 97078-9399 / (21) 96433-4539</p>
                </div>
              </div>
            </td>
          </tr>
        </thead>

        <tbody>
          <tr>
            <td>
              <div className="p-6 space-y-6">
                {/* Info do Cliente */}
                <section className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                  <div className="grid grid-cols-6 gap-x-6 gap-y-2">
                    <div className="col-span-3">
                      <p className="text-[7px] text-slate-400 uppercase font-black tracking-wider">Contratante</p>
                      <p className="text-xs font-bold text-slate-900">{customer.name}</p>
                      {customer.tradeName && (
                        <p className="text-[9px] text-slate-500 font-medium font-italic">({customer.tradeName})</p>
                      )}
                    </div>
                    <div className="col-span-1">
                      <p className="text-[7px] text-slate-400 uppercase font-black tracking-wider">Documento</p>
                      <p className="text-xs font-bold text-slate-900">{customer.document}</p>
                    </div>
                    <div className="col-span-2 text-right">
                      <p className="text-[7px] text-slate-400 uppercase font-black tracking-wider">Telefone</p>
                      <p className="text-xs font-bold text-slate-900">{customer.phone}{customer.phone2 ? ` / ${customer.phone2}` : ''}</p>
                    </div>

                    <div className="col-span-3">
                      <p className="text-[7px] text-slate-400 uppercase font-black tracking-wider">Endereço de Instalação</p>
                      <p className="text-xs font-bold text-slate-900">
                        {customer.address.street}, {customer.address.number}
                        {customer.address.complement ? ` - ${customer.address.complement}` : ''}
                      </p>
                      <p className="text-[9px] text-slate-500 font-medium">{customer.address.neighborhood} - {customer.address.city}/{customer.address.state}</p>
                    </div>
                    <div className="col-span-1">
                      <p className="text-[7px] text-slate-400 uppercase font-black tracking-wider">CEP</p>
                      <p className="text-xs font-bold text-slate-900">{customer.address.cep}</p>
                    </div>
                    <div className="col-span-2 text-right">
                      <p className="text-[7px] text-slate-400 uppercase font-black tracking-wider">E-mail</p>
                      <p className="text-xs font-bold text-slate-900 truncate">{customer.email}</p>
                    </div>
                  </div>
                </section>

                {/* Itens do Pedido */}
                <section>
                  <h2 className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-1.5 underline decoration-blue-500/30 underline-offset-4">
                    <Layers size={10} className="text-blue-500" /> Detalhamento dos Itens Contratados
                  </h2>
                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-900 text-white">
                        <tr>
                          <th className="px-3 py-1.5 text-[8px] font-black uppercase" style={{ width: '8%' }}>Ambiente</th>
                          <th className="px-3 py-1.5 text-[8px] font-black uppercase" style={{ width: '43%' }}>Descrição do Produto</th>
                          <th className="px-3 py-1.5 text-[8px] font-black uppercase text-center" style={{ width: '10%' }}>Cor</th>
                          <th className="px-3 py-1.5 text-[8px] font-black uppercase text-center" style={{ width: '21%' }}>Medida (L x A)</th>
                          <th className="px-3 py-1.5 text-[8px] font-black uppercase text-right" style={{ width: '18%' }}>Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {orderItems.map((item: MeasurementItem) => (
                          <tr key={item.id}>
                            <td className="px-3 py-1.5 text-xs font-bold text-slate-900">{item.environment}</td>
                            <td className="px-3 py-1.5 text-xs text-slate-700 font-medium">{products.find((p: Product) => p.id === item.productId)?.nome || 'Item Personalizado'}</td>
                            <td className="px-3 py-1.5 text-xs text-center text-slate-600 italic">{item.color || '-'}</td>
                            <td className="px-3 py-1.5 text-xs text-center font-mono font-bold text-blue-600">{(item.width || 0).toFixed(3)}m x {(item.height || 0).toFixed(3)}m</td>
                            <td className="px-3 py-1.5 text-xs text-right font-black text-slate-900 whitespace-nowrap">R$ {(calculateItemPrice(item) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-50">
                        <tr>
                          <td colSpan={4} className="px-4 py-3 text-right text-[8px] font-black text-slate-400 uppercase tracking-widest">Valor Total do Pedido</td>
                          <td className="px-4 py-3 text-right text-sm font-black text-slate-900 whitespace-nowrap">R$ {(order.totalValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </section>

                {/* Financeiro e Prazos */}
                <div className="w-full">
                  <section className="p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200/60 gap-4">
                      <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <CreditCard size={12} className="text-blue-500" /> Condições de Pagamento
                      </h4>
                      {showActions && onGenerateMasterPayment && order.installments?.some(i => i.status !== 'PAID' && i.paymentMethod?.toUpperCase().includes('CARTÃO')) && (
                        <div className="flex gap-2 items-center">
                          {order.installments?.some(i => i.paymentLink && i.paymentMethod?.toUpperCase().includes('CARTÃO')) && onCopyValue && (
                            <button
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                const link = order.installments?.find(i => i.paymentLink && i.paymentMethod?.toUpperCase().includes('CARTÃO'))?.paymentLink;
                                if (link) onCopyValue(link); 
                              }}
                              className="flex items-center gap-1 px-3 py-1 bg-slate-50 text-slate-600 border border-slate-200 rounded font-black hover:bg-slate-100 transition-colors no-print text-[9px]"
                            >
                              <Copy size={12} />
                              COPIAR LINK
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); onGenerateMasterPayment(); }}
                            disabled={isGenerating === `master-${order.id}`}
                            className="flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-600 border border-blue-100 rounded font-black hover:bg-blue-100 transition-colors disabled:opacity-50 no-print text-[9px]"
                          >
                            {isGenerating === `master-${order.id}` ? (
                              <RefreshCw size={12} className="animate-spin" />
                            ) : (
                              <CreditCard size={12} />
                            )}
                            GERAR LINK CARTÃO
                          </button>
                        </div>
                      )}
                    </div>

                    {order.installments && order.installments.length > 0 && (
                      <div className="space-y-1 list-none mb-4">
                        <div className="px-3 flex justify-between text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1.5 border-b border-slate-100 pb-1">
                          <div className="flex gap-4">
                            <span className="w-16 text-center">Nº Parcela</span>
                            <span>Forma de Pagamento</span>
                          </div>
                          <div className="flex gap-10">
                            <span className="w-16 text-right">Vencimento</span>
                            <span className="w-20 text-right">Valor</span>
                          </div>
                        </div>
                        {order.installments.map((inst, idx, arr) => (
                          <div key={inst.id} className="py-2 px-3 bg-white border border-slate-100 rounded-lg flex items-center justify-between text-[9px] uppercase hover:border-blue-200 transition-colors">
                            <div className="flex items-center gap-4">
                              <span className="font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-[8px] w-16 text-center">{inst.number}/{arr.length}</span>
                              <div className="flex flex-col">
                                 <span className="font-bold text-slate-600 truncate max-w-[150px]">{inst.paymentMethod || 'Espécie'}</span>
                                 {inst.status === 'PAID' ? (
                                    <span className="text-[7px] font-black text-emerald-600">LIQUIDADO</span>
                                 ) : (
                                    <span className="text-[7px] font-black text-amber-500 text-left">PENDENTE</span>
                                 )}
                              </div>
                            </div>
                            <div className="flex items-center gap-6">
                              <div className="flex flex-col items-end w-16">
                                <span className="font-black text-slate-900 leading-tight">{new Date(inst.dueDate).toLocaleDateString('pt-BR')}</span>
                              </div>
                              <div className="flex flex-col items-end min-w-[80px]">
                                <span className="font-black text-blue-700 leading-tight">R$ {inst.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                {showActions && inst.status !== 'PAID' && (inst.paymentMethod?.toUpperCase() === 'PIX') && (
                                  <div className="flex items-center gap-1.5 mt-1 no-print">
                                    {(inst.paymentLink || inst.pixCopyPaste) ? (
                                      <>
                                        {(inst.pixCopyPaste || inst.paymentLink) && onCopyValue && (
                                          <button 
                                            onClick={(e) => { e.stopPropagation(); onCopyValue((inst.pixCopyPaste || inst.paymentLink)!); }}
                                            className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                                            title={inst.pixCopyPaste ? "Copiar Código PIX" : "Copiar Link de Pagamento"}
                                          >
                                            <Copy size={12} />
                                          </button>
                                        )}
                                        {onWhatsAppShare && (
                                          <button 
                                            onClick={(e) => { e.stopPropagation(); onWhatsAppShare(inst); }}
                                            className="p-1 text-slate-400 hover:text-emerald-600 transition-colors"
                                            title="Enviar via WhatsApp"
                                          >
                                            <MessageCircle size={12} />
                                          </button>
                                        )}
                                      </>
                                    ) : (
                                      onGeneratePayment && (
                                        <button 
                                          onClick={(e) => { e.stopPropagation(); onGeneratePayment(inst); }}
                                          disabled={isGenerating === `${order.id}-${inst.id}`}
                                          className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded text-[8px] font-black hover:bg-emerald-100 transition-colors disabled:opacity-50"
                                        >
                                          {isGenerating === `${order.id}-${inst.id}` ? (
                                            <RefreshCw size={10} className="animate-spin" />
                                          ) : (
                                            <CreditCard size={10} />
                                          )}
                                          GERAR PIX
                                        </button>
                                      )
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="space-y-2">
                      {order.paymentConditions && (
                        <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl">
                          <h4 className="text-[8px] font-black text-blue-600 uppercase tracking-widest mb-1">Observações de Pagamento</h4>
                          <p className="text-[9px] font-bold text-slate-700 whitespace-pre-wrap">{order.paymentConditions}</p>
                        </div>
                      )}

                      {order.contractObservations && (
                        <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
                          <h4 className="text-[8px] font-black text-amber-600 uppercase tracking-widest mb-1">Observações do Contrato</h4>
                          <p className="text-[9px] font-bold text-slate-700 whitespace-pre-wrap">{order.contractObservations}</p>
                        </div>
                      )}
                    </div>
                  </section>
                </div>

                {/* Contract Clauses */}
                <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
                  <h3 className="text-[9px] font-black text-slate-900 uppercase tracking-widest border-b border-slate-200 pb-2">Cláusulas Contratuais</h3>
                  <div className="grid grid-cols-1 gap-4 text-[7.5px] text-slate-500 leading-relaxed text-justify px-2">
                    <div>
                      <p className="font-black text-slate-700 mb-1 uppercase tracking-wider">DA ENTREGA E INSTALAÇÃO:</p>
                      <p>O prazo de entrega será de <span className="font-black text-slate-900">{(order.deliveryDays || 25)} dias úteis</span> para os Produtos Contratados, definido a partir do primeiro pagamento efetuado a CONTRATADA. Prazo contado a partir do 1º dia útil após o pagamento efetuado e comprovado. Havendo ausência de pagamento o prazo será suspenso e remarcado após a comprovação dos pagamentos. Os pagamentos efetuados por depósito ou transferências deverão ser comprovados pela CONTRATANTE sob pena de não serem reconhecidos. O prazo acima definido está sujeito a alteração mediante a condições especiais como clima, chuvas intensas e etc.</p>
                    </div>
                    <div>
                      <p className="font-black text-slate-700 mb-1 uppercase tracking-wider">DA GARANTIA:</p>
                      <p>Os Produtos e seus componentes, acessórios e os complementos que deles fazem parte, descritos neste Contrato e seus anexos, têm garantia contra defeitos de fabricação de <span className="font-black text-slate-900">01 ano (já inclusa a garantia legal)</span>, estabelecida pela CONTRATADA e por seus fornecedores, de acordo com o disposto no art. 26, inciso II, da Lei 8.078 (CDC), a partir da entrega ou disponibilização dos produtos.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="font-black text-slate-700 mb-1 uppercase italic tracking-wider">A garantia ficará automaticamente cancelada se:</p>
                        <p>1ª- Houver danos por mau uso, manuseio ou remoção das embalagens inadequadamente por pessoal não autorizado; 2ª- Ajustes forem executados por terceiros inabilitados; 3ª- Houver problemas estruturais nos locais de fixação (paredes, lajes). É responsabilidade da CONTRATANTE providenciar os reforços necessários; 4ª- Intempéries naturais causarem danos.</p>
                      </div>
                      <div>
                        <p className="font-black text-slate-700 mb-1 uppercase tracking-wider">DEMAIS CLÁUSULAS:</p>
                        <div className="space-y-1">
                          <p>a) A CONTRATANTE confirma as medidas, cores e modelos detalhados no item de especificações deste contrato.</p>
                          <p>b) A fabricação observará o planejamento de produção conduzido pela CONTRATADA para atender ao prazo estipulado.</p>
                          <p>c) No caso de desistência a CONTRATANTE se obriga a arcar com o valor de 30% do valor do contrato para custos de material sob medida e administração.</p>
                          <p>d) O comprador obriga-se a pagar pela compra a importância lançada no item de valor total deste contrato.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </td>
          </tr>
        </tbody>

        <tfoot>
          <tr>
            <td>
              <div className="p-8 bg-white">
                <div className="flex justify-between items-end gap-12">
                  <div className="flex-1 text-center">
                    <div className="h-0.5 w-full bg-slate-900 mb-2 opacity-30"></div>
                    <p className="text-[8px] font-black text-slate-900 uppercase tracking-widest">Assinatura do Cliente</p>
                  </div>
                  <div className="flex-1 text-center flex flex-col items-center">
                    <img
                      src="/signature.png"
                      alt="Assinatura RTC"
                      className="h-10 mb-[-10px] z-10"
                      style={{ mixBlendMode: 'multiply' }}
                    />
                    <div className="h-0.5 w-full bg-slate-900 mb-2 opacity-30"></div>
                    <p className="text-[8px] font-black text-slate-900 uppercase tracking-widest">RTC TOLDOS E COBERTURAS LTDA</p>
                  </div>
                </div>
                <div className="mt-8 bg-slate-900 py-3 text-center rounded-xl">
                  <p className="text-[7px] text-white/30 uppercase font-black tracking-[0.4em]">RTC DECOR • QUALIDADE E EXCELÊNCIA EM RIO DE JANEIRO</p>
                </div>
              </div>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
});

OrderContractPrint.displayName = 'OrderContractPrint';

export default OrderContractPrint;
