
import { Order, Customer, MeasurementItem, Product } from '../types';

export class SEFAZTxtGenerator {

    private static formatField(value: any, maxLength?: number, decimals: number = 2): string {
        if (value === null || value === undefined) return '';

        let strValue = '';

        if (typeof value === 'number') {
            strValue = value.toFixed(decimals);
        } else {
            strValue = String(value).trim();
        }

        // Remove pipe characters as they differenciate fields
        strValue = strValue.replace(/\|/g, '');

        if (maxLength && strValue.length > maxLength) {
            strValue = strValue.substring(0, maxLength);
        }

        return strValue;
    }

    // Remove caracteres especiais
    private static cleanString(str: string): string {
        return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9\s]/g, "");
    }

    // Normaliza UF para 2 letras maiúsculas
    private static normalizeState(state: string): string {
        if (!state) return '';

        const s = state.trim().toUpperCase();

        // Mapeamento básico de nomes para siglas (pode ser expandido)
        const map: Record<string, string> = {
            'RIO DE JANEIRO': 'RJ',
            'SAO PAULO': 'SP',
            'MINAS GERAIS': 'MG',
            'ESPIRITO SANTO': 'ES',
            // Adicionar outros se necessário
        };

        return map[s] || s.substring(0, 2); // Tenta o mapa ou pega os 2 primeiros chars
    }

    public static generate(
        order: Order,
        customer: Customer,
        items: MeasurementItem[],
        products: Product[],
        issuer: { cnpj: string, name: string, address: any },
        customPrices?: Record<string, number>,
        nfeNumber: number = 1,
        nfeSeries: number = 1
    ): string {
        const lines: string[] = [];

        // Normalização de Estados
        const issuerState = this.normalizeState(issuer.address.state);
        // Default customer state to issuer state if missing (assumes local sale) OR 'RJ' as fallback
        const customerState = this.normalizeState(customer.address.state) || issuerState || 'RJ';

        // NOTAFISCAL|1
        lines.push('NOTAFISCAL|1');

        // A|Versão do Schema|Id|
        lines.push(`A|4.00||`);

        // B - Identificação da Nota Fiscal
        const ufCode = issuerState === 'SP' ? '35' : issuerState === 'RJ' ? '33' : '33';
        const natOp = 'VENDA';
        const dhEmi = new Date().toISOString().split('.')[0] + '-03:00';
        const cNF = String(nfeNumber).padStart(8, '0').substring(0, 8);

        // B|cUF|cNF|NatOp|mod|serie|nNF|dhEmi|dhSaiEnt|tpNF|idDest|cMunFG|TpImp|TpEmis|cDV|TpAmb|FinNFe|indFinal|indPres|indIntermed|ProcEmi|VerProc|dhCont|xJust|
        lines.push(`B|${ufCode}|${cNF}|${natOp}|55|${nfeSeries}|${nfeNumber}|${dhEmi}||1|1|${issuer.address.ibge}|1|1|0|1|1|1|1|0|0|RTC_v1.0|||`);

        // C - Emitente
        lines.push(`C|${this.formatField(issuer.name, 60)}|${this.formatField(issuer.name, 60)}|||||1|`);
        lines.push(`C02|${this.cleanString(issuer.cnpj)}|`);
        lines.push(`C05|${issuer.address.street}|${issuer.address.number}||${issuer.address.neighborhood}|${issuer.address.ibge}|${issuer.address.city}|${issuerState}|${issuer.address.cep}|1058|BRASIL||`);

        // E - Destinatário
        lines.push(`E|${this.formatField(customer.name, 60)}|9||||${this.formatField(customer.email, 60)}|`);

        if (customer.type === 'CNPJ') {
            lines.push(`E02|${this.cleanString(customer.document)}|`);
        } else {
            lines.push(`E03|${this.cleanString(customer.document)}|`);
        }

        const addr = customer.address;
        // Prioridade:
        // 1. IBGE cadastrado no endereço do cliente
        // 2. Se for Rio de Janeiro, usa o IBGE do RJ
        // 3. Se o estado for o mesmo do emissor, usa o IBGE do emissor
        let cityIBGE = addr.ibge || '';
        if (!cityIBGE) {
            if (addr.city.toUpperCase().includes('RIO DE JANEIRO')) {
                cityIBGE = '3304557';
            } else if (addr.state === issuerState) {
                cityIBGE = issuer.address.ibge;
            }
        }

        lines.push(`E05|${this.formatField(addr.street, 60)}|${this.formatField(addr.number, 10)}|${this.formatField(addr.complement, 60)}|${this.formatField(addr.neighborhood, 60)}|${cityIBGE}|${this.formatField(addr.city, 60)}|${customerState}|${this.cleanString(addr.cep)}|1058|BRASIL||`);

        // H - Itens
        let itemIndex = 1;

        items.forEach((item) => {
            const product = products.find(p => p.id === item.productId);
            if (!product) return;

            // PREFERÊNCIA: Preço customizado (já calculado por área ou editado manualmente)
            // Se não houver, cai no valor base do produto
            const valorTotalCalculado = customPrices && customPrices[item.id] !== undefined
                ? customPrices[item.id]
                : (product.valor || 0) * item.quantity;

            const valorUnitario = valorTotalCalculado / (item.quantity || 1);

            // Lógica de CFOP Robusta
            const calculatedCfop = issuerState === customerState ? '5101' : '6101';
            const cfop = product.cfop ? this.cleanString(product.cfop) : calculatedCfop;

            // H|nItem|infAdProd|
            lines.push(`H|${itemIndex}||`);

            // I|cProd|cEAN|cBarra|xProd|NCM|EXTIPI|CFOP|uCom|qCom|vUnCom|vProd|cEANTrib|cBarraTrib|uTrib|qTrib|vUnTrib|vFrete|vSeg|vDesc|vOutro|indTot|xPed|nItemPed|nFCI|indEscala|CNPJFab|cBenef|
            // Fix: Head ||| (3 pipes) -> SEM GTIN|| (Alinha xProd e resolve Rejeição 883)
            // Fix: Mid ||| (3 pipes) -> SEM GTIN|| (Alinha uTrib e resolve Rejeição 883)
            // Fix: End ||||| (5 pipes) -> Alinha indTot 
            lines.push(`I|${itemIndex}|SEM GTIN||${this.formatField(product.nome, 120)}|${(product.ncm || '00000000').replace(/\D/g, '')}||${cfop}|${product.unidade}|${this.formatField(item.quantity, undefined, 4)}|${this.formatField(valorUnitario, undefined, 10)}|${this.formatField(valorTotalCalculado)}|SEM GTIN||${product.unidade}|${this.formatField(item.quantity, undefined, 4)}|${this.formatField(valorUnitario, undefined, 10)}|||||1|||||||`);

            lines.push(`M||`); // Tributos (Ajustado conforme modelo: M||)
            lines.push(`N|`);
            lines.push(`N10d|0|102|`); // ICMS
            lines.push(`Q|`);
            lines.push(`Q04|07|`); // PIS
            lines.push(`S|`);
            lines.push(`S04|07|`); // COFINS

            itemIndex++;
        });

        // W - Totais
        // TOTAL SOBERANO: Usar o totalValue do pedido para garantir paridade
        const totalNF = order.totalValue || 0;

        lines.push(`W|`);
        lines.push(`W02|0.00|0.00|0.00|0.00|0.00|0.00|0.00|0.00|${this.formatField(totalNF)}|0.00|0.00|0.00|0.00|0.00|0.00|0.00|0.00|0.00|${this.formatField(totalNF)}|0.00|`);

        // Totais adicionais conforme modelo do usuário
        lines.push(`W04c|0.00|`);
        lines.push(`W04e|0.00|`);
        lines.push(`W04g|0.00|`);

        // YA - Pagamento
        lines.push(`YA|`);
        // Alterado de 01 (Dinheiro) para 90 (Sem Pagamento) conforme solicitado
        // Quando tPag=90, vPag deve ser 0.00 conforme manual SEFAZ
        lines.push(`YA01a|1|90|0.00|||`);

        // Z - Infos Adicionais
        lines.push(`Z|||`);

        return lines.join('\n');
    }
}
