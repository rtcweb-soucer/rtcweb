export const addBusinessDays = (startDate: Date, days: number): Date => {
    if (isNaN(days) || days < 0) return startDate;

    const result = new Date(startDate);
    let daysAdded = 0;

    while (daysAdded < days) {
        result.setDate(result.getDate() + 1);
        const dayOfWeek = result.getDay();
        // 0 is Sunday, 6 is Saturday
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            daysAdded++;
        }
    }

    return result;
};

export const formatBusinessDate = (date: string | Date | undefined): string => {
    if (!date) return 'Não definida';
    return new Date(date).toLocaleDateString('pt-BR');
};
