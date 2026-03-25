import * as React from 'react';
import { Product, ProductionSheetCortina, ProductionSheetToldo, ProductionSheetCobertura } from '../types';
import { QRCodeSVG } from 'qrcode.react';

interface ProductionSheetPrintProps {
    data: {
        order: {
            id: string;
            technicalSheetId: string;
            contractNumber?: string;
            quoteNumber?: string;
            sellerName?: string;
            totalValue: number;
            createdAt: Date;
        };
        customer: {
            id: string;
            name: string;
            type: 'CPF' | 'CNPJ';
            cpfCnpj: string;
            phone: string;
            address: {
                street: string;
                number: string;
                complement?: string;
                neighborhood: string;
                city: string;
                state: string;
                zipCode: string;
            };
        };
        items: Array<{
            id: string;
            environment: string;
            productId: string;
            width: number;
            height: number;
            quantity: number;
            color?: string;
            command?: string; // New field
            notes?: string; // New field: Observações
            parentItemId?: string;
            productionSheet?: {
                id: string;
                measurementItemId: string;
                videoLink?: string;
                observacoesGerais?: string;
                // Campos específicos (apenas um será preenchido)
                cortina?: ProductionSheetCortina;
                toldo?: ProductionSheetToldo;
                cobertura?: ProductionSheetCobertura;
                createdAt: Date;
                updatedAt: Date;
            };
        }>;
    };
    products: Product[];
}

