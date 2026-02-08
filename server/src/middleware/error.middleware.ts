import { Request, Response, NextFunction } from 'express';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
    console.error(err.stack);

    if (err.name === 'ZodError') {
        return res.status(400).json({
            error: 'Validation Error',
            details: err.errors
        });
    }

    if (err.code === 'P2002') {
        return res.status(409).json({
            error: 'A record with this value already exists'
        });
    }

    res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error'
    });
};
