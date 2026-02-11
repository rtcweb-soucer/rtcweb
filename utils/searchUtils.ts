
/**
 * Normaliza uma string removendo acentos e convertendo para minúsculas.
 * Útil para buscas insensíveis a acentos.
 */
export const normalizeString = (str: string): string => {
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
};

/**
 * Verifica se a string 'search' está contida em 'text' de forma insensível a acentos.
 */
export const fuzzyMatch = (text: string, search: string): boolean => {
    if (!search) return true;
    if (!text) return false;
    return normalizeString(text).includes(normalizeString(search));
};
