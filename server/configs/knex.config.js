const knex = require("knex")

module.exports = knex({
    client: 'pg',
    connection: {
        host: 'localhost',
        port: '5433',
        user: 'postgres',
        password: '1234',
        database: 'nFlorium'
    }
})