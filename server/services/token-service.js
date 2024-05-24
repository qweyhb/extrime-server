const knex = require('../configs/knex.config');
const jwt = require('jsonwebtoken')

const secretKey = "ekaterinaFlorium"

class TokenService {
    generateTokens(payload) {
        const accessToken = jwt.sign(payload, secretKey, {expiresIn: '60m'})
        const refreshToken = jwt.sign(payload, secretKey, {expiresIn: '30d'})

        return {
            accessToken,
            refreshToken
        }
    }

    async saveToken(userId, refreshToken) {
        console.log(userId)
        const tokens = await knex
            .select('*')
            .from('users')
            .joinRaw("left join user_tokens ON user_tokens.user_id = users.id", [])
            .where('user_id', userId)

        if (tokens.length !== 0) {
            await tokens.some(async function(currentObject) {
                if (currentObject.token !== 0 || currentObject.token !== undefined || currentObject.token !== '') {
                    await knex
                        .select('*')
                        .from('user_tokens')
                        .where('user_id', userId)
                        .update('token', refreshToken)
                    return null;
                }
            });
        } else {
            await knex('user_tokens').insert(
                {
                    user_id: userId,
                    token: refreshToken
                }
            )
        }
    }

    validateAccessToken(token) {
        try {
            const userData = jwt.verify(token, secretKey)
            return userData
        } catch (e) {
            return null;
        }
    }

    validateRefreshToken(token) {
        try {
            const userData = jwt.verify(token, secretKey)
            return userData
        } catch (e) {
            return null;
        }
    }

    async removeToken(refreshToken) {
        const tokenData = await knex
            .select('*')
            .from('user_tokens')
            .where('token', refreshToken)
            .del()

        return tokenData
    }

    async findToken(refreshToken) {
        const tokenData = await knex
            .select('token')
            .from('user_tokens')
            .where('token', refreshToken)

        return tokenData
    }
}

module.exports = new TokenService()