
import { Order, Customer, MeasurementItem, Product } from '../types';
import { SEFAZTxtGenerator } from './sefazTxtGenerator';

interface NFEmailConfig {
    cnpj: string;
    apiKey: string;
}

export const nfEmailService = {
    // Configuração (idealmente viria de um contexto ou banco)
    config: {
        cnpj: '12655737000121', // CNPJ da RTC TOLDOS
        apiKey: 'VszrSzJwHwqsA93rQiw8NBTt5ysTVaxFMl4CNSN' // Chave de API Fornecida
    },

    async setConfig(config: NFEmailConfig) {
        this.config = config;
    },

    async sendOrderMethods(
        order: Order,
        customer: Customer,
        items: MeasurementItem[],
        products: Product[],
        customPrices?: Record<string, number>,
        nfeNumber: number = 1,
        nfeSeries: number = 1
    ) {
        if (!this.config.cnpj || !this.config.apiKey) {
            throw new Error("Credenciais do NFEmail não configuradas.");
        }

        // 1. Gerar TXT
        const issuer = {
            cnpj: this.config.cnpj,
            name: "RTC TOLDOS E PERSIANAS",
            address: {
                street: "RUA DO CLIENTE", // Endereço genérico ou real se fornecido
                number: "100",
                neighborhood: "CENTRO",
                city: "RIO DE JANEIRO",
                state: "RJ",
                cep: "20000000",
                ibge: "3304557" // Código IBGE do RJ
            }
        };
        const txtContent = SEFAZTxtGenerator.generate(order, customer, items, products, issuer, customPrices, nfeNumber, nfeSeries);
        console.log("📝 TXT da NFe gerado:", txtContent);

        // 2. Preparar Payload
        // A API espera um POST com body x-www-form-urlencoded onde o conteúdo é "=" + conteudo_txt
        // Referencia: string postData = "=" + HttpUtility.UrlEncode(sConteudoTXT);
        const postData = "=" + encodeURIComponent(txtContent);

        // 3. Identificar Credenciais
        // A documentação C# usa NetworkCredential, o que sugere Basic Auth ou Headers específicos. 
        // Tentativa padrão: Basic Auth com User=CNPJ, Pass=Key
        const authHeader = 'Basic ' + btoa(`${this.config.cnpj}:${this.config.apiKey}`);

        try {
            // Nota: Devido a CORS, chamadas diretas do browser para APIs externas podem falhar se a API não permitir.
            // Usando Proxy configurado no Vite (Dev) e Vercel Rewrites (Prod)
            const apiUrl = '/api/nfemail/NotasFiscais';

            const response = await fetch(apiUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Authorization": authHeader
                },
                body: postData
            });

            const responseText = await response.text();

            if (!response.ok) {
                throw new Error(`Erro API NFEmail (${response.status}): ${responseText}`);
            }

            // O retorno pode conter a chave da nota ou sucesso
            // Se o retorno for um XML ou string contendo Chave: ..., extraímos
            return responseText;

        } catch (error) {
            console.error("Erro ao enviar para NFEmail:", error);
            throw error;
        }
    },

    async getNFeStatus(keyOrId: string) {
        const authHeader = 'Basic ' + btoa(`${this.config.cnpj}:${this.config.apiKey}`);
        const apiUrl = `/api/nfemail/NotasFiscais/${keyOrId}`;

        const response = await fetch(apiUrl, {
            headers: { "Authorization": authHeader }
        });
        return await response.text();
    },

    // Helper robusto para buscar tags ignorando case
    getTagValue(parent: Element | Document, tagName: string): string {
        const tags = parent.querySelectorAll('*');
        for (let i = 0; i < tags.length; i++) {
            if (tags[i].tagName.toLowerCase() === tagName.toLowerCase()) {
                return tags[i].textContent || '';
            }
        }
        return '';
    },

    // Helper robusto para buscar valores em objetos JSON (case-insensitive e variações)
    getJsonValue(obj: any, keys: string[]): string {
        if (!obj) return '';
        const objKeys = Object.keys(obj);
        for (const targetKey of keys) {
            // Busca exata primeira
            if (obj[targetKey] !== undefined && obj[targetKey] !== null) return String(obj[targetKey]);
            // Busca case-insensitive
            const foundKey = objKeys.find(k => k.toLowerCase() === targetKey.toLowerCase());
            if (foundKey && obj[foundKey] !== undefined && obj[foundKey] !== null) return String(obj[foundKey]);
        }
        return '';
    },

    parseNFeStatus(xmlOrJson: string) {
        try {
            // Tenta JSON primeiro
            if (xmlOrJson.trim().startsWith('{')) {
                const data = JSON.parse(xmlOrJson);
                // Mapeamento baseado na documentação: cod_processo, dsc_processo, nfe_chave
                // Mapeamento baseado na documentação e testes
                const cStat = this.getJsonValue(data, ["cod_processo", "cStat", "status_sefaz", "status", "cod_status", "Situation"]);
                const xMotivo = this.getJsonValue(data, ["dsc_processo", "xMotivo", "motivo_sefaz", "motivo", "dsc_status", "mensagem", "Description"]);
                const chNFe = this.getJsonValue(data, ["nfe_chave", "chNFe", "chave", "chave_acesso", "NfeKey"]);
                const nProt = this.getJsonValue(data, ["nProt", "protocolo", "num_protocolo"]);

                let status: 'AUTHORIZED' | 'CANCELED' | 'ERROR' | 'PENDING' = 'PENDING';

                // Mapeia strings ou números
                const s = String(cStat).trim().toLowerCase();
                const isAuthorized = s === '100' || s === '150' || s === 'authorized' || s === 'autorizada' || s === 'success';

                if (isAuthorized) status = 'AUTHORIZED';
                else if (['101', '135', '155', 'canceled', 'cancelada'].includes(s)) status = 'CANCELED';
                else if (s && parseInt(s) > 100 && !isAuthorized) status = 'ERROR';
                else if (s && parseInt(s) < 100) status = 'PENDING';

                return { cStat: String(cStat), xMotivo, chNFe, nProt, status, raw: data };
            }

            // Fallback XML
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlOrJson, "text/xml");

            const cStat = this.getTagValue(xmlDoc, "cStat") || this.getTagValue(xmlDoc, "cod_processo") || this.getTagValue(xmlDoc, "status");
            const xMotivo = this.getTagValue(xmlDoc, "xMotivo") || this.getTagValue(xmlDoc, "dsc_processo") || this.getTagValue(xmlDoc, "motivo");
            const chNFe = this.getTagValue(xmlDoc, "chNFe") || this.getTagValue(xmlDoc, "nfe_chave");
            const nProt = this.getTagValue(xmlDoc, "nProt");

            let status: 'AUTHORIZED' | 'CANCELED' | 'ERROR' | 'PENDING' = 'PENDING';

            const s = String(cStat).trim().toLowerCase();
            const isAuthorized = s === '100' || s === '150' || s === 'authorized' || s === 'autorizada';

            if (isAuthorized) status = 'AUTHORIZED';
            else if (['101', '135', '155', 'canceled', 'cancelada'].includes(s)) status = 'CANCELED';
            else if (s && parseInt(s) > 100 && !isAuthorized) status = 'ERROR';
            else if (s && parseInt(s) < 100) status = 'PENDING';


            return { cStat: String(cStat), xMotivo, chNFe, nProt, status, raw: xmlOrJson };
        } catch (e) {
            console.error("Erro ao processar resposta da NFe:", e);
            return null;
        }
    },

    async listNFe(page: number = 1, limit: number = 20, status: string = '', numero: string = '', pedido: string = '') {
        const authHeader = 'Basic ' + btoa(`${this.config.cnpj}:${this.config.apiKey}`);

        let url = `/api/nfemail/NotasFiscais?page=${page}&limit=${limit}`;
        if (status) url += `&status=${status}`;
        if (numero) url += `&numero=${numero}`;
        if (pedido) url += `&pedido=${pedido}`;

        const apiUrl = url;
        console.log(`🔌 Chamando API (Proxy): ${apiUrl}`);

        const response = await fetch(apiUrl, {
            headers: { "Authorization": authHeader }
        });

        if (!response.ok) {
            throw new Error(`Erro ao listar notas (${response.status})`);
        }

        return await response.text(); // A API retorna XML que precisará ser processado
    },

    parseNFeList(xmlOrJson: string) {
        try {
            // Tenta JSON primeiro
            if (xmlOrJson.trim().startsWith('{') || xmlOrJson.trim().startsWith('[')) {
                const data = JSON.parse(xmlOrJson);

                // Mapeamento exato da documentação: ListaNotaFiscal
                let list = data.ListaNotaFiscal || data.Notas || data.NotasFiscais || data.items || data.data || data.List;

                if (!list || !Array.isArray(list)) {
                    list = Array.isArray(data) ? data : (Object.values(data).find(v => Array.isArray(v)) || []);
                }

                return list.map((node: any) => ({
                    id: this.getJsonValue(node, ["cod_nfemail", "Id", "id"]),
                    number: this.getJsonValue(node, ["nfe_numero", "Numero", "numero", "nNF"]),
                    series: this.getJsonValue(node, ["Serie", "serie", "serie_nfe"]), // Geralmente vem no XML mas não no exemplo JSON
                    key: this.getJsonValue(node, ["nfe_chave", "Chave", "chave", "chNFe"]),
                    status: this.getJsonValue(node, ["cod_processo", "Status", "status"]),
                    reason: this.getJsonValue(node, ["dsc_processo", "xMotivo"]),
                    customerName: this.getJsonValue(node, ["nom_razaosocial", "DestinatarioNome", "destinatario_nome", "xNome"]),
                    date: this.getJsonValue(node, ["DataEmissao", "data_emissao", "dhEmi"]),
                    total: this.getJsonValue(node, ["ValorTotal", "valor_total", "vNF"]),
                }));
            }

            // Fallback XML
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlOrJson, "text/xml");

            // Busca o container de cada nota conforme docs
            const notesNodes = Array.from(xmlDoc.querySelectorAll('*')).filter(node =>
                ['notafiscal', 'nota_fiscal', 'lista_nota_fiscal'].includes(node.tagName.toLowerCase())
            );

            const notes = [];

            for (let i = 0; i < notesNodes.length; i++) {
                const node = notesNodes[i];
                notes.push({
                    id: this.getTagValue(node, "cod_nfemail") || this.getTagValue(node, "Id"),
                    number: this.getTagValue(node, "nfe_numero") || this.getTagValue(node, "Numero"),
                    series: this.getTagValue(node, "Serie") || this.getTagValue(node, "serie"),
                    key: this.getTagValue(node, "nfe_chave") || this.getTagValue(node, "Chave"),
                    status: this.getTagValue(node, "cod_processo") || this.getTagValue(node, "Status"),
                    customerName: this.getTagValue(node, "nom_razaosocial") || this.getTagValue(node, "DestinatarioNome"),
                    date: this.getTagValue(node, "DataEmissao") || this.getTagValue(node, "data_emissao"),
                    total: this.getTagValue(node, "ValorTotal") || this.getTagValue(node, "valor_total"),
                });
            }
            return notes;
        } catch (e) {
            console.error("Erro ao processar lista de notas:", e);
            return [];
        }
    },

    parseNFeReceivedList(jsonStr: string) {
        try {
            const data = JSON.parse(jsonStr);
            console.log("🔍 NFEmail API Parser Data:", data);
            
            // Suporta múltiplas variações de raiz e lista:
            // 1. NFRecebidas.ListaRecebida.NFRecebida[] (Manual)
            // 2. ListaRecebida[] (Algumas rotas de reprocessamento)
            // 3. NFRecebida[]
            const dataRoot = data?.NFRecebidas || data?.NFeRecebidas || data?.NotasFiscais || data;
            
            let list = null;
            if (Array.isArray(dataRoot?.ListaRecebida)) {
                list = dataRoot.ListaRecebida;
            } else if (Array.isArray(dataRoot?.ListaRecebida?.NFRecebida)) {
                list = dataRoot.ListaRecebida.NFRecebida;
            } else if (Array.isArray(dataRoot?.NFRecebida)) {
                list = dataRoot.NFRecebida;
            } else if (Array.isArray(dataRoot)) {
                list = dataRoot;
            }
            
            if (!list || !Array.isArray(list)) {
                console.warn(`⚠️ Lista não encontrada no JSON:`, data);
                return [];
            }

            return list.map((node: any) => ({
                id: node.cod_nfemail,
                number: node.nfe_chave ? node.nfe_chave.substring(25, 34).replace(/^0+/, '') : '--',
                series: node.nfe_chave ? node.nfe_chave.substring(22, 25).replace(/^0+/, '') : '--',
                key: node.nfe_chave,
                status: node.dat_cancelamento ? 'CANCELADA' : 'AUTORIZADA',
                customerName: node.nom_fantasia || node.nom_razaosocial || 'Fornecedor Desconhecido',
                date: node.dat_emissao,
                total: '0.00', // Este endpoint não traz o valor total diretamente
                cnpj: node.num_cnpj
            }));
        } catch (e) {
            console.error("Erro ao processar lista de notas recebidas:", e);
            return [];
        }
    },

    async downloadDANFe(key: string) {
        const authHeader = 'Basic ' + btoa(`${this.config.cnpj}:${this.config.apiKey}`);
        // Usamos a Serverless Function /api/download para evitar CORS e problemas de redirect
        const proxyUrl = `/api/download?endpoint=/DANFe?chave=${key}`;

        const response = await fetch(proxyUrl, {
            headers: { "Authorization": authHeader }
        });

        if (!response.ok) {
            throw new Error(`Erro ao baixar DANFe: ${response.status}`);
        }

        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `DANFe_${key}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(downloadUrl);
    },

    async downloadXML(key: string) {
        const authHeader = 'Basic ' + btoa(`${this.config.cnpj}:${this.config.apiKey}`);
        // Usamos a Serverless Function /api/download
        const proxyUrl = `/api/download?endpoint=/Xml?chave=${key}`;

        const response = await fetch(proxyUrl, {
            headers: { "Authorization": authHeader }
        });

        if (!response.ok) {
            throw new Error(`Erro ao baixar XML: ${response.status}`);
        }

        const text = await response.text();
        const blob = new Blob([text], { type: 'text/xml' });
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `${key}.xml`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(downloadUrl);
    },

    getDANFEUrl(key: string, id?: string) {
        // Se tivermos o ID interno (nfeId), usamos ele pois é mais garantido no integrador
        if (id) return `https://integrador.nfemail.com.br/Danfe/Visualizar/${id}`;
        // Fallback para link via chave usando parâmetro query (mais compatível que path para chaves)
        return `https://integrador.nfemail.com.br/Nfe/VisualizarDanfe?chave=${key}`;
    },

    getXMLUrl(key: string, id?: string) {
        if (id) return `https://integrador.nfemail.com.br/Xml/Download/${id}`;
        return `https://integrador.nfemail.com.br/Xml/Download/${key}`;
    },

    async cancelNFe(key: string, reason: string) {
        if (!this.config.cnpj || !this.config.apiKey) {
            throw new Error("Credenciais do NFEmail não configuradas.");
        }
        if (reason.length < 15) {
            throw new Error("A justificativa de cancelamento deve ter pelo menos 15 caracteres.");
        }

        const authHeader = 'Basic ' + btoa(`${this.config.cnpj}:${this.config.apiKey}`);
        const apiUrl = '/api/nfemail/NotasFiscais/Cancelar';

        const payload = {
            nfe_chave: key,
            dsc_motivo: reason
        };

        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": authHeader
            },
            body: JSON.stringify(payload)
        });

        const responseText = await response.text();
        if (!response.ok) {
            throw new Error(`Erro ao cancelar nota (${response.status}): ${responseText}`);
        }
        return responseText;
    },

    async sendCCe(key: string, correction: string, seq: number = 1) {
        if (!this.config.cnpj || !this.config.apiKey) {
            throw new Error("Credenciais do NFEmail não configuradas.");
        }
        if (correction.length < 15) {
            throw new Error("O texto da correção deve ter pelo menos 15 caracteres.");
        }

        const authHeader = 'Basic ' + btoa(`${this.config.cnpj}:${this.config.apiKey}`);
        const apiUrl = '/api/nfemail/NotasFiscais/CCe';

        const payload = {
            nfe_chave: key,
            xCorrecao: correction,
            nSeqEvento: seq
        };

        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": authHeader
            },
            body: JSON.stringify(payload)
        });

        const responseText = await response.text();
        if (!response.ok) {
            throw new Error(`Erro ao enviar CC-e (${response.status}): ${responseText}`);
        }
        return responseText;
    },

    async listReceivedNFe(limit: number = 30, startDate?: string, endDate?: string) {
        const authHeader = 'Basic ' + btoa(`${this.config.cnpj}:${this.config.apiKey}`);
        
        // Se houver datas, usa o endpoint NotasFiscais (conforme exemplos C#/PHP). 
        // Caso contrário, usa NFeRecebidas para apenas as novas.
        let apiUrl = `/api/nfemail/NFeRecebidas?limit=${limit}`;
        
        if (startDate && endDate) {
            apiUrl = `/api/nfemail/NFeRecebidas?dataInicial=${startDate}&dataFinal=${endDate}&limit=${limit}`;
        }

        console.log(`🌐 Chamando API NFEmail: ${apiUrl}`);

        const response = await fetch(apiUrl, {
            headers: { "Authorization": authHeader }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.warn(`⚠️ NFEmail API Response (${response.status}):`, errorText, response.statusText);
            
            // Verificação robusta: status 400 e qualquer menção a não encontrado no corpo ou no texto do status
            const isNotFoundError = (response.status === 400 || response.status === 404) && 
                                   (errorText.toUpperCase().includes("NAO ENCONTRADOS") || 
                                    response.statusText.toUpperCase().includes("NAO ENCONTRADOS") ||
                                    errorText.toUpperCase().includes("NOT FOUND"));

            if (isNotFoundError) {
                console.log("ℹ️ Nenhuma nota nova encontrada no NFEmail (400 Not Found).");
                return JSON.stringify({ "NFRecebidas": { "ListaRecebida": { "NFRecebida": [] } } });
            }
            throw new Error(`Erro ao listar notas recebidas (${response.status}): ${errorText || response.statusText}`);
        }

        return await response.text();
    },

    async getReceivedXML(key: string) {
        const authHeader = 'Basic ' + btoa(`${this.config.cnpj}:${this.config.apiKey}`);
        // Endpoint conforme manual: api/ArquivoXML?chave={chave}
        const apiUrl = `/api/nfemail/ArquivoXML?chave=${key}`;

        const response = await fetch(apiUrl, {
            headers: { "Authorization": authHeader }
        });

        if (!response.ok) {
            throw new Error(`Erro ao baixar XML de entrada (${response.status})`);
        }

        return await response.text();
    },

    async manifestNFe(key: string, type: string = 'Ciencia') {
        const authHeader = 'Basic ' + btoa(`${this.config.cnpj}:${this.config.apiKey}`);
        const apiUrl = `/api/nfemail/NotasFiscais/Recebidas/Manifestar`;

        const payload = {
            nfe_chave: key,
            tipo_manifesto: type // Ciencia, Confirmacao, Desconhecimento, NaoRealizada
        };

        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": authHeader
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Erro ao manifestar nota (${response.status}): ${errorText}`);
        }

        return await response.text();
    }
};
