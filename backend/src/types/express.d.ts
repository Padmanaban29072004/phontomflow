import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      session?: {
        id: string;
        [key: string]: any;
      };
      user?: {
        id: string;
        [key: string]: any;
      };
    }
  }
}

export {};
