import { supabase } from './supabase';
import { Product, Customer, Seller, Appointment, Order, TechnicalSheet, SystemUser, ProductionTracking, Expense, ProductionInstallationSheet, SellerBlockedSlot, Installer } from '../types';

export const dataService = {
    // Products
    async getProducts() {
        const { data, error } = await supabase.from('products').select('*');
        if (error) throw error;
        return data as Product[];
    },
    async saveProduct(product: Product) {
        const { data, error } = await supabase.from('products').upsert(product).select().single();
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

    // Customers
    async getCustomers() {
        const { data, error } = await supabase.from('customers').select('*');
        if (error) throw error;
        return (data || []).map(c => ({
            ...c,
            tradeName: c.trade_name, // Map snake_case from DB to camelCase
            contactName: c.contact_name,
            contactPhone: c.contact_phone,
            contactEmail: c.contact_email,
        })) as Customer[];
    },
    async saveCustomer(customer: Customer) {
        try {
            const payload = {
                ...customer,
                trade_name: customer.tradeName,
                contact_name: customer.contactName,
                contact_phone: customer.contactPhone,
                contact_email: customer.contactEmail,
            };
            // @ts-ignore
            delete payload.tradeName;
            // @ts-ignore
            delete payload.contactName;
            // @ts-ignore
            delete payload.contactPhone;
            // @ts-ignore
            delete payload.contactEmail;

            console.log("Saving customer payload:", payload);
            const { data, error } = await supabase.from('customers').upsert(payload).select().single();

            if (error) {
                console.error("Supabase error saving customer:", error);
                throw new Error(error.message || "Unknown error saving customer");
            }

            return {
                ...data,
                tradeName: data.trade_name,
                contactName: data.contact_name,
                contactPhone: data.contact_phone,
                contactEmail: data.contact_email,
            } as Customer;
        } catch (err: any) {
            console.error("DataService Exception:", err);
            throw err;
        }
    },

    // Sellers
    async getSellers() {
        const { data, error } = await supabase.from('sellers').select('*');
        if (error) throw error;
        return data as Seller[];
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
        })) as Installer[];
    },
    async saveInstaller(installer: Installer) {
        const payload = {
            ...installer,
            daily_rate: installer.dailyRate,
        };
        // @ts-ignore
        delete payload.dailyRate;
        const { data, error } = await supabase.from('installers').upsert(payload).select().single();
        if (error) throw error;
        return { ...data, dailyRate: Number(data.daily_rate) } as Installer;
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
                notes: item.notes
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
        // Fetch all orders
        const { data: ordersData, error: ordersError } = await supabase.from('orders').select('*');
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
                createdAt: new Date(o.created_at)
            };
        }) as unknown as Order[];
    },
    async saveOrder(order: Order) {
        const payload = {
            id: order.id,
            customer_id: order.customerId,
            technical_sheet_id: order.technicalSheetId,
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
        };
        console.log('💾 Saving order payload:', payload);
        let { data, error } = await supabase.from('orders').upsert(payload).select().single();

        // Robustez: Se a coluna item_prices não existir no banco, tenta salvar sem ela
        if (error && error.message?.includes('item_prices')) {
            console.warn('⚠️ Coluna item_prices não encontrada. Tentando salvar sem preços customizados.');
            const { item_prices, ...payloadWithoutPrices } = payload;
            const retry = await supabase.from('orders').upsert(payloadWithoutPrices).select().single();
            data = retry.data;
            error = retry.error;
        }

        if (error) {
            console.error('❌ Supabase error saving order:', error);
            throw error;
        }
        return {
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
            productionStage: data.production_stage,
            productionHistory: data.production_history,
            itemPrices: data.item_prices || {},
            contractObservations: data.contract_observations,
            createdAt: new Date(data.created_at)
        } as unknown as Order;
    },

    // PCP (Production Tracking)
    async getPCPOrders() {
        // Fetch all tracking info
        const { data: trackingData, error: trackingError } = await supabase.from('production_tracking').select('*');
        if (trackingError) throw trackingError;

        // Fetch orders that are in tracking
        const orderIds = trackingData.map(t => t.order_id);
        const { data: ordersData, error: ordersError } = await supabase.from('orders').select('*').in('id', orderIds);
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
            updated_at: new Date()
        }).eq('order_id', orderId);
        if (error) throw error;
    },

    async deleteOrder(id: string) {
        const { error } = await supabase.from('orders').delete().eq('id', id);
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

    async saveProductionInstallationSheet(sheet: any, productType: string) {
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
            throw mainError;
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
            console.log(`🔍 hasData check: found ${actualData.length} data fields`, actualData);
            return actualData.length > 0;
        };

        // Save specific data based on product type
        if (productType === 'Cortina' && sheet.cortina && hasData(sheet.cortina)) {
            const cortinaPayload = {
                id: sheet.cortina.id || crypto.randomUUID(), // CRITICAL: needed for upsert
                production_sheet_id: mainData.id,
                comando: sheet.cortina.comando,
                vao: sheet.cortina.vao,
                varao_cor: sheet.cortina.varaoCor,
                instalacao: sheet.cortina.instalacao,
                trilho: sheet.cortina.trilho,
                posicionamento: sheet.cortina.posicionamento,
                updated_at: new Date().toISOString()
            };

            console.log('🗳️ Saving Cortina data:', cortinaPayload);
            const { error: cortinaError } = await supabase
                .from('production_sheet_cortina')
                .upsert(cortinaPayload);

            if (cortinaError) {
                console.error('❌ Error saving Cortina specifics:', cortinaError);
                throw cortinaError;
            }
            console.log('✅ Cortina specifics saved');
        }

        if (productType === 'Toldo' && sheet.toldo && hasData(sheet.toldo)) {
            const toldoPayload = {
                id: sheet.toldo.id || crypto.randomUUID(), // CRITICAL: needed for upsert
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

            console.log('🗳️ Saving Toldo data:', toldoPayload);
            const { error: toldoError } = await supabase
                .from('production_sheet_toldo')
                .upsert(toldoPayload);

            if (toldoError) {
                console.error('❌ Error saving Toldo specifics:', toldoError);
                throw toldoError;
            }
            console.log('✅ Toldo specifics saved');
        }

        if (productType === 'Cobertura' && sheet.cobertura && hasData(sheet.cobertura)) {
            const coberturaPayload = {
                id: sheet.cobertura.id || crypto.randomUUID(), // CRITICAL: needed for upsert
                production_sheet_id: mainData.id,
                cor_ferragem: sheet.cobertura.corFerragem,
                altura_instalacao: sheet.cobertura.alturaInstalacao,
                caida: sheet.cobertura.caida,
                calha_saida: sheet.cobertura.calhaSaida,
                updated_at: new Date().toISOString()
            };

            console.log('🗳️ Saving Cobertura data:', coberturaPayload);
            const { error: coberturaError } = await supabase
                .from('production_sheet_cobertura')
                .upsert(coberturaPayload);

            if (coberturaError) {
                console.error('❌ Error saving Cobertura specifics:', coberturaError);
                throw coberturaError;
            }
            console.log('✅ Cobertura specifics saved');
        }

        // Return complete data
        return this.getProductionInstallationSheet(sheet.measurementItemId);
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

        // Get technical sheet
        const { data: sheetData, error: sheetError } = await supabase
            .from('technical_sheets')
            .select('*')
            .eq('id', orderData.technical_sheet_id)
            .single();

        if (sheetError) throw sheetError;

        // Get measurement items
        let query = supabase
            .from('measurement_items')
            .select('*')
            .eq('technical_sheet_id', sheetData.id);

        if (orderData.item_ids && orderData.item_ids.length > 0) {
            query = query.in('id', orderData.item_ids);
        }

        const { data: itemsData, error: itemsError } = await query;

        if (itemsError) throw itemsError;

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

        // Get customer
        const { data: customerData, error: customerError } = await supabase
            .from('customers')
            .select('*')
            .eq('id', sheetData.customer_id)
            .single();

        if (customerError) throw customerError;

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
                totalValue: orderData.total_value,
                createdAt: new Date(orderData.created_at)
            },
            customer: {
                id: customerData.id,
                name: customerData.name,
                type: customerData.type,
                cpfCnpj: customerData.cpf_cnpj,
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
    }
};
