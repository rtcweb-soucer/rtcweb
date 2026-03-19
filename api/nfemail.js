
import fetch from 'node-fetch';

export default async function handler(req, res) {
    const { path } = req.query;
    const authHeader = req.headers.authorization;
    const method = req.method;
    
    // Pegamos todos os query params exceto 'path' para repassar à API do NFEmail
    const queryParams = new URLSearchParams(req.query);
    queryParams.delete('path');
    const queryString = queryParams.toString();
    
    const targetPath = path + (queryString ? `?${queryString}` : '');
    const targetUrl = `https://api.nfemail.com.br/api/${targetPath}`;

    console.log(`🔌 Proxying ${method} request to: ${targetUrl}`);

    try {
        const fetchOptions = {
            method: method,
            headers: {
                'Authorization': authHeader,
                'Content-Type': req.headers['content-type'] || 'application/json'
            },
            redirect: 'follow'
        };

        // Se for um método com corpo, repassamos o corpo
        if (['POST', 'PUT', 'PATCH'].includes(method)) {
            const contentType = req.headers['content-type'] || '';
            
            if (contentType.includes('application/json')) {
                fetchOptions.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            } else if (contentType.includes('application/x-www-form-urlencoded')) {
                if (typeof req.body === 'object') {
                    // Se o Vercel já parseou como objeto, reconvertemos para string form-encoded
                    // Mas cuidado com o caso especial do NFEmail que usa "=" + texto
                    const keys = Object.keys(req.body);
                    if (keys.length === 1 && req.body[keys[0]] === '' && keys[0].startsWith('=')) {
                        // Caso especial onde o corpo é "=..." e foi parseado como uma chave
                        fetchOptions.body = keys[0];
                    } else {
                        fetchOptions.body = new URLSearchParams(req.body).toString();
                    }
                } else {
                    fetchOptions.body = req.body;
                }
            } else {
                fetchOptions.body = req.body;
            }
        }

        const response = await fetch(targetUrl, fetchOptions);

        // Se a resposta for 401, removemos o cabeçalho WWW-Authenticate para evitar o modal do browser
        if (response.status === 401) {
            console.warn('⚠️ API returned 401. Stripping WWW-Authenticate header.');
            const responseText = await response.text();
            res.setHeader('X-NFE-Auth-Error', 'Unauthorized'); // Info opcional para debug
            return res.status(401).send(responseText);
        }

        // Repassamos os headers relevantes de sucesso
        const contentType = response.headers.get('content-type');
        if (contentType) res.setHeader('Content-Type', contentType);

        // Enviamos a resposta (texto ou buffer)
        const buffer = await response.buffer();
        res.status(response.status).send(buffer);

    } catch (error) {
        console.error('❌ NFEmail Proxy error:', error);
        res.status(500).json({ error: 'Failed to proxy NFEmail request', details: error.message });
    }
}
