const EVOLUTION_URL = "https://evolution-api-production-8ad2.up.railway.app";
const EVOLUTION_API_KEY = "101f540987bec16185e6923c03db2652afc9e1fc968faba25b976f30a8d8f0aa";
const INSTANCE_NAME = "welelington";
const DIRECTOR_PHONE = "5521964592050";

const message = `Olá Diretor, tudo bem? Aqui é o seu *Gerente IA* trazendo um panorama executivo de *Maio/2026* até o momento! 📊🚀

Neste mês, estamos com um ótimo funil de oportunidades:
✅ *Visitas Realizadas:* 25
⏳ *Orçamentos em Aberto:* 39 propostas, que juntas somam *R$ 210.151,03* em potenciais novos negócios.
💰 *Vendas Fechadas:* 13 pedidos já confirmados, totalizando *R$ 96.399,00* em faturamento!

Temos um volume altíssimo de propostas na mesa (mais de R$ 200k), o que significa que nossa taxa de conversão pode trazer resultados expressivos nos próximos dias. Seguimos monitorando e apoiando a equipe comercial para acelerar esses fechamentos!

Qualquer dúvida ou se precisar de uma análise mais detalhada, estou à disposição. 🤖📈
- *Seu Gerente IA*`;

async function run() {
    try {
        console.log("Mensagem gerada:\n================\n" + message + "\n================\n");
        console.log("Enviando via Evolution API...");

        const response = await fetch(`${EVOLUTION_URL}/message/sendText/${INSTANCE_NAME}`, {
            method: 'POST',
            headers: {
                'apikey': EVOLUTION_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                number: DIRECTOR_PHONE,
                text: message
            })
        });

        const resData = await response.json();
        if (response.ok) {
            console.log("Mensagem enviada com sucesso ao Diretor!");
            console.log(resData);
        } else {
            console.error("Erro ao enviar mensagem:", resData);
        }

    } catch (err) {
        console.error("Erro no script:", err);
    }
}

run();
