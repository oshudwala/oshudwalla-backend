import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import { ApiError } from './utils/apiError';
import routes from './routes';
import { setupSwagger } from './docs/swagger'; // Eta add koro

const app: Application = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(compression());

if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// Setup Swagger UI
setupSwagger(app); // Eta add koro

app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'OK', message: 'Oshud Wala API is running' });
});

app.use('/api/v1', routes);

app.use((req: Request, res: Response, next: NextFunction) => {
    next(new ApiError(404, "Route not found"));
});

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    let error = err;
    if (!(error instanceof ApiError)) {
        const statusCode = error.statusCode || 500;
        const message = error.message || "Internal Server Error";
        error = new ApiError(statusCode, message, error?.errors || [], err.stack);
    }
    res.status(error.statusCode).json({
        success: error.success,
        message: error.message,
        errors: error.errors,
        ...(process.env.NODE_ENV === 'development' ? { stack: error.stack } : {})
    });
});

export default app;