import { Request, Response, NextFunction } from 'express';

export const validateApiKey = (req: Request, res: Response, next: NextFunction): void => {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');

  if (!apiKey || apiKey !== process.env.API_KEY) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or missing API key',
    });
    return;
  }

  next();
};
