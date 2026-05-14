import { supabase } from './supabase';
import { Product, Customer, Seller, Appointment, Order, TechnicalSheet, SystemUser, ProductionTracking, Expense, ProductionInstallationSheet, SellerBlockedSlot, Installer, AccountCategory, FinancialTransaction, PurchaseRequest, PurchaseOrder, Task, TimeEntry, Rework, ApiSettings, RawMaterial, RawMaterialMovement, RawMaterialMapping } from '../types';

const SYNC_QUEUE_KEY = 'rtc_sync_queue';

const getSyncQueue = (): any[] => {
    try {
        const queue = localStorage.getItem(SYNC_QUEUE_KEY);
        return queue ? JSON.parse(queue) : [];
    } catch {
        return [];
    }
};

const saveSyncQueue = (queue: any[]) => {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
};

export const dataService = {
    // Sincronização
    async processSyncQueue() {
        const queue = getSyncQueue();
        if (queue.length === 0) return;

        console.log(`🔄 Sincronizando ${queue.length} item(s) pendente(s)...`);
        const remainingQueue: any[] = [];

        for (const item of queue) {
            try {
                if (item.type === 'order') {
                    await this.saveOrder(item.data, true); // true = force bypass queue
                } else if (item.type === 'production_sheet') {
                    await this.saveProductionInstallationSheet(item.data.sheet, item.data.productType, true);
                }
            } catch (err) {
                console.error('Falha ao sincronizar item, mantendo na fila:', err);
                remainingQueue.push(item);
            }
        }

        saveSyncQueue(remainingQueue);
        if (remainingQueue.length === 0) {
            console.log('✅ Sincronização concluída com sucesso!');
        }
    },

    addToSyncQueue(type: string, data: any) {
        const queue = getSyncQueue();
        queue.push({ type, data, timestamp: Date.now() });
        saveSyncQueue(queue);
        console.warn(`📦 Item salvo na fila de sincronização offline (${type})`);
    },


    // Products
    async getProducts() {
        try {
            const { data, error } = await supabase.from('products').select('*');
            if (error) throw error;
            localStorage.setItem('rtc_cache_products', JSON.stringify(data));
            return (data || []).map(p => ({
                ...p,
                priceFormula: p.price_formula
            })) as Product[];
        } catch (error) {
            console.error('Offline Mode: Usando cache de produtos local');
            const cached = localStorage.getItem('rtc_cache_products');
            if (cached) return JSON.parse(cached) as Product[];
            throw error;
        }
    },
    async saveProduct(product: Product) {
        const payload = {
            ...product,
            price_formula: product.priceFormula
        };
        // Remove camelCase version to avoid errors with Supabase
        delete (payload as any).priceFormula;

        const { data, error } = await supabase.from('products').upsert(payload).select().single();
        if (error) throw error;
        return data as Product;
    },
    async deleteProduct(id: string) {
        const { error } = await supabase.from('products').delete().eq('id', id);
        if (error) throw error;
    },

    async deleteSystemUser(id: string) {
        const { error } = await supabase.from('system_users').delete().eq('id', id);
        if (error) throw error;
    },

    // Quick Quotes
    async getQuickQuotes() {
        const { data, error } = await supabase
            .from('quick_quotes')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(q => ({
            ...q,
            customerId: q.customer_id,
            customerName: q.customer_name,
            customerPhone: q.customer_phone,
            sellerId: q.seller_id,
            totalValue: q.total_value,
            quickQuoteNumber: q.quick_quote_number,
            createdAt: q.created_at
        })) as QuickQuote[];
    },

    async saveQuickQuote(quote: QuickQuote) {
        const isUUID = (uuid: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);

        const payload: any = {
            customer_id: (quote.customerId && isUUID(quote.customerId)) ? quote.customerId : null,
            customer_name: quote.customerName || 'Consumidor Final',
            customer_phone: quote.customerPhone || null,
            seller_id: (quote.sellerId && isUUID(quote.sellerId)) ? quote.sellerId : null,
            items: quote.items,
            total_value: quote.totalValue,
            installments: quote.installments,
            notes: quote.notes || null
        };

        if (quote.id) payload.id = quote.id;

        const { data, error } = await supabase
            .from('quick_quotes')
            .upsert(payload)
            .select()
            .single();
        
        if (error) {
            console.error("Supabase Save Quick Quote Error:", error);
            throw error;
        }
        return {
            ...data,
            customerId: data.customer_id,
            customerName: data.customer_name,
            customerPhone: data.customer_phone,
            sellerId: data.seller_id,
            totalValue: data.total_value,
            quickQuoteNumber: data.quick_quote_number,
            createdAt: data.created_at
        } as QuickQuote;
    },

    async deleteQuickQuote(id: string) {
        const { error } = await supabase.from('quick_quotes').delete().eq('id', id);
        if (error) throw error;
    },

    // Customers
    async getCustomers() {
        try {
            let allData: any[] = [];
            let from = 0;
            let to = 999;
            let hasMore = true;

            while (hasMore) {
                const { data, error } = await supabase.from('customers').select('*').range(from, to);
                if (error) throw error;
                if (!data || data.length === 0) {
                    hasMore = false;
                } else {
                    allData = [...allData, ...data];
                    if (data.length < 1000) hasMore = false;
                    from += 1000;
                    to += 1000;
                }
            }

            const normalized = allData.map(c => ({
                ...c,
                document: c.document || '', // Map database document to Customer document property
                tradeName: c.trade_name,
                contactName: c.contact_name,
                contactPhone: c.contact_phone,
                contactEmail: c.contact_email,
                legacyId: c.legacy_id,
                legacyHistory: c.legacy_history,
                createdAt: c.created_at,
            })) as Customer[];

            localStorage.setItem('rtc_cache_customers', JSON.stringify(normalized));
            return normalized;
        } catch (error) {
            console.error('Offline Mode: Usando cache de clientes local');
            const cached = localStorage.getItem('rtc_cache_customers');
            if (cached) return JSON.parse(cached) as Customer[];
            throw error;
        }
    },
    async saveCustomer(customer: Customer) {
        try {
            const payload: any = {
                id: customer.id,
                type: customer.type,
                document: customer.document, // Correct column name for the document
                name: customer.name,
                email: customer.email,
                phone: customer.phone,
                phone2: customer.phone2,
                address: customer.address,
                trade_name: customer.tradeName,
                contact_name: customer.contactName,
                contact_phone: customer.contactPhone,
                contact_email: customer.contactEmail,
                legacy_id: customer.legacyId,
                legacy_history: customer.legacyHistory,
                created_by: customer.createdBy || null,
            };

            console.log("Saving customer payload:", payload);
            const { data, error } = await supabase.from('customers').upsert(payload).select().single();

            if (error) {
                console.error("Supabase error saving customer:", error);
                throw new Error(error.message || "Unknown error saving customer");
            }

            return {
                ...data,
                document: data.document,
                tradeName: data.trade_name,
                contactName: data.contact_name,
                contactPhone: data.contact_phone,
                contactEmail: data.contact_email,
                legacyId: data.legacy_id,
                legacyHistory: data.legacy_history,
                createdAt: data.created_at,
                createdBy: data.created_by,
            } as Customer;
        } catch (err: any) {
            console.error("DataService Exception:", err);
            throw err;
        }
    },

    // Sellers
    async getSellers() {
        try {
            const { data, error } = await supabase.from('sellers').select('*');
            if (error) throw error;
            localStorage.setItem('rtc_cache_sellers', JSON.stringify(data));
            return data as Seller[];
        } catch (error) {
            console.error('Offline Mode: Usando cache de vendedores local');
            const cached = localStorage.getItem('rtc_cache_sellers');
            if (cached) return JSON.parse(cached) as Seller[];
            throw error;
        }
    },
    async saveSeller(seller: Seller) {
        const { data, error } = await supabase.from('sellers').upsert(seller).select().single();
        if (error) throw error;
        return data as Seller;
    },
    // Installers
    async getInstallers() {
        const { data, error } = await supabase.from('installers').select('*');
        if (error) throw error;
        return (data || []).map(i => ({
            ...i,
            dailyRate: Number(i.daily_rate),
            hourlyRate: Number(i.hourly_rate || 0),
            login: i.login,
            password: i.password,
        })) as Installer[];
    },
    async saveInstaller(installer: Installer) {
        const payload = {
            id: installer.id,
            name: installer.name,
            phone: installer.phone,
            daily_rate: installer.dailyRate,
            hourly_rate: installer.hourlyRate,
            active: installer.active,
            login: installer.login,
            password: installer.password,
        };

        const { data, error } = await supabase.from('installers').upsert(payload).select().single();
        if (error) {
            console.error('Error saving installer:', error);
            throw error;
        }

        return {
            ...data,
            dailyRate: Number(data.daily_rate),
            hourlyRate: Number(data.hourly_rate || 0),
            login: data.login,
            password: data.password
        } as Installer;
    },
    async deleteInstaller(id: string) {
        const { error } = await supabase.from('installers').delete().eq('id', id);
        if (error) throw error;
    },

    // System Users
    async getSystemUsers() {
        const { data, error } = await supabase.from('system_users').select('*');
        if (error) throw error;
        return (data || []).map(u => ({
            ...u,
            sellerId: u.seller_id,
        })) as SystemUser[];
    },
    async saveSystemUser(user: SystemUser) {
        const payload = {
            ...user,
            seller_id: user.sellerId,
        };
        // @ts-ignore
        delete payload.sellerId;
        const { data, error } = await supabase.from('system_users').upsert(payload).select().single();
        if (error) throw error;
        return { ...data, sellerId: data.seller_id } as SystemUser;
    },

    // Technical Sheets
    async getTechnicalSheets() {
        const { data, error } = await supabase.from('technical_sheets').select(`
      *,
      items:measurement_items(*)
    `);
        if (error) throw error;
        return (data || []).map(sheet => ({
            ...sheet,
            customerId: sheet.customer_id,
            sellerId: sheet.seller_id,
            items: (sheet.items || []).map((i: any) => ({
                ...i,
                productId: i.product_id,
                parentItemId: i.parent_item_id,
                productType: i.product_type,
                command: i.command, // Read command
                quantity: i.quantity || 1
            })),
            createdAt: new Date(sheet.created_at)
        })) as TechnicalSheet[];
    },
    async saveTechnicalSheet(sheet: TechnicalSheet) {
        const { items, ...sheetData } = sheet;
        const payload = {
            id: sheetData.id,
            customer_id: sheetData.customerId,
            seller_id: sheetData.sellerId,
            // created_at is handled by DB default
        };

        const { data, error } = await supabase.from('technical_sheets').upsert(payload).select().single();
        if (error) throw error;

        if (items && items.length > 0) {
            const itemsToSave = items.map(item => ({
                id: item.id,
                technical_sheet_id: data.id,
                product_id: item.productId,
                parent_item_id: item.parentItemId,
                width: item.width,
                height: item.height,
                environment: item.environment,
                product_type: item.productType,
                color: item.color,
                command: item.command, // Save command
                notes: item.notes,
                quantity: item.quantity || 1 // Default to 1 if missing
            }));
            const { error: itemsError } = await supabase.from('measurement_items').upsert(itemsToSave);
            if (itemsError) throw itemsError;
        }

        return {
            ...data,
            customerId: data.customer_id,
            sellerId: data.seller_id,
            items: items,
            createdAt: new Date(data.created_at)
        } as TechnicalSheet;
    },

    async deleteTechnicalSheet(id: string) {
        // Primeiro removemos os itens relacionados para evitar erros de integridade (se não houver cascade)
        await supabase.from('measurement_items').delete().eq('technical_sheet_id', id);
        const { error } = await supabase.from('technical_sheets').delete().eq('id', id);
        if (error) throw error;
    },

    async removeMeasurementItem(id: string) {
        const { error } = await supabase.from('measurement_items').delete().eq('id', id);
        if (error) throw error;
    },

    // Appointments
    async getAppointments() {
        const { data, error } = await supabase.from('appointments').select(`
            *,
            installers:appointment_installers(installer_id)
        `);
        if (error) throw error;
        return (data || []).map(a => ({
            ...a,
            customerId: a.customer_id,
            orderId: a.order_id,
            sellerId: a.seller_id,
            technicianName: a.technician_name,
            notes: a.notes,
            installerIds: (a.installers || []).map((i: any) => i.installer_id),
            createdAt: new Date(a.created_at)
        })) as unknown as Appointment[];
    },
    async saveAppointment(appointment: Appointment) {
        const { installerIds, ...rest } = appointment;
        const payload = {
            id: rest.id,
            customer_id: rest.customerId,
            order_id: rest.orderId,
            seller_id: rest.sellerId,
            technician_name: rest.technicianName,
            date: rest.date,
            time: rest.time,
            type: rest.type,
            status: rest.status,
            notes: rest.notes,
        };
        const { data, error } = await supabase.from('appointments').upsert(payload).select().single();
        if (error) throw error;

        // Atualiza instaladores vinculados
        if (installerIds) {
            // Remove anteriores
            await supabase.from('appointment_installers').delete().eq('appointment_id', data.id);

            if (installerIds.length > 0) {
                const relations = installerIds.map(installerId => ({
                    appointment_id: data.id,
                    installer_id: installerId
                }));
                const { error: relError } = await supabase.from('appointment_installers').insert(relations);
                if (relError) throw relError;
            }
        }

        return {
            ...data,
            customerId: data.customer_id,
            orderId: data.order_id,
            sellerId: data.seller_id,
            technicianName: data.technician_name,
            notes: data.notes,
            installerIds: installerIds || [],
            createdAt: new Date(data.created_at)
        } as unknown as Appointment;
    },

    // Orders
    async getOrders() {
        // Fetch only non-deleted orders
        const { data: ordersData, error: ordersError } = await supabase
            .from('orders')
            .select('*')
            .eq('is_deleted', false);
        if (ordersError) throw ordersError;

        // Fetch all production tracking info to enrichment
        const { data: trackingData, error: trackingError } = await supabase.from('production_tracking').select('*');
        if (trackingError) throw trackingError;

        return (ordersData || []).map(o => {
            const tracking = trackingData?.find(t => t.order_id === o.id);
            return {
                ...o,
                customerId: o.customer_id,
                technicalSheetId: o.technical_sheet_id,
                sellerId: o.seller_id,
                itemIds: o.item_ids,
                totalValue: o.total_value || 0,
                paymentMethod: o.payment_method,
                paymentConditions: o.payment_conditions,
                installationDate: o.installation_date,
                installationTime: o.installation_time,
                productionStage: tracking?.stage || o.production_stage,
                productionHistory: tracking?.history || o.production_history,
                itemPrices: o.item_prices || {},
                deliveryDays: o.delivery_days,
                deliveryDeadline: o.delivery_deadline,
                contractObservations: o.contract_observations,
                itemsSnapshot: o.items_snapshot,
                nfeNumber: o.nfe_number,
                nfeSeries: o.nfe_series,
                nfeKey: o.nfe_key,
                nfeStatus: o.nfe_status,
                quoteNumber: o.quote_number,
                contractNumber: o.contract_number,
                isAnticipated: o.is_anticipated,
                anticipationRate: o.anticipation_rate,
                paymentLink: o.payment_link,
                createdAt: new Date(o.created_at)
            };
        }) as unknown as Order[];
    },
    async saveOrder(order: Order, force = false) {
        const payload = {
            id: order.id,
            customer_id: order.customerId,
            technical_sheet_id: order.technicalSheetId || null,
            seller_id: order.sellerId,
            item_ids: order.itemIds,
            status: order.status,
            total_value: order.totalValue,
            payment_method: order.paymentMethod,
            payment_conditions: order.paymentConditions,
            installments: order.installments,
            installation_date: order.installationDate,
            installation_time: order.installationTime,
            technician: order.technician,
            item_prices: order.itemPrices,
            delivery_days: order.deliveryDays,
            delivery_deadline: order.deliveryDeadline,
            contract_observations: order.contractObservations,
            items_snapshot: order.itemsSnapshot,
            nfe_number: order.nfeNumber,
            nfe_series: order.nfeSeries,
            nfe_key: order.nfeKey,
            nfe_status: order.nfeStatus,
            quote_number: order.quoteNumber,
            contract_number: order.contractNumber,
            is_anticipated: order.isAnticipated,
            anticipation_rate: order.anticipationRate,
            payment_link: order.paymentLink,
            card_installments: order.cardInstallments,
            created_at: order.createdAt instanceof Date ? order.createdAt.toISOString() : order.createdAt,
        };
        console.log('💾 Saving order payload:', payload);

        try {
            let { data, error } = await supabase.from('orders').upsert(payload).select().single();

            if (error && error.message?.includes('item_prices')) {
                console.warn('⚠️ Coluna item_prices não encontrada. Tentando salvar sem preços customizados.');
                const { item_prices, ...payloadWithoutPrices } = payload;
                const retry = await supabase.from('orders').upsert(payloadWithoutPrices).select().single();
                data = retry.data;
                error = retry.error;
            }

            if (error) throw error;

            return {
                ...order,
                ...data,
                customerId: data.customer_id,
                technicalSheetId: data.technical_sheet_id,
                sellerId: data.seller_id,
                itemIds: data.item_ids,
                totalValue: data.total_value || 0,
                paymentMethod: data.payment_method,
                paymentConditions: data.payment_conditions,
                installationDate: data.installation_date,
                installationTime: data.installation_time,
                productionStage: data.production_stage || order.productionStage,
                productionHistory: data.production_history || order.productionHistory,
                itemPrices: data.item_prices || {},
                contractObservations: data.contract_observations,
                itemsSnapshot: data.items_snapshot,
                nfeNumber: data.nfe_number,
                nfeSeries: data.nfe_series,
                nfeKey: data.nfe_key,
                nfeStatus: data.nfe_status,
                quoteNumber: data.quote_number,
                contractNumber: data.contract_number,
                isAnticipated: data.is_anticipated,
                anticipationRate: data.anticipation_rate,
                paymentLink: data.payment_link,
                createdAt: new Date(data.created_at)
            } as unknown as Order;
        } catch (error) {
            if (!force) {
                this.addToSyncQueue('order', order);
                return { ...order, status: 'PENDING_SYNC' as any };
            }
            throw error;
        }
    },

    // PCP (Production Tracking)
    async getPCPOrders() {
        // Fetch all tracking info
        const { data: trackingData, error: trackingError } = await supabase.from('production_tracking').select('*');
        if (trackingError) throw trackingError;

        // Fetch orders that are in tracking and NOT deleted
        const orderIds = trackingData.map(t => t.order_id);
        const { data: ordersData, error: ordersError } = await supabase
            .from('orders')
            .select('*')
            .in('id', orderIds)
            .eq('is_deleted', false);
        if (ordersError) throw ordersError;

        // Merge data
        return ordersData.map(o => {
            const tracking = trackingData.find(t => t.order_id === o.id);
            return {
                ...o,
                customerId: o.customer_id,
                technicalSheetId: o.technical_sheet_id,
                sellerId: o.seller_id,
                itemIds: o.item_ids,
                totalValue: o.total_value || 0,
                deliveryDays: o.delivery_days,
                deliveryDeadline: o.delivery_deadline,
                createdAt: new Date(o.created_at),
                // Merge tracking info
                productionStage: tracking?.stage,
                productionHistory: tracking?.history
            } as Order;
        });
    },

    async initializeProduction(orderId: string, stage: string, history: any[]) {
        const { error } = await supabase.from('production_tracking').upsert({
            order_id: orderId,
            stage: stage,
            history: history,
            updated_at: new Date().toISOString()
        });
        if (error) {
            console.error('❌ Supabase error initializing production:', error);
            throw error;
        }
    },

    async updateProductionStage(orderId: string, stage: string, history: any[]) {
        const { error } = await supabase.from('production_tracking').update({
            stage: stage,
            history: history,
            updated_at: new Date().toISOString()
        }).eq('order_id', orderId);
        if (error) {
            console.error('❌ Supabase error updating production stage:', error);
            throw error;
        }
    },

    async getNextSequenceNumber(type: 'ORC' | 'CONTRATO'): Promise<string> {
        const currentYear = new Date().getFullYear();
        const column = type === 'ORC' ? 'quote_number' : 'contract_number';
        const prefix = type === 'ORC' ? 'ORC' : 'Contrato';

        // Buscar o último número gerado para este ano
        const { data, error } = await supabase
            .from('orders')
            .select(column)
            .ilike(column, `${prefix} ${currentYear}-%`)
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) {
            console.error(`Erro ao buscar sequência para ${type}:`, error);
            const startNumber = currentYear === 2026 ? 101 : 1;
            return `${prefix} ${currentYear}-${startNumber}`;
        }

        let maxNum = 0;
        if (data && data.length > 0) {
            data.forEach(row => {
                const val = (row as any)[column];
                if (val) {
                    const parts = val.split('-');
                    if (parts.length === 2) {
                        const num = parseInt(parts[1]);
                        if (!isNaN(num) && num > maxNum) {
                            maxNum = num;
                        }
                    }
                }
            });
        }

        if (maxNum === 0) {
            const startNumber = currentYear === 2026 ? 101 : 1;
            return `${prefix} ${currentYear}-${startNumber}`;
        }

        return `${prefix} ${currentYear}-${maxNum + 1}`;
    },

    async deleteOrder(id: string) {
        // Soft delete: mark as is_deleted = true
        const { error } = await supabase.from('orders').update({ is_deleted: true }).eq('id', id);
        if (error) throw error;
    },

    // Time Tracking
    async saveTimeEntry(entry: Partial<TimeEntry>) {
        const payload: any = {
            id: entry.id || crypto.randomUUID(),
            installer_id: entry.installerId,
            type: entry.type,
            timestamp: entry.timestamp || new Date().toISOString(),
            lat: entry.lat,
            lng: entry.lng,
            is_extra: entry.isExtra || false,
            location_name: entry.locationName
        };
        const { data, error } = await supabase.from('time_entries').insert(payload).select().single();
        if (error) throw error;
        return data as TimeEntry;
    },

    async getTimeEntries(installerId?: string) {
        let query = supabase.from('time_entries').select('*');
        if (installerId) query = query.eq('installer_id', installerId);
        const { data, error } = await query.order('timestamp', { ascending: false });
        if (error) throw error;
        return data.map(d => ({
            ...d,
            installerId: d.installer_id,
            isExtra: d.is_extra,
            locationName: d.location_name
        })) as TimeEntry[];
    },

    // Reworks
    async saveRework(rework: Partial<Rework>) {
        const payload = {
            order_id: rework.orderId,
            reason: rework.reason,
            description: rework.description,
            status: rework.status || 'PENDING',
            created_by: rework.createdBy
        };
        const { data, error } = await supabase.from('reworks').insert(payload).select().single();
        if (error) throw error;
        return data as Rework;
    },

    async getReworks(orderId?: string) {
        let query = supabase.from('reworks').select('*');
        if (orderId) query = query.eq('order_id', orderId);
        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        return data as Rework[];
    },

    async undeleteOrder(id: string) {
        // Restore soft-deleted order
        const { error } = await supabase.from('orders').update({ is_deleted: false }).eq('id', id);
        if (error) throw error;
    },

    // Expenses
    async getExpenses() {
        const { data, error } = await supabase.from('expenses').select('*');
        if (error) throw error;
        return (data || []).map(e => ({
            ...e,
            orderId: e.order_id,
            installmentId: e.installment_id,
        })) as Expense[];
    },
    async saveExpense(expense: Expense) {
        const payload = {
            ...expense,
            order_id: expense.orderId,
            installment_id: expense.installmentId,
        };
        // @ts-ignore
        delete payload.orderId;
        // @ts-ignore
        delete payload.installmentId;

        const { data, error } = await supabase.from('expenses').upsert(payload).select().single();
        if (error) throw error;
        return {
            ...data,
            orderId: data.order_id,
            installmentId: data.installment_id,
        } as Expense;
    },
    async deleteExpense(id: string) {
        const { error } = await supabase.from('expenses').delete().eq('id', id);
        if (error) throw error;
    },

    // Production and Installation Sheets
    async getProductionInstallationSheet(measurementItemId: string) {
        // Get main production sheet
        const { data, error } = await supabase
            .from('production_installation_sheets')
            .select('*')
            .eq('measurement_item_id', measurementItemId)
            .single();

        if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
        if (!data) return null;

        const baseSheet = {
            id: data.id,
            measurementItemId: data.measurement_item_id,
            videoLink: data.video_link,
            observacoesGerais: data.observacoes_gerais,
            createdAt: new Date(data.created_at),
            updatedAt: new Date(data.updated_at)
        };

        // Try to fetch specific data from each subtable
        const [cortinaData, toldoData, coberturaData] = await Promise.all([
            supabase.from('production_sheet_cortina').select('*').eq('production_sheet_id', data.id).single(),
            supabase.from('production_sheet_toldo').select('*').eq('production_sheet_id', data.id).single(),
            supabase.from('production_sheet_cobertura').select('*').eq('production_sheet_id', data.id).single()
        ]);

        // Add specific data if found
        if (cortinaData.data) {
            return {
                ...baseSheet,
                cortina: {
                    id: cortinaData.data.id,
                    productionSheetId: cortinaData.data.production_sheet_id,
                    comando: cortinaData.data.comando,
                    vao: cortinaData.data.vao,
                    varaoCor: cortinaData.data.varao_cor,
                    instalacao: cortinaData.data.instalacao,
                    trilho: cortinaData.data.trilho,
                    posicionamento: cortinaData.data.posicionamento,
                    createdAt: new Date(cortinaData.data.created_at),
                    updatedAt: new Date(cortinaData.data.updated_at)
                }
            };
        }

        if (toldoData.data) {
            return {
                ...baseSheet,
                toldo: {
                    id: toldoData.data.id,
                    productionSheetId: toldoData.data.production_sheet_id,
                    modelo: toldoData.data.modelo,
                    comando: toldoData.data.comando,
                    bambinela: toldoData.data.bambinela,
                    vies: toldoData.data.vies,
                    entreVao: toldoData.data.entre_vao,
                    corFerragem: toldoData.data.cor_ferragem,
                    bracos: toldoData.data.bracos,
                    medidasBraco: toldoData.data.medidas_braco,
                    fixacao: toldoData.data.fixacao,
                    medidaFixacao: toldoData.data.medida_fixacao,
                    trava: toldoData.data.trava,
                    manivelaQtd: toldoData.data.manivela_qtd,
                    medidaManivela: toldoData.data.medida_manivela,
                    parapeito: toldoData.data.parapeito,
                    larguraBeiral: toldoData.data.largura_beiral,
                    caida: toldoData.data.caida,
                    alturaInstalacao: toldoData.data.altura_instalacao,
                    instalacao: toldoData.data.instalacao,
                    corredica: toldoData.data.corredica,
                    posicionamento: toldoData.data.posicionamento,
                    obs: toldoData.data.obs,
                    createdAt: new Date(toldoData.data.created_at),
                    updatedAt: new Date(toldoData.data.updated_at)
                }
            };
        }

        if (coberturaData.data) {
            return {
                ...baseSheet,
                cobertura: {
                    id: coberturaData.data.id,
                    productionSheetId: coberturaData.data.production_sheet_id,
                    corFerragem: coberturaData.data.cor_ferragem,
                    alturaInstalacao: coberturaData.data.altura_instalacao,
                    caida: coberturaData.data.caida,
                    calhaSaida: coberturaData.data.calha_saida,
                    createdAt: new Date(coberturaData.data.created_at),
                    updatedAt: new Date(coberturaData.data.updated_at)
                }
            };
        }

        return baseSheet;
    },

    async saveProductionInstallationSheet(sheet: any, productType: string, force = false) {
        try {
            // Save main production sheet
            const mainPayload = {
                id: sheet.id,
                measurement_item_id: sheet.measurementItemId,
                video_link: sheet.videoLink,
                observacoes_gerais: sheet.observacoesGerais,
                updated_at: new Date().toISOString()
            };

            console.log('📝 Prepared main payload:', mainPayload);

            const { data: mainData, error: mainError } = await supabase
                .from('production_installation_sheets')
                .upsert(mainPayload)
                .select()
                .single();

            if (mainError) {
                console.error('❌ Error saving main production sheet:', mainError);
                throw new Error(`Erro na ficha principal: ${mainError.message}`);
            }

            console.log('✅ Main production sheet saved:', mainData);

            // Helper function to check if object has any actual data
            const hasData = (obj: any): boolean => {
                if (!obj) return false;
                const metadataKeys = ['id', 'productionSheetId', 'createdAt', 'updatedAt'];
                const actualData = Object.entries(obj).filter(([key, value]) =>
                    !metadataKeys.includes(key) &&
                    value !== undefined &&
                    value !== null &&
                    value !== ''
                );
                return actualData.length > 0;
            };

            // Save specific data based on product type
            if (productType === 'Cortina' && sheet.cortina && hasData(sheet.cortina)) {
                const cortinaPayload = {
                    id: sheet.cortina.id || crypto.randomUUID(),
                    production_sheet_id: mainData.id,
                    comando: sheet.cortina.comando,
                    vao: sheet.cortina.vao,
                    varao_cor: sheet.cortina.varaoCor,
                    instalacao: sheet.cortina.instalacao,
                    trilho: sheet.cortina.trilho,
                    posicionamento: sheet.cortina.posicionamento,
                    updated_at: new Date().toISOString()
                };

                const { error: cortinaError } = await supabase
                    .from('production_sheet_cortina')
                    .upsert(cortinaPayload);

                if (cortinaError) throw new Error(`Erro nos detalhes de Cortina: ${cortinaError.message}`);
            }

            if (productType === 'Toldo' && sheet.toldo && hasData(sheet.toldo)) {
                const toldoPayload = {
                    id: sheet.toldo.id || crypto.randomUUID(),
                    production_sheet_id: mainData.id,
                    modelo: sheet.toldo.modelo,
                    comando: sheet.toldo.comando,
                    bambinela: sheet.toldo.bambinela,
                    vies: sheet.toldo.vies,
                    entre_vao: sheet.toldo.entreVao,
                    cor_ferragem: sheet.toldo.corFerragem,
                    bracos: sheet.toldo.bracos,
                    medidas_braco: sheet.toldo.medidasBraco,
                    fixacao: sheet.toldo.fixacao,
                    medida_fixacao: sheet.toldo.medidaFixacao,
                    trava: sheet.toldo.trava,
                    manivela_qtd: sheet.toldo.manivelaQtd,
                    medida_manivela: sheet.toldo.medidaManivela,
                    parapeito: sheet.toldo.parapeito,
                    largura_beiral: sheet.toldo.larguraBeiral,
                    caida: sheet.toldo.caida,
                    altura_instalacao: sheet.toldo.alturaInstalacao,
                    instalacao: sheet.toldo.instalacao,
                    corredica: sheet.toldo.corredica,
                    posicionamento: sheet.toldo.posicionamento,
                    obs: sheet.toldo.obs,
                    updated_at: new Date().toISOString()
                };

                const { error: toldoError } = await supabase
                    .from('production_sheet_toldo')
                    .upsert(toldoPayload);

                if (toldoError) throw new Error(`Erro nos detalhes de Toldo: ${toldoError.message}`);
            }

            if (productType === 'Cobertura' && sheet.cobertura && hasData(sheet.cobertura)) {
                const coberturaPayload = {
                    id: sheet.cobertura.id || crypto.randomUUID(),
                    production_sheet_id: mainData.id,
                    cor_ferragem: sheet.cobertura.corFerragem,
                    altura_instalacao: sheet.cobertura.alturaInstalacao,
                    caida: sheet.cobertura.caida,
                    calha_saida: sheet.cobertura.calhaSaida,
                    updated_at: new Date().toISOString()
                };

                const { error: coberturaError } = await supabase
                    .from('production_sheet_cobertura')
                    .upsert(coberturaPayload);

                if (coberturaError) throw new Error(`Erro nos detalhes de Cobertura: ${coberturaError.message}`);
            }

            return this.getProductionInstallationSheet(sheet.measurementItemId);
        } catch (error: any) {
            console.error('Error in saveProductionInstallationSheet:', error);
            if (!force && (error.message.includes('fetch') || error.code === 'PGRST116')) {
                this.addToSyncQueue('production_sheet', { sheet, productType });
                return sheet; // Retorna o que foi enviado para não quebrar o UI
            }
            throw error;
        }
    },

    async deleteProductionInstallationSheet(id: string) {
        const { error } = await supabase
            .from('production_installation_sheets')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    // Get complete order data for production sheet printing
    async getOrderProductionData(orderId: string) {
        // Get order
        const { data: orderData, error: orderError } = await supabase
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .single();

        if (orderError) throw orderError;

        // Get measurement items from ALL technical sheets for this customer
        // This ensures items added in any version of the technical sheet appear in production
        let itemsData: any[] = [];

        // First, try to get items from the order's linked sheet
        if (orderData.technical_sheet_id) {
            const { data: fetchedItems } = await supabase
                .from('measurement_items')
                .select('*')
                .eq('technical_sheet_id', orderData.technical_sheet_id);

            if (fetchedItems) {
                itemsData = fetchedItems;
            }
        }

        // Also fetch items from ALL other sheets for the same customer and merge
        // This handles the case where items were edited into a newer/different sheet
        if (orderData.customer_id) {
            const { data: allSheets } = await supabase
                .from('technical_sheets')
                .select('id')
                .eq('customer_id', orderData.customer_id);

            if (allSheets && allSheets.length > 0) {
                const otherSheetIds = allSheets
                    .map((s: any) => s.id)
                    .filter((id: string) => id !== orderData.technical_sheet_id);

                if (otherSheetIds.length > 0) {
                    const { data: otherItems } = await supabase
                        .from('measurement_items')
                        .select('*')
                        .in('technical_sheet_id', otherSheetIds);

                    if (otherItems && otherItems.length > 0) {
                        // Merge: add items that are not already in itemsData (by ID)
                        const existingIds = new Set(itemsData.map((i: any) => i.id));
                        for (const item of otherItems) {
                            if (!existingIds.has(item.id)) {
                                itemsData.push(item);
                                existingIds.add(item.id);
                            }
                        }
                    }
                }
            }
        }

        // Fallback: use items_snapshot from the order if still no items found
        if (itemsData.length === 0 && orderData.items_snapshot) {
            const snapshot = typeof orderData.items_snapshot === 'string'
                ? JSON.parse(orderData.items_snapshot)
                : orderData.items_snapshot;

            // Normalize snapshot fields to match measurement_items columns
            itemsData = (snapshot || []).map((it: any) => ({
                id: it.id,
                technical_sheet_id: orderData.technical_sheet_id,
                product_id: it.productId || it.product_id,
                parent_item_id: it.parentItemId || it.parent_item_id,
                environment: it.environment,
                width: it.width,
                height: it.height,
                color: it.color,
                command: it.command,
                notes: it.notes,
                quantity: it.quantity || 1,
                product_type: it.productType || it.product_type
            }));
        }


        // Get production sheets for all items
        const itemIds = itemsData.map((item: any) => item.id);
        const { data: productionSheets, error: prodError } = await supabase
            .from('production_installation_sheets')
            .select('*')
            .in('measurement_item_id', itemIds);

        if (prodError) throw prodError;

        // Get specific sheets
        const prodSheetIds = productionSheets?.map(ps => ps.id) || [];

        const [cortinaRes, toldoRes, coberturaRes] = await Promise.all([
            supabase.from('production_sheet_cortina').select('*').in('production_sheet_id', prodSheetIds),
            supabase.from('production_sheet_toldo').select('*').in('production_sheet_id', prodSheetIds),
            supabase.from('production_sheet_cobertura').select('*').in('production_sheet_id', prodSheetIds)
        ]);

        // Get customer from Order (Contract) instead of Technical Sheet
        const { data: customerData, error: customerError } = await supabase
            .from('customers')
            .select('*')
            .eq('id', orderData.customer_id)
            .single();

        if (customerError) throw customerError;

        // Get Seller Name
        let sellerName = 'RTC - Toldos & Cortinas';
        if (orderData.seller_id) {
            const { data: sellerData } = await supabase
                .from('sellers')
                .select('name')
                .eq('id', orderData.seller_id)
                .single();
            if (sellerData) sellerName = sellerData.name;
        }

        // Map production sheets to items
        const itemsWithProduction = itemsData.map((item: any) => {
            const prodSheet = productionSheets?.find((ps: any) => ps.measurement_item_id === item.id);

            let specificData = {};
            if (prodSheet) {
                const cortina = cortinaRes.data?.find(c => c.production_sheet_id === prodSheet.id);
                const toldo = toldoRes.data?.find(t => t.production_sheet_id === prodSheet.id);
                const cobertura = coberturaRes.data?.find(cb => cb.production_sheet_id === prodSheet.id);

                specificData = {
                    cortina: cortina ? {
                        id: cortina.id,
                        comando: cortina.comando,
                        vao: cortina.vao,
                        varaoCor: cortina.varao_cor,
                        instalacao: cortina.instalacao,
                        trilho: cortina.trilho,
                        posicionamento: cortina.posicionamento
                    } : undefined,
                    toldo: toldo ? {
                        id: toldo.id,
                        modelo: toldo.modelo,
                        comando: toldo.comando,
                        bambinela: toldo.bambinela,
                        vies: toldo.vies,
                        entreVao: toldo.entre_vao,
                        corFerragem: toldo.cor_ferragem,
                        bracos: toldo.bracos,
                        medidasBraco: toldo.medidas_braco,
                        fixacao: toldo.fixacao,
                        medidaFixacao: toldo.medida_fixacao,
                        trava: toldo.trava,
                        manivelaQtd: toldo.manivela_qtd,
                        medidaManivela: toldo.medida_manivela,
                        parapeito: toldo.parapeito,
                        larguraBeiral: toldo.largura_beiral,
                        caida: toldo.caida,
                        alturaInstalacao: toldo.altura_instalacao,
                        instalacao: toldo.instalacao,
                        corredica: toldo.corredica,
                        posicionamento: toldo.posicionamento,
                        obs: toldo.obs
                    } : undefined,
                    cobertura: cobertura ? {
                        id: cobertura.id,
                        corFerragem: cobertura.cor_ferragem,
                        alturaInstalacao: cobertura.altura_instalacao,
                        caida: cobertura.caida,
                        calhaSaida: cobertura.calha_saida
                    } : undefined
                };
            }

            return {
                id: item.id,
                environment: item.environment,
                productId: item.product_id,
                width: item.width,
                height: item.height,
                quantity: item.quantity,
                color: item.color,
                command: item.command, // New field
                notes: item.notes, // New field: Observações
                parentItemId: item.parent_item_id,
                productionSheet: prodSheet ? {
                    id: prodSheet.id,
                    measurementItemId: prodSheet.measurement_item_id,
                    videoLink: prodSheet.video_link,
                    observacoesGerais: prodSheet.observacoes_gerais,
                    ...specificData,
                    createdAt: new Date(prodSheet.created_at),
                    updatedAt: new Date(prodSheet.updated_at)
                } : undefined
            };
        });

        return {
            order: {
                id: orderData.id,
                technicalSheetId: orderData.technical_sheet_id,
                contractNumber: orderData.contract_number,
                quoteNumber: orderData.quote_number,
                sellerName: sellerName,
                totalValue: orderData.total_value,
                createdAt: new Date(orderData.created_at)
            },
            customer: {
                id: customerData.id,
                name: customerData.name,
                type: customerData.type,
                document: customerData.document,
                cpfCnpj: customerData.document, // alias expected by ProductionSheetPrint
                phone: customerData.phone,
                address: customerData.address
            },
            items: itemsWithProduction
        };
    },

    // Seed Data (Optional helper)
    async seedInitialData(products: Product[], customers: Customer[], sellers: Seller[]) {
        if (products.length > 0) await supabase.from('products').upsert(products);
        if (customers.length > 0) await supabase.from('customers').upsert(customers);
        if (sellers.length > 0) await supabase.from('sellers').upsert(sellers);
    },

    // Seller Blocked Slots
    async getBlockedSlots() {
        const { data, error } = await supabase.from('seller_blocked_slots').select('*');
        if (error) throw error;
        return (data || []).map(s => ({
            ...s,
            sellerId: s.seller_id,
            startTime: s.start_time,
            endTime: s.end_time,
            createdAt: s.created_at
        })) as SellerBlockedSlot[];
    },
    async saveBlockedSlot(slot: SellerBlockedSlot) {
        const payload = {
            id: slot.id,
            seller_id: slot.sellerId,
            date: slot.date,
            start_time: slot.startTime,
            end_time: slot.endTime,
            reason: slot.reason
        };
        const { data, error } = await supabase.from('seller_blocked_slots').upsert(payload).select().single();
        if (error) throw error;
        return {
            ...data,
            sellerId: data.seller_id,
            startTime: data.start_time,
            endTime: data.end_time,
            createdAt: data.created_at
        } as SellerBlockedSlot;
    },
    async deleteBlockedSlot(id: string) {
        const { error } = await supabase.from('seller_blocked_slots').delete().eq('id', id);
        if (error) throw error;
    },

    // NFe Settings
    async getNFeSettings() {
        const { data, error } = await supabase.from('nfe_settings').select('*').limit(1).maybeSingle();
        if (error) throw error;
        if (!data) return { nextNumber: 1, currentSeries: 1, environment: 2, cnpj: '', apiKey: '' };
        return {
            id: data.id,
            nextNumber: data.next_number,
            currentSeries: data.current_series,
            environment: data.environment,
            cnpj: data.cnpj || '',
            apiKey: data.api_key || ''
        };
    },
    async saveNFeSettings(settings: any) {
        const payload = {
            id: settings.id,
            next_number: settings.nextNumber,
            current_series: settings.currentSeries,
            environment: settings.environment,
            cnpj: settings.cnpj,
            api_key: settings.apiKey,
            updated_at: new Date().toISOString()
        };
        const { data, error } = await supabase.from('nfe_settings').upsert(payload).select().single();
        if (error) throw error;
        return {
            id: data.id,
            nextNumber: data.next_number,
            currentSeries: data.current_series,
            environment: data.environment,
            cnpj: data.cnpj,
            apiKey: data.api_key
        };
    },

    // Financial & Purchasing Module
    async getAccountCategories() {
        const { data, error } = await supabase.from('account_categories').select('*');
        if (error) throw error;
        return data as AccountCategory[];
    },
    async saveAccountCategory(category: AccountCategory) {
        const { data, error } = await supabase.from('account_categories').upsert(category).select().single();
        if (error) throw error;
        return data as AccountCategory;
    },
    async getFinancialTransactions() {
        const { data, error } = await supabase.from('financial_transactions').select('*');
        if (error) throw error;
        return data as FinancialTransaction[];
    },
    async saveFinancialTransaction(transaction: FinancialTransaction) {
        const { data, error } = await supabase.from('financial_transactions').upsert(transaction).select().single();
        if (error) throw error;
        return data as FinancialTransaction;
    },
    async deleteFinancialTransaction(id: string) {
        const { error } = await supabase.from('financial_transactions').delete().eq('id', id);
        if (error) throw error;
    },
    async getPurchaseRequests() {
        const { data, error } = await supabase.from('purchase_requests').select('*');
        if (error) throw error;
        return data as PurchaseRequest[];
    },
    async savePurchaseRequest(request: PurchaseRequest) {
        const { data, error } = await supabase.from('purchase_requests').upsert(request).select().single();
        if (error) throw error;
        return data as PurchaseRequest;
    },
    async getPurchaseOrders() {
        const { data, error } = await supabase.from('purchase_orders').select('*');
        if (error) throw error;
        return data as PurchaseOrder[];
    },
    async savePurchaseOrder(order: PurchaseOrder) {
        const { data, error } = await supabase.from('purchase_orders').upsert(order).select().single();
        if (error) throw error;
        return data as PurchaseOrder;
    },

    // Tasks Module
    async getTasks() {
        const { data, error } = await supabase.from('tasks').select('*');
        if (error) throw error;
        return data as Task[];
    },
    async saveTask(task: Partial<Task>) {
        const payload: any = {
            id: task.id || crypto.randomUUID(),
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            assigned_to: task.assigned_to,
            created_by: task.created_by,
            due_date: task.due_date,
            order_id: task.order_id,
            created_at: task.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
            completed_at: task.completed_at
        };
        const { data, error } = await supabase.from('tasks').upsert(payload).select().single();
        if (error) throw error;
        return data as Task;
    },
    async deleteTask(id: string) {
        const { error } = await supabase.from('tasks').delete().eq('id', id);
        if (error) throw error;
    },

    // System Settings
    async getSystemSettings() {
        const { data, error } = await supabase.from('system_settings').select('*');
        if (error) throw error;
        return data as { id: string, key: string, value: string }[];
    },
    async updateSystemSetting(key: string, value: string) {
        const { error } = await supabase.from('system_settings').upsert({ key, value }, { onConflict: 'key' }).select();
        if (error) throw error;
    },

    // API Settings
    async getApiSettings() {
        const { data, error } = await supabase.from('api_settings').select('*');
        if (error) throw error;
        return data as ApiSettings[];
    },
    async saveApiSettings(settings: Partial<ApiSettings>) {
        const { data, error } = await supabase.from('api_settings').upsert(settings).select().single();
        if (error) throw error;
        return data as ApiSettings;
    },

    // Raw Materials & Stock Control
    async getRawMaterials() {
        const { data: materials, error: mError } = await supabase.from('raw_materials').select('*').order('name');
        if (mError) throw mError;
        
        const { data: movements, error: movError } = await supabase.from('raw_material_movements').select('*').order('created_at', { ascending: false });
        if (movError) throw movError;

        return materials.map(m => {
            const matMovs = movements.filter(mov => mov.raw_material_id === m.id);
            
            // Calc Current Stock
            const stock = matMovs.reduce((acc, mov) => {
                const qty = Number(mov.quantity);
                return mov.type === 'IN' ? acc + qty : acc - qty;
            }, 0);

            // Find Last Purchase
            const lastIn = matMovs.find(mov => mov.type === 'IN');

            return { 
                ...m, 
                current_stock: stock,
                last_purchase_date: lastIn?.created_at,
                last_supplier: lastIn?.supplier_name
            };
        }) as RawMaterial[];
    },

    async saveRawMaterial(material: Partial<RawMaterial>) {
        const { data, error } = await supabase.from('raw_materials').upsert(material).select().single();
        if (error) throw error;
        return data as RawMaterial;
    },

    async deleteRawMaterial(id: string) {
        const { error } = await supabase.from('raw_materials').delete().eq('id', id);
        if (error) throw error;
    },

    async getRawMaterialMovements(materialId?: string) {
        let query = supabase.from('raw_material_movements').select('*');
        if (materialId) query = query.eq('raw_material_id', materialId);
        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        return data as RawMaterialMovement[];
    },

    async saveRawMaterialMovement(movement: Partial<RawMaterialMovement>) {
        const { data, error } = await supabase.from('raw_material_movements').insert(movement).select().single();
        if (error) throw error;
        return data as RawMaterialMovement;
    },

    async getRawMaterialMappings() {
        const { data, error } = await supabase.from('raw_material_mappings').select('*');
        if (error) throw error;
        return data as RawMaterialMapping[];
    },

    async saveRawMaterialMapping(mapping: Partial<RawMaterialMapping>) {
        const { data, error } = await supabase.from('raw_material_mappings').upsert(mapping).select().single();
        if (error) throw error;
        return data as RawMaterialMapping;
    },

    // AI Sales Goals
    async getSalesGoals(): Promise<SalesGoal[]> {
        const { data, error } = await supabase.from('ai_sales_goals').select('*');
        if (error) throw error;
        return (data || []).map(g => ({
            id: g.id,
            sellerId: g.seller_id,
            goalAmount: Number(g.goal_amount),
            updatedAt: g.updated_at
        }));
    },
    async saveSalesGoal(sellerId: string | null, amount: number) {
        const { data, error } = await supabase
            .from('ai_sales_goals')
            .upsert({ seller_id: sellerId, goal_amount: amount }, { onConflict: 'seller_id' })
            .select()
            .single();
        if (error) throw error;
        return {
            id: data.id,
            sellerId: data.seller_id,
            goalAmount: Number(data.goal_amount),
            updatedAt: data.updated_at
        } as SalesGoal;
    },

    // Rotina de Backup Total
    async generateSystemBackup() {
        try {
            const backup: any = {};
            const collections = [
                'products', 'customers', 'sellers', 'appointments', 'orders',
                'technical_sheets', 'system_users', 'production_tracking', 'expenses',
                'production_installation_sheets', 'seller_blocked_slots', 'installers',
                'account_categories', 'financial_transactions', 'purchase_requests',
                'purchase_orders', 'tasks', 'time_entries', 'reworks', 'api_settings',
                'system_settings'
            ];

            for (const table of collections) {
                const { data } = await supabase.from(table).select('*');
                backup[table] = data || [];
            }

            return backup;
        } catch (error) {
            console.error("Erro ao gerar backup de tabelas:", error);
            throw error;
        }
    }
};


// Registrar monitor de sincronização
if (typeof window !== 'undefined') {
    window.addEventListener('online', () => dataService.processSyncQueue());
    // Tenta sincronizar ao iniciar o app também
    setTimeout(() => dataService.processSyncQueue(), 2000);
}
