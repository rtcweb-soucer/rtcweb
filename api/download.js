
import fetch from 'node-fetch';

export default async function handler(req, res) {
    const { endpoint } = req.query;
    const authHeader = req.headers.authorization;

    if (!endpoint) {
        return res.status(400).json({ error: 'Endpoint is required' });
    }

    if (!authHeader) {
        return res.status(401).json({ error: 'Authorization header is required' });
    }

    const targetUrl = `https://api.nfemail.com.br/api${endpoint}`;

    try {
        const response = await fetch(targetUrl, {
            headers: {
                'Authorization': authHeader
            },
            redirect: 'follow'
        });

        if (!response.ok) {
            return res.status(response.status).send(await response.text());
        }

        // Forward relevant headers
        const contentType = response.headers.get('content-type');
        const contentDisposition = response.headers.get('content-disposition');
        const contentLength = response.headers.get('content-length');

        if (contentType) res.setHeader('Content-Type', contentType);
        if (contentDisposition) res.setHeader('Content-Disposition', contentDisposition);
        if (contentLength) res.setHeader('Content-Length', contentLength);

        // Stream the response body
        const buffer = await response.buffer();
        res.send(buffer);

    } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).json({ error: 'Failed to fetch file', details: error.message });
    }
}
