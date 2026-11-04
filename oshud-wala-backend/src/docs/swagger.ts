import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Application } from 'express';

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Oshud Wala API',
            version: '1.0.0',
            description: 'Enterprise-Grade Healthcare Commerce & Pharmacy Platform API Documentation',
        },
        servers: [
            {
                url: 'http://localhost:6000/api/v1',
                description: 'Local Development Server',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
        },
    },
    apis: ['./src/modules/**/*.routes.ts'], // Route file theke comment extract korbe
};

const swaggerSpec = swaggerJsdoc(options);

export const setupSwagger = (app: Application) => {
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
    console.log('📄 Swagger Docs available at http://localhost:6000/docs');
};