const ProductionSheetPrint = React.forwardRef(({ data, products }: ProductionSheetPrintProps, ref: React.Ref<HTMLDivElement>) => {
    const getProductName = (productId: string) => {
        return products.find(p => p.id === productId)?.nome || 'Produto não encontrado';
    };

    const getProductType = (productId: string): string => {
        return products.find(p => p.id === productId)?.tipo || 'Outro';
    };

    // Group items by environment and product type
    const groupedItems = React.useMemo(() => {
        // Create a map of clones to avoid mutating objects in the original data.items array
        const itemsMap = new Map(data.items.map(item => [item.id, { ...item, accessories: [] as any[] }]));
        const grouped: Record<string, Record<string, any[]>> = {};

        // Link accessories to parents and organize main items into groups
        for (const item of itemsMap.values()) {
            if (item.parentItemId) {
                const parent = itemsMap.get(item.parentItemId);
                if (parent) {
                    // Check to avoid duplicates if ID is somehow repeated
                    if (!parent.accessories.some((acc: any) => acc.id === item.id)) {
                        parent.accessories.push(item);
                    }
                }
            } else {
                const env = item.environment || 'Sem Ambiente';
                const type = getProductType(item.productId);

                if (!grouped[env]) grouped[env] = {};
                if (!grouped[env][type]) grouped[env][type] = [];

                grouped[env][type].push(item);
            }
        }

        return grouped;
    }, [data.items, products]);

    // Render Cortina-specific fields
    const renderCortinaFields = (cortina: ProductionSheetCortina, command?: string) => (
        <div className="grid grid-cols-3 gap-3">
            {command && (
                <div>
                    <p className="text-xs font-bold text-blue-700 uppercase">Comando</p>
                    <p className="text-sm font-black text-blue-900">{command}</p>
                </div>
            )}
            {cortina.vao && (
                <div>
                    <p className="text-xs font-bold text-blue-700 uppercase">Vão</p>
                    <p className="text-sm font-black text-blue-900">{cortina.vao}</p>
                </div>
            )}
            {cortina.varaoCor && (
                <div>
                    <p className="text-xs font-bold text-blue-700 uppercase">Varão Cor</p>
                    <p className="text-sm font-black text-blue-900">{cortina.varaoCor}</p>
                </div>
            )}
            {cortina.instalacao && (
                <div>
                    <p className="text-xs font-bold text-blue-700 uppercase">Instalação</p>
                    <p className="text-sm font-black text-blue-900">{cortina.instalacao}</p>
                </div>
            )}
            {cortina.trilho && (
                <div>
                    <p className="text-xs font-bold text-blue-700 uppercase">Trilho</p>
                    <p className="text-sm font-black text-blue-900">{cortina.trilho}</p>
                </div>
            )}
            {cortina.posicionamento && (
                <div>
                    <p className="text-xs font-bold text-blue-700 uppercase">Posicionamento</p>
                    <p className="text-sm font-black text-blue-900">{cortina.posicionamento}</p>
                </div>
            )}
        </div>
    );

    // Render Toldo-specific fields
    const renderToldoFields = (toldo: ProductionSheetToldo, command?: string) => (
        <div className="grid grid-cols-2 gap-3">
            {toldo.modelo && (
                <div>
                    <p className="text-xs font-bold text-orange-700 uppercase">Modelo</p>
                    <p className="text-sm font-black text-orange-900">{toldo.modelo}</p>
                </div>
            )}
            {command && (
                <div>
                    <p className="text-xs font-bold text-orange-700 uppercase">Comando</p>
                    <p className="text-sm font-black text-orange-900">{command}</p>
                </div>
            )}
            {toldo.bambinela && (
                <div>
                    <p className="text-xs font-bold text-orange-700 uppercase">Bambinela</p>
                    <p className="text-sm font-black text-orange-900">{toldo.bambinela}</p>
                </div>
            )}
            {toldo.vies && (
                <div>
                    <p className="text-xs font-bold text-orange-700 uppercase">Viés</p>
                    <p className="text-sm font-black text-orange-900">{toldo.vies}</p>
                </div>
            )}
            {toldo.entreVao && (
                <div>
                    <p className="text-xs font-bold text-orange-700 uppercase">Entre Vão</p>
                    <p className="text-sm font-black text-orange-900">{toldo.entreVao}</p>
                </div>
            )}
            {toldo.corFerragem && (
                <div>
                    <p className="text-xs font-bold text-orange-700 uppercase">Cor Ferragem</p>
                    <p className="text-sm font-black text-orange-900">{toldo.corFerragem}</p>
                </div>
            )}
            {toldo.bracos && (
                <div>
                    <p className="text-xs font-bold text-orange-700 uppercase">Braços</p>
                    <p className="text-sm font-black text-orange-900">{toldo.bracos}</p>
                </div>
            )}
            {toldo.medidasBraco && (
                <div>
                    <p className="text-xs font-bold text-orange-700 uppercase">Medidas Braço</p>
                    <p className="text-sm font-black text-orange-900">{toldo.medidasBraco}</p>
                </div>
            )}
            {toldo.fixacao && (
                <div>
                    <p className="text-xs font-bold text-orange-700 uppercase">Fixação</p>
                    <p className="text-sm font-black text-orange-900">{toldo.fixacao}</p>
                </div>
            )}
            {toldo.medidaFixacao && (
                <div>
                    <p className="text-xs font-bold text-orange-700 uppercase">Medida Fixação</p>
                    <p className="text-sm font-black text-orange-900">{toldo.medidaFixacao}</p>
                </div>
            )}
            {toldo.trava && (
                <div>
                    <p className="text-xs font-bold text-orange-700 uppercase">Trava</p>
                    <p className="text-sm font-black text-orange-900">{toldo.trava}</p>
                </div>
            )}
            {toldo.manivelaQtd !== undefined && (
                <div>
                    <p className="text-xs font-bold text-orange-700 uppercase">Manivela Qtd</p>
                    <p className="text-sm font-black text-orange-900">{toldo.manivelaQtd}</p>
                </div>
            )}
            {toldo.medidaManivela && (
                <div>
                    <p className="text-xs font-bold text-orange-700 uppercase">Medida Manivela</p>
                    <p className="text-sm font-black text-orange-900">{toldo.medidaManivela}</p>
                </div>
            )}
            {toldo.parapeito && (
                <div>
                    <p className="text-xs font-bold text-orange-700 uppercase">Parapeito</p>
                    <p className="text-sm font-black text-orange-900">{toldo.parapeito}</p>
                </div>
            )}
            {toldo.larguraBeiral && (
                <div>
                    <p className="text-xs font-bold text-orange-700 uppercase">Largura Beiral</p>
                    <p className="text-sm font-black text-orange-900">{toldo.larguraBeiral}</p>
                </div>
            )}
            {toldo.caida && (
                <div>
                    <p className="text-xs font-bold text-orange-700 uppercase">Caída</p>
                    <p className="text-sm font-black text-orange-900">{toldo.caida}</p>
                </div>
            )}
            {toldo.alturaInstalacao && (
                <div>
                    <p className="text-xs font-bold text-orange-700 uppercase">Altura Instalação</p>
                    <p className="text-sm font-black text-orange-900">{toldo.alturaInstalacao}</p>
                </div>
            )}
            {toldo.instalacao && (
                <div>
                    <p className="text-xs font-bold text-orange-700 uppercase">Instalação</p>
                    <p className="text-sm font-black text-orange-900">{toldo.instalacao}</p>
                </div>
            )}
            {toldo.corredica && (
                <div>
                    <p className="text-xs font-bold text-orange-700 uppercase">Corrediça</p>
                    <p className="text-sm font-black text-orange-900">{toldo.corredica}</p>
                </div>
            )}
            {toldo.posicionamento && (
                <div>
                    <p className="text-xs font-bold text-orange-700 uppercase">Posicionamento</p>
                    <p className="text-sm font-black text-orange-900">{toldo.posicionamento}</p>
                </div>
            )}
            {toldo.obs && (
                <div className="col-span-2">
                    <p className="text-xs font-bold text-orange-700 uppercase">Observações</p>
                    <p className="text-sm text-orange-900 bg-white p-2 rounded border border-orange-200">{toldo.obs}</p>
                </div>
            )}
        </div>
    );

    // Render Cobertura-specific fields
    const renderCoberturaFields = (cobertura: ProductionSheetCobertura) => (
        <div className="grid grid-cols-2 gap-3">
            {cobertura.corFerragem && (
                <div>
                    <p className="text-xs font-bold text-green-700 uppercase">Cor Ferragem</p>
                    <p className="text-sm font-black text-green-900">{cobertura.corFerragem}</p>
                </div>
            )}
            {cobertura.alturaInstalacao && (
                <div>
                    <p className="text-xs font-bold text-green-700 uppercase">Altura Instalação</p>
                    <p className="text-sm font-black text-green-900">{cobertura.alturaInstalacao}</p>
                </div>
            )}
            {cobertura.caida && (
                <div>
                    <p className="text-xs font-bold text-green-700 uppercase">Caída</p>
                    <p className="text-sm font-black text-green-900">{cobertura.caida}</p>
                </div>
            )}
            {cobertura.calhaSaida && (
                <div>
                    <p className="text-xs font-bold text-green-700 uppercase">Calha Saída</p>
                    <p className="text-sm font-black text-green-900">{cobertura.calhaSaida}</p>
                </div>
            )}
        </div>
    );

    // Get type icon and color
    const getTypeStyle = (type: string) => {
        switch (type) {
            case 'Cortina':
                return { icon: '📋', color: 'blue', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' };
            case 'Toldo':
                return { icon: '☂️', color: 'orange', bgColor: 'bg-orange-50', borderColor: 'border-orange-200' };
            case 'Cobertura':
                return { icon: '🏠', color: 'green', bgColor: 'bg-green-50', borderColor: 'border-green-200' };
            default:
                return { icon: '📦', color: 'gray', bgColor: 'bg-gray-50', borderColor: 'border-gray-200' };
        }
    };

    return (
        <div ref={ref} className="print-container bg-white p-8 max-w-[210mm] mx-auto">
            {/* Header */}
            <div className="border-b-4 border-blue-600 pb-4 mb-6">
                <h1 className="text-3xl font-black text-slate-900 mb-1">FICHA DE PRODUÇÃO E INSTALAÇÃO</h1>
                <div className="flex justify-between items-end">
                    <div>
                        <p className="text-sm text-slate-600">
                            <span className="font-bold">Contrato:</span> {data.order.contractNumber || '---'} | <span className="font-bold">Orçamento:</span> {data.order.quoteNumber || data.order.id}
                        </p>
                        <p className="text-sm text-slate-600">
                            <span className="font-bold">Vendedor:</span> {data.order.sellerName || 'RTC - Toldos & Cortinas'}
                        </p>
                        <p className="text-sm text-slate-600">
                            <span className="font-bold">Data de Emissão:</span> {new Date().toLocaleDateString('pt-BR')}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-slate-500">RTC - Toldos & Cortinas</p>
                    </div>
                </div>
            </div>

            {/* Customer Information */}
            <div className="mb-6 bg-slate-50 p-4 rounded-lg border border-slate-200">
                <h2 className="text-lg font-black text-slate-800 mb-3 uppercase">Dados do Cliente</h2>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase">Nome/Razão Social</p>
                        <p className="text-sm font-bold text-slate-900">{data.customer.name}</p>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase">{data.customer.type}</p>
                        <p className="text-sm font-bold text-slate-900">{data.customer.cpfCnpj}</p>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase">Telefone</p>
                        <p className="text-sm font-bold text-slate-900">{data.customer.phone}</p>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase">Endereço</p>
                        <p className="text-sm font-bold text-slate-900">
                            {data.customer.address.street}, {data.customer.address.number}
                            {data.customer.address.complement && ` - ${data.customer.address.complement}`}
                        </p>
                        <p className="text-sm text-slate-700">
                            {data.customer.address.neighborhood} - {data.customer.address.city}/{data.customer.address.state}
                        </p>
                    </div>
                </div>
            </div>

            {/* Items Grouped by Environment and Type */}
            <div className="mb-6">
                <h2 className="text-lg font-black text-slate-800 mb-4 uppercase">Itens para Produção</h2>

                {Object.entries(groupedItems).map(([environment, types]) => (
                    <div key={environment} className="mb-8 avoid-break">
                        {/* Environment Header */}
                        <div className="bg-slate-700 text-white px-4 py-2 rounded-t-lg">
                            <h3 className="text-base font-black uppercase">📍 {environment}</h3>
                        </div>

                        {/* 1. LISTA DE ITENS (Resumida) */}
                        <div className="mb-6">
                            {Object.entries(types).map(([type, items]) => {
                                const typeStyle = getTypeStyle(type);
                                return (
                                    <div key={type} className={`border-l-2 border-r-2 border-b-2 ${typeStyle.borderColor} mb-0 last:rounded-b-lg`}>
                                        {/* Type Header */}
                                        <div className={`${typeStyle.bgColor} px-4 py-2 border-b ${typeStyle.borderColor}`}>
                                            <h4 className="text-sm font-black text-slate-800 uppercase">
                                                {typeStyle.icon} {type}S ({items.length} {items.length === 1 ? 'item' : 'itens'})
                                            </h4>
                                        </div>

                                        {/* Items List */}
                                        {items.map((item, index) => (
                                            <div key={item.id} className="p-3 border-b border-slate-200 last:border-b-0">
                                                <div className="flex gap-4 items-center">
                                                    <div className="shrink-0">
                                                        <span className={`bg-${typeStyle.color}-600 text-white text-[10px] font-black px-2 py-0.5 rounded`}>
                                                            #{index + 1}
                                                        </span>
                                                    </div>
                                                    <div className="grid grid-cols-4 gap-4 flex-1">
                                                        <div>
                                                            <p className="text-[10px] font-bold text-slate-500 uppercase">Produto</p>
                                                            <p className="text-xs font-bold text-slate-900">{getProductName(item.productId)}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] font-bold text-slate-500 uppercase">Medidas (LxA)</p>
                                                            <p className="text-xs font-bold text-slate-900">{item.width.toFixed(3)} x {item.height.toFixed(3)} m</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] font-bold text-slate-500 uppercase">Qtd</p>
                                                            <p className="text-xs font-bold text-slate-900">{item.quantity}</p>
                                                        </div>
                                                        {item.color && (
                                                            <div>
                                                                <p className="text-[10px] font-bold text-slate-500 uppercase">Cor</p>
                                                                <p className="text-xs font-bold text-slate-900">{item.color}</p>
                                                            </div>
                                                        )}
                                                        {/* New Fields in List View - Second Row implicit via grid wrapping if needed, or specific div */}
                                                    </div>
                                                </div>

                                                {/* Sub-row for Command and Notes to preserve format */}
                                                {(item.command || item.notes) && (
                                                    <div className="mt-2 ml-10 grid grid-cols-2 gap-4">
                                                        {item.command && (
                                                            <div>
                                                                <p className="text-[9px] font-bold text-slate-400 uppercase">Comando</p>
                                                                <p className="text-xs font-bold text-slate-800">{item.command}</p>
                                                            </div>
                                                        )}
                                                        {item.notes && (
                                                            <div>
                                                                <p className="text-[9px] font-bold text-slate-400 uppercase">Observações</p>
                                                                <p className="text-xs font-bold text-slate-800">{item.notes}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Accessories/Sub-items inside the list item for context */}
                                                {(item as any).accessories && (item as any).accessories.length > 0 && (
                                                    <div className="mt-2 ml-10 pl-4 border-l-2 border-amber-300 space-y-1">
                                                        {(item as any).accessories.map((acc: any) => {
                                                            const isSubItem = acc.productId === item.productId;
                                                            return (
                                                                <div key={acc.id} className="text-xs text-slate-600">
                                                                    <span className={`font-black ${isSubItem ? 'text-blue-700' : 'text-amber-700'}`}>
                                                                        {isSubItem ? 'Sub-item:' : 'Acessório:'}
                                                                    </span> {getProductName(acc.productId)} ({acc.width.toFixed(3)}x{acc.height.toFixed(3)}m) {acc.color ? `- Cor: ${acc.color}` : ''} {acc.command ? `- Cmd: ${acc.command}` : ''}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                );
                            })}
                        </div>

                        {/* 2. DETALHAMENTO TÉCNICO (Ao final do ambiente) */}
                        <div className="mt-4">
                            <h4 className="text-sm font-black text-slate-400 uppercase border-b border-slate-200 pb-1 mb-4 flex items-center gap-2">
                                <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded text-[10px]">DETALHAMENTO TÉCNICO</span>
                            </h4>

                            {Object.entries(types).map(([type, items]) => {
                                const typeStyle = getTypeStyle(type);
                                // Filter items that actually have production sheets or specs to avoid empty blocks
                                const itemsWithSpecs = items.filter(i => i.productionSheet);

                                if (itemsWithSpecs.length === 0) return null;

                                return (
                                    <div key={`specs-${type}`} className="space-y-6">
                                        {items.map((item, index) => {
                                            const itemsToRender = [item, ...((item as any).accessories || [])].filter(i => i.productionSheet);

                                            return itemsToRender.map((it, itIdx) => {
                                                const isNested = it.id !== item.id;
                                                const nestedLabel = it.productId === item.productId ? 'SUB-ITEM' : 'ACESSÓRIO';

                                                return (
                                                    <div key={`spec-${it.id}`} className={`border-2 ${typeStyle.borderColor} rounded-lg p-5 avoid-break bg-white/50 mb-4 ${isNested ? 'ml-8 border-l-8' : ''}`}>
                                                        {/* Spec Header to link back to list */}
                                                        <div className="flex items-center justify-between mb-4 pb-2 border-b border-dashed border-slate-300">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`bg-${typeStyle.color}-100 text-${typeStyle.color}-800 border border-${typeStyle.color}-200 text-xs font-black px-2 py-1 rounded`}>
                                                                    {isNested ? nestedLabel : `ITEM #${index + 1}`}
                                                                </span>
                                                                <span className="text-sm font-bold text-slate-700">
                                                                    {getProductName(it.productId)}
                                                                </span>
                                                            </div>
                                                            <div className="text-xs text-slate-400 font-mono">
                                                                {isNested ? `PAI: #${index + 1}` : type.toUpperCase()}
                                                            </div>
                                                        </div>

                                                        <h5 className={`text-sm font-black text-${typeStyle.color}-900 mb-3 uppercase flex items-center gap-2`}>
                                                            {typeStyle.icon} Especificações de Produção
                                                        </h5>

                                                        {/* Render specific fields based on type */}
                                                        {it.productionSheet.cortina && renderCortinaFields(it.productionSheet.cortina, it.command)}
                                                        {it.productionSheet.toldo && renderToldoFields(it.productionSheet.toldo, it.command)}
                                                        {it.productionSheet.cobertura && renderCoberturaFields(it.productionSheet.cobertura)}

                                                        {/* Display Item Notes in Detailed View if not already covered */}
                                                        {it.notes && (
                                                            <div className="mt-3">
                                                                <p className={`text-xs font-bold text-${typeStyle.color}-700 uppercase`}>Observações (Medição)</p>
                                                                <p className={`text-sm font-bold text-${typeStyle.color}-900`}>{it.notes}</p>
                                                            </div>
                                                        )}

                                                        {/* General Observations */}
                                                        {it.productionSheet.observacoesGerais && (
                                                            <div className="mt-4">
                                                                <p className={`text-xs font-bold text-${typeStyle.color}-700 uppercase mb-1`}>Observações Gerais</p>
                                                                <p className={`text-sm text-${typeStyle.color}-900 bg-white p-3 rounded border border-${typeStyle.color}-200`}>
                                                                    {it.productionSheet.observacoesGerais}
                                                                </p>
                                                            </div>
                                                        )}

                                                        {/* Video Link with QR Code */}
                                                        {it.productionSheet.videoLink && (
                                                            <div className={`flex gap-5 items-center bg-white p-4 rounded-xl border-2 border-${typeStyle.color}-100 mt-4`}>
                                                                <div className="flex-shrink-0">
                                                                    <div className={`bg-white p-2 border border-${typeStyle.color}-200 rounded-lg shadow-sm`}>
                                                                        <QRCodeSVG value={it.productionSheet.videoLink} size={90} />
                                                                    </div>
                                                                </div>
                                                                <div className="flex-1 space-y-1">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className={`w-2 h-2 rounded-full bg-${typeStyle.color}-500 animate-pulse`}></div>
                                                                        <p className={`text-xs font-bold text-${typeStyle.color}-700 uppercase`}>Vídeo de Instalação/Referência</p>
                                                                    </div>
                                                                    <p className="text-xs text-slate-500 leading-relaxed">
                                                                        Escaneie o QR Code ao lado para acessar o vídeo técnico deste item.
                                                                    </p>
                                                                    <a
                                                                        href={it.productionSheet.videoLink}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className={`block mt-1 text-xs text-${typeStyle.color}-600 underline break-all hover:text-${typeStyle.color}-800 font-mono`}
                                                                    >
                                                                        {it.productionSheet.videoLink}
                                                                    </a>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            });
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* Footer */}
            <div className="mt-8 pt-4 border-t border-slate-300 text-center text-xs text-slate-500">
                <p>Documento gerado automaticamente pelo sistema RTC - Toldos & Cortinas</p>
                <p>Data de impressão: {new Date().toLocaleString('pt-BR')}</p>
            </div>
        </div>
    );
});

ProductionSheetPrint.displayName = 'ProductionSheetPrint';

export const printHTML = (htmlContent: string) => {
    const printWindow = window.open('', '_blank', 'width=1024,height=800');
    if (!printWindow) {
        alert("Por favor, habilite pop-ups para visualizar o documento.");
        return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pt-br">
        <head>
          <meta charset="UTF-8">
          <title>Ficha de Produção</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap" rel="stylesheet">
          <style>
            @media print {
              body { margin: 0; padding: 0; background: white; }
              .no-print { display: none !important; }
              @page { size: A4; margin: 0; }
              
              /* Ensure backgrounds are printed */
              * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            }
            
            body { 
                font-family: 'Inter', sans-serif; 
                background-color: #f1f5f9; 
                padding: 40px 20px; 
                display: flex; 
                justify-content: center; 
            }
            
            /* Wrapper to simulate A4 paper on screen */
            .print-wrapper { 
                background: white; 
                width: 210mm; 
                min-height: 297mm; 
                padding: 0; 
                margin: 0 auto; 
                box-shadow: 0 0 40px rgba(0,0,0,0.1); 
                box-sizing: border-box; 
                position: relative; 
            }
            
            @media print {
                .print-wrapper {
                    width: 100%;
                    box-shadow: none;
                    margin: 0;
                }
            }
          </style>
        </head>
        <body>
          <div class="print-wrapper">
            ${htmlContent}
          </div>
          <script>
            window.onload = () => { setTimeout(() => { window.print(); }, 1000); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
};

export default ProductionSheetPrint;
