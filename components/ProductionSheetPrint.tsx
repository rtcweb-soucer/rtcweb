import * as React from 'react';
import { Product, ProductionSheetCortina, ProductionSheetToldo, ProductionSheetCobertura } from '../types';
import { QRCodeSVG } from 'qrcode.react';

interface ProductionSheetPrintProps {
    data: {
        order: {
            id: string;
            technicalSheetId: string;
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

const ProductionSheetPrint = ({ data, products }: ProductionSheetPrintProps) => {
    const getProductName = (productId: string) => {
        return products.find(p => p.id === productId)?.nome || 'Produto não encontrado';
    };

    const getProductType = (productId: string): string => {
        return products.find(p => p.id === productId)?.tipo || 'Outro';
    };

    // Group items by environment and product type
    const groupedItems = React.useMemo(() => {
        const grouped: Record<string, Record<string, typeof data.items>> = {};

        // First, process main items (not accessories)
        data.items
            .filter(item => !item.parentItemId)
            .forEach(item => {
                const env = item.environment || 'Sem Ambiente';
                const type = getProductType(item.productId);

                if (!grouped[env]) grouped[env] = {};
                if (!grouped[env][type]) grouped[env][type] = [];

                grouped[env][type].push(item);
            });

        // Then, add accessories to their parent items
        data.items
            .filter(item => item.parentItemId)
            .forEach(accessory => {
                Object.values(grouped).forEach(envGroup => {
                    Object.values(envGroup).forEach(typeItems => {
                        const parent = typeItems.find(i => i.id === accessory.parentItemId);
                        if (parent) {
                            if (!(parent as any).accessories) (parent as any).accessories = [];
                            (parent as any).accessories.push(accessory);
                        }
                    });
                });
            });

        return grouped;
    }, [data.items, products]);

    // Render Cortina-specific fields
    const renderCortinaFields = (cortina: ProductionSheetCortina) => (
        <div className="grid grid-cols-3 gap-3">
            {cortina.comando && (
                <div>
                    <p className="text-xs font-bold text-blue-700 uppercase">Comando</p>
                    <p className="text-sm font-black text-blue-900">{cortina.comando}</p>
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
    const renderToldoFields = (toldo: ProductionSheetToldo) => (
        <div className="grid grid-cols-2 gap-3">
            {toldo.modelo && (
                <div>
                    <p className="text-xs font-bold text-orange-700 uppercase">Modelo</p>
                    <p className="text-sm font-black text-orange-900">{toldo.modelo}</p>
                </div>
            )}
            {toldo.comando && (
                <div>
                    <p className="text-xs font-bold text-orange-700 uppercase">Comando</p>
                    <p className="text-sm font-black text-orange-900">{toldo.comando}</p>
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
        <div className="print-container bg-white p-8 max-w-[210mm] mx-auto">
            <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-container, .print-container * {
            visibility: visible;
          }
          .print-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 20mm;
          }
          .no-print {
            display: none !important;
          }
          .page-break {
            page-break-after: always;
          }
          .avoid-break {
            page-break-inside: avoid;
          }
        }
      `}</style>

            {/* Header */}
            <div className="border-b-4 border-blue-600 pb-4 mb-6">
                <h1 className="text-3xl font-black text-slate-900 mb-1">FICHA DE PRODUÇÃO E INSTALAÇÃO</h1>
                <div className="flex justify-between items-end">
                    <div>
                        <p className="text-sm text-slate-600">
                            <span className="font-bold">Pedido:</span> #{data.order.id}
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
                    <div key={environment} className="mb-6 avoid-break">
                        {/* Environment Header */}
                        <div className="bg-slate-700 text-white px-4 py-2 rounded-t-lg">
                            <h3 className="text-base font-black uppercase">📍 {environment}</h3>
                        </div>

                        {/* Types within Environment */}
                        {Object.entries(types).map(([type, items]) => {
                            const typeStyle = getTypeStyle(type);
                            return (
                                <div key={type} className={`border-2 ${typeStyle.borderColor} rounded-b-lg mb-4 last:mb-0`}>
                                    {/* Type Header */}
                                    <div className={`${typeStyle.bgColor} px-4 py-2 border-b-2 ${typeStyle.borderColor}`}>
                                        <h4 className="text-sm font-black text-slate-800 uppercase">
                                            {typeStyle.icon} {type}S ({items.length} {items.length === 1 ? 'item' : 'itens'})
                                        </h4>
                                    </div>

                                    {/* Items */}
                                    {items.map((item, index) => (
                                        <div key={item.id} className="p-4 border-b border-slate-200 last:border-b-0 avoid-break">
                                            {/* Item Header */}
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <span className={`bg-${typeStyle.color}-600 text-white text-xs font-black px-2 py-1 rounded`}>
                                                        ITEM #{index + 1}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Item Details */}
                                            <div className="grid grid-cols-4 gap-3 mb-3">
                                                <div>
                                                    <p className="text-xs font-bold text-slate-500 uppercase">Produto</p>
                                                    <p className="text-sm font-bold text-slate-900">{getProductName(item.productId)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-500 uppercase">Medidas (L x A)</p>
                                                    <p className="text-sm font-bold text-slate-900">{item.width} x {item.height} m</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-500 uppercase">Quantidade</p>
                                                    <p className="text-sm font-bold text-slate-900">{item.quantity}</p>
                                                </div>
                                                {item.color && (
                                                    <div>
                                                        <p className="text-xs font-bold text-slate-500 uppercase">Cor</p>
                                                        <p className="text-sm font-bold text-slate-900">{item.color}</p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Production Details */}
                                            {item.productionSheet && (
                                                <div className={`mt-4 pt-4 border-t-2 ${typeStyle.borderColor} ${typeStyle.bgColor} -mx-4 -mb-4 p-4 rounded-b-lg`}>
                                                    <h5 className={`text-sm font-black text-${typeStyle.color}-900 mb-3 uppercase`}>
                                                        Especificações de Produção e Instalação
                                                    </h5>

                                                    {/* Render specific fields based on type */}
                                                    {item.productionSheet.cortina && renderCortinaFields(item.productionSheet.cortina)}
                                                    {item.productionSheet.toldo && renderToldoFields(item.productionSheet.toldo)}
                                                    {item.productionSheet.cobertura && renderCoberturaFields(item.productionSheet.cobertura)}

                                                    {/* General Observations */}
                                                    {item.productionSheet.observacoesGerais && (
                                                        <div className="mt-3">
                                                            <p className={`text-xs font-bold text-${typeStyle.color}-700 uppercase mb-1`}>Observações Gerais</p>
                                                            <p className={`text-sm text-${typeStyle.color}-900 bg-white p-2 rounded border border-${typeStyle.color}-200`}>
                                                                {item.productionSheet.observacoesGerais}
                                                            </p>
                                                        </div>
                                                    )}

                                                    {/* Video Link with QR Code */}
                                                    {item.productionSheet.videoLink && (
                                                        <div className={`flex gap-4 items-start bg-white p-3 rounded border border-${typeStyle.color}-200 mt-3`}>
                                                            <div className="flex-shrink-0">
                                                                <div className={`bg-white p-2 border-2 border-${typeStyle.color}-300 rounded`}>
                                                                    <QRCodeSVG value={item.productionSheet.videoLink} size={80} />
                                                                </div>
                                                                <p className={`text-xs text-center text-${typeStyle.color}-700 font-bold mt-1`}>Escaneie aqui</p>
                                                            </div>
                                                            <div className="flex-1">
                                                                <p className={`text-xs font-bold text-${typeStyle.color}-700 uppercase mb-1`}>Vídeo de Referência</p>
                                                                <a
                                                                    href={item.productionSheet.videoLink}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className={`text-xs text-${typeStyle.color}-600 underline break-all hover:text-${typeStyle.color}-800`}
                                                                >
                                                                    {item.productionSheet.videoLink}
                                                                </a>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Accessories */}
                                            {(item as any).accessories && (item as any).accessories.length > 0 && (
                                                <div className="mt-4 ml-8 border-l-4 border-amber-400 pl-4">
                                                    <h6 className="text-xs font-black text-amber-700 uppercase mb-2">🔧 Acessórios</h6>
                                                    {(item as any).accessories.map((acc: any) => (
                                                        <div key={acc.id} className="mb-2 bg-amber-50 p-2 rounded border border-amber-200">
                                                            <p className="text-xs font-bold text-amber-900">
                                                                {getProductName(acc.productId)} - {acc.width} x {acc.height} m
                                                                {acc.color && ` - ${acc.color}`}
                                                            </p>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            );
                        })}
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
};

export default ProductionSheetPrint;
