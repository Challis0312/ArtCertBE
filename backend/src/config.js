// config.js

// see https://medium.com/the-node-js-collection/making-your-node-js-work-everywhere-with-environment-variables-2da8cdf6e786
// for explanation

module.exports = {
    target_env: process.env.NODE_ENV || 'DEV',
    endpoint: process.env.LISTEN_PORT || 6777,
    aws_region: process.env.AWS_REGION,


    // DB connection
    POSTGRES_PORT: process.env.POSTGRES_PORT !== undefined ? parseInt(process.env.POSTGRES_PORT, 10) : 5432,
    POSTGRES_HOST: process.env.POSTGRES_HOST || (() => { throw new Error('No DB host defined') })(),
    POSTGRES_aws_secretId: process.env.POSTGRES_AWS_SECRET_ID,
    POSTGRES_USER: process.env.POSTGRES_USER || (() => {
        if (process.env.AWS_POSTGRES_SECRETNAME === undefined) throw new Error('No DB user defined');
        return undefined;
    })(),
    POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD || (() => {
        if (process.env.AWS_POSTGRES_SECRETNAME === undefined) throw new Error('No DB password defined');
        return undefined;
    })(),
    POSTGRES_DB: process.env.POSTGRES_DB || (() => {
        throw new Error('No DB schema defined');
    })(),
    POSTGRES_waitForConnections: process.env.POSTGRES_WAIT_FOR_CONNECT !== undefined ? process.env.POSTGRES_WAIT_FOR_CONNECT === 'true' : true,
    POSTGRES_connectionLimit: process.env.POSTGRES_CONNECT_LIMIT !== undefined ? parseInt(process.env.POSTGRES_CONNECT_LIMIT, 10) : 100,
    POSTGRES_maxIdle: process.env.POSTGRES_MAX_IDLE !== undefined ? parseInt(process.env.POSTGRES_MAX_IDLE, 10) : 10,
    POSTGRES_idleTimeout: process.env.POSTGRES_IDLE_TIMEOUT !== undefined ? parseInt(process.env.POSTGRES_IDLE_TIMEOUT, 10) : 60000,
    POSTGRES_queueLimit: process.env.POSTGRES_QUEUE_LIMIT !== undefined ? parseInt(process.env.POSTGRES_QUEUE_LIMIT, 10) : 0
}



