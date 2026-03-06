const XLSX = require('xlsx');

const headers = [
    "type", "document", "name", "tradeName", "email", "phone", "phone2",
    "cep", "street", "number", "complement", "neighborhood", "city", "state",
    "contactName", "contactPhone", "contactEmail", "legacyId", "legacyHistory"
];

const exampleRow1 = [
    "CPF", "12345678909", "João da Silva", "", "joao@email.com", "11999999999", "",
    "01000000", "Rua Exemplo", "123", "Apto 10", "Centro", "São Paulo", "SP",
    "", "", "", 1010, "Pedido em 2024..."
];

const exampleRow2 = [
    "CNPJ", "12345678000199", "Empresa XYZ Ltda", "Loja XYZ", "contato@empresa.com", "1133333333", "",
    "02000000", "Avenida Brasil", "1000", "", "Jardins", "São Paulo", "SP",
    "Maria", "11988888888", "maria@empresa.com", 2020, "Vários pedidos em 2023..."
];

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow1, exampleRow2]);

XLSX.utils.book_append_sheet(wb, ws, "Clientes");
XLSX.writeFile(wb, "modelo_importacao_clientes.xlsx");
console.log("Template criado em modelo_importacao_clientes.xlsx");
