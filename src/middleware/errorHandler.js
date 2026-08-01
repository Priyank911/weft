/**
 * Custom application error class.
 */
export class AppError extends Error {
    constructor(code, statusCode, message, details = {}) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
    }
}

/**
 * Global error handling middleware.
 */
export const errorHandler = (err, req, res, next) => {
    console.error(`[Error] ${new Date().toISOString()}`, err);

    let statusCode = 500;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected error occurred';
    let details = {};

    if (err instanceof AppError) {
        statusCode = err.statusCode;
        code = err.code;
        message = err.message;
        details = err.details;
    } else if (err.name === 'ValidationError') {
        statusCode = 400;
        code = 'VALIDATION_ERROR';
        message = err.message;
    }

    res.status(statusCode).json({
        error: {
            code,
            message,
            details
        }
    });
};
