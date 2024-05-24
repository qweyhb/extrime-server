const nodemailer = require('nodemailer')

class MailService {

    transport = nodemailer.createTransport({
        host: "smtp.mail.ru",
        port: "465",
        secure: true,
        auth: {
            user: "extrime2023@mail.ru",
            pass: "UsxDG66mvPB70pZ1wZVT"
        }
    })

    async sendChangePasswordMail(to, link) {
        try {
            await this.transport.sendMail({
                from: "extrime2023@mail.ru",
                to: to,
                subject: 'Смена пароля',
                text: '',
                html:
                    `
                    <div>
                        <h1>Для смены пароля перейдите на</h1>
                        <a href="${link}">${link}</a>
                    </div>
                `
            })
        } catch (e) {
            console.log(e)
        }
    }

    async sendActivationMail(to, link) {
        try {
            await this.transport.sendMail({
                from: "extrime2023@mail.ru",
                to: to,
                subject: 'Активация аккаунта на ' + process.env.API_URL,
                text: '',
                html:
                    `
                    <div>
                        <h1>Для активации перейдите по ссылке</h1>
                        <a href="${link}">${link}</a>
                    </div>
                `
            })
        } catch (e) {
            console.log(e)
        }
    }
}

module.exports = new MailService()