import swaggerJSDoc from 'swagger-jsdoc';

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Serene Health Web API',
            version: '1.0.0',
            description: 'API documentation for serene health web services',
        },
        servers: [
            {
                url: 'https://web-api-775r.onrender.com',
            }
        ],
    },
    apis: ['./index.js'],
};

const swaggerSpec = swaggerJSDoc(options);
export default swaggerSpec;