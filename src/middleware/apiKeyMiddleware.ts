import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger.js';

/**
 * Middleware to validate API key
 */
export const apiKeyMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  
  // Check if API key is required
  if (!process.env.API_KEY) {
    // API key not configured, skip validation
    return next();
  }
  
  if (!apiKey) {
    logger.warn('API request without API key');
    return res.status(401).json({
      success: false,
      error: 'API key is required'
    });
  }
  
  if (apiKey !== process.env.API_KEY) {
    logger.warn('API request with invalid API key');
    return res.status(403).json({
      success: false,
      error: 'Invalid API key'
    });
  }
  
  // API key is valid
  next();
};
