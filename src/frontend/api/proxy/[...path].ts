import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Secure API Proxy for Cognivern
 * Forwards requests to backend server without exposing IP address
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Get backend URL from secure environment variable
    const backendUrl = process.env.BACKEND_URL;
    
    if (!backendUrl) {
      return res.status(500).json({ 
        error: 'Backend URL not configured',
        message: 'BACKEND_URL environment variable is required'
      });
    }

    // Extract the API path from the request
    const path = Array.isArray(req.query.path) 
      ? req.query.path.join('/') 
      : req.query.path || '';

    // Construct the full backend URL
    const targetUrl = `${backendUrl}/api/${path}`;

    // Forward query parameters
    const url = new URL(targetUrl);
    Object.entries(req.query).forEach(([key, value]) => {
      if (key !== 'path' && value) {
        url.searchParams.set(key, Array.isArray(value) ? value[0] : value);
      }
    });

    // Prepare headers for forwarding
    const forwardHeaders: Record<string, string> = {};
    
    // Forward essential headers
    if (req.headers['content-type']) {
      forwardHeaders['Content-Type'] = req.headers['content-type'] as string;
    }
    if (req.headers['x-api-key']) {
      forwardHeaders['X-API-KEY'] = req.headers['x-api-key'] as string;
    }
    if (req.headers['authorization']) {
      forwardHeaders['Authorization'] = req.headers['authorization'] as string;
    }

    // Prepare request body for non-GET requests
    let body: string | undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    // Make the request to the backend
    const response = await fetch(url.toString(), {
      method: req.method || 'GET',
      headers: forwardHeaders,
      body,
    });

    // Forward response headers
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      // Forward safe headers
      if (['content-type', 'cache-control', 'etag'].includes(key.toLowerCase())) {
        responseHeaders[key] = value;
      }
    });

    // Set CORS headers for frontend
    responseHeaders['Access-Control-Allow-Origin'] = '*';
    responseHeaders['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
    responseHeaders['Access-Control-Allow-Headers'] = 'Content-Type, X-API-KEY, Authorization';

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(200).json({});
    }

    // Get response data
    let data;
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      try {
        data = await response.json();
      } catch (error) {
        data = { error: 'Invalid JSON response from backend' };
      }
    } else {
      data = await response.text();
    }

    // Set response headers
    Object.entries(responseHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    // Return the response
    return res.status(response.status).json(data);

  } catch (error) {
    console.error('API Proxy Error:', error);
    
    return res.status(500).json({
      error: 'Proxy request failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}

// Configure the API route
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
}
