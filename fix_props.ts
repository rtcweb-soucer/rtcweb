import * as fs from 'fs';

// Update IAManager.tsx
const file1 = 'C:/Users/SAMSUNG/Downloads/rtc---toldos-&-cortinas/rtcweb/pages/IAManager.tsx';
let code1 = fs.readFileSync(file1, 'utf8');

code1 = code1.replace(
  "import { Order, OrderStatus, Seller, Customer, SystemUser, Appointment, SalesGoal } from '../types';",
  "import { Order, OrderStatus, Seller, Customer, SystemUser, Appointment, SalesGoal, Product, TechnicalSheet } from '../types';"
);

code1 = code1.replace(
  '  currentUser: SystemUser;\r\n}',
  '  currentUser: SystemUser;\n  products: Product[];\n  technicalSheets: TechnicalSheet[];\n}'
);

code1 = code1.replace(
  '  currentUser: SystemUser;\n}',
  '  currentUser: SystemUser;\n  products: Product[];\n  technicalSheets: TechnicalSheet[];\n}'
);

code1 = code1.replace(
  'const IAManager = ({ orders, sellers, customers, appointments, currentUser }: IAManagerProps) => {',
  'const IAManager = ({ orders, sellers, customers, appointments, currentUser, products, technicalSheets }: IAManagerProps) => {'
);

fs.writeFileSync(file1, code1);

// Update App.tsx
const file2 = 'C:/Users/SAMSUNG/Downloads/rtc---toldos-&-cortinas/rtcweb/App.tsx';
let code2 = fs.readFileSync(file2, 'utf8');

const searchApp = /<IAManager\s+orders=\{orders\}\s+sellers=\{sellers\}\s+customers=\{customers\}\s+appointments=\{appointments\}\s+currentUser=\{currentUser!\}\s+\/>/;

code2 = code2.replace(searchApp, `<IAManager 
            orders={orders} 
            sellers={sellers} 
            customers={customers} 
            appointments={appointments} 
            currentUser={currentUser!}
            products={products}
            technicalSheets={technicalSheets}
          />`);

fs.writeFileSync(file2, code2);
console.log('Done!');
