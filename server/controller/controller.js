const knex = require('../configs/knex.config.js');
let express = require('express');
let router = express.Router();

const bcrypt = require('bcrypt')
const uuid = require('uuid')
const tokenService = require('../services/token-service')
const mailService = require('../services/mail-service.js')

const ApiError = require('../errors/errors')

const multer = require("multer");

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public')
    },
    filename: (req, file, cb) => {
        cb(null, `${file.originalname}`)
    }
})

const upload = multer({ storage: storage }).single('file')

router.post(
    '/registration',

    async (req, res, next) => {

        const users = await knex
            .select('email', 'login')
            .from('users')

        try {

            const hasDuplicates = await users.some(function (currentObject) {
                const email = currentObject.email.toLowerCase() === req.body.email;
                const login = currentObject.login.toLowerCase() === req.body.login;
                return email || login;

            });

            if (hasDuplicates) {
                throw ApiError.BadRequest(`Пользователь уже зарегестрирован`)
            }

            const hashPassword = await bcrypt.hash(req.body.password, 3)
            const activationLink = uuid.v4();
            const id = uuid.v4();

            await knex('users').insert(
                {
                    id,
                    login: req.body.login,
                    name: req.body.name,
                    surname: req.body.surname,
                    patronymic: req.body.patronymic,
                    email: req.body.email,
                    password: hashPassword,
                }
            )

            await knex('activation_links').insert(
                {
                    user_id: id,
                    link: activationLink
                }
            )

            await mailService.sendActivationMail(req.body.email, `http://localhost:3000/api/activate/${activationLink}`)

            const currentUser = await knex
                .select('email', 'id', 'activated')
                .from('users')
                .where('login', req.body.login)

            const tokens = tokenService.generateTokens({ ...currentUser[0] })
            await tokenService.saveToken(currentUser[0].id, tokens.refreshToken)

            res.send("Новый пользователь успешно зарегистрирован")

        } catch (e) {
            next(e)
        }
    })

router.post('/verify-email', async (req, res, next) => {
    try {
        const user = await knex
            .select('*')
            .from('users')
            .where('email', req.body.email)

        await mailService.sendChangePasswordMail(req.body.email, `${process.env.API_URL}/api/change-password/${user[0].activation_link}`)

        res.send('Ура')
    } catch (e) {
        next(e)
    }
})

router.post('/change-role/:id', async (req, res, next) => {
    try {
        const userID = req.params.id
        await knex('users').update('admin', req.body.value).where('id', userID)

        res.send('Ура')
    } catch (e) {
        next(e)
    }
})

router.get("/requests", async (req, res) => {
    try {
        const requests = await knex
            .select("*")
            .from("requests")
            .leftJoin("abonements", "requests.a_id", "abonements.abonement_id")
        res.status(200).send(requests)
    } catch (e) {
        next(e)
    }
})

router.get('/change-password/:link', async (req, res, next) => {
    try {
        const user = await knex
            .select('*')
            .from('users')
            .where('activation_link', req.params.link)

        if (!user) {
            throw ApiError.BadRequest('Неккоректная ссылка активации')
        }

        res.redirect(`http://localhost:3000/change-password/${user[0].id}`)
    } catch (e) {
        next(e)
    }
})

router.post('/set-password/:id', async (req, res, next) => {
    try {
        const userID = req.params.id
        const hashPassword = await bcrypt.hash(req.body.password, 3)
        await knex('users').update('password', hashPassword).where('id', userID)

        res.send('Ура')
    } catch (e) {
        next(e)
    }
})

router.post('/login', async (req, res, next) => {
    try {
        const user = await knex
            .select('*')
            .from('users')
            .where('login', req.body.login)

        if (!user[0]) {
            throw ApiError.BadRequest('Пользователь с такой эл. почтой не найден')
        }

        const isPassEquals = await bcrypt.compare(req.body.password, user[0].password)
        if (!isPassEquals) {
            throw ApiError.BadRequest('Неверный пароль')
        }


        const userdto = user[0]
        const tokens = tokenService.generateTokens({ ...userdto })
        await tokenService.saveToken(userdto.id, tokens.refreshToken)

        res.cookie('refreshToken', tokens.refreshToken, { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true })
       
        return res.send('Авторизация прошла успешно')
    } catch (e) {
        next(e)
    }
})
router.post('/logout', async (req, res, next) => {
    try {
        const { refreshToken } = req.cookies;
        await tokenService.removeToken(refreshToken)
        res.clearCookie('refreshToken');
        return res.send('Логаут успешен')
    } catch (e) {
        next(e)
    }
})

router.get('/products', async (req, res, next) => {
    try {
        const products = await knex.select("*")
            .from("products")
            .joinRaw("join countries ON countries.country_id = products.c_id", [])
            .joinRaw("join flower_types ON flower_types.type_id = products.t_id", [])
            .joinRaw("join categories ON categories.category_id = products.cat_id", [])
        res.send(products)
    } catch (e) {
        next(e)
    }
})

router.post('/create-requests', async (req, res, next) => {
    const { fio, number_phone, status, a_id, requests_id} = req.body;
    try {
        if (!status){
            await knex('requests').insert({
                fio, number_phone, status:'Ожидание', a_id, created_at: new Date(), updated_at: new Date(), stamp_millis: Date.now()
            })
        } else{
            await knex('requests').update({status}).where("requests_id",requests_id)
        }
        res.send('request was been created')
    } catch (e) {
        next(e)
    }
})

router.post("/add-abonements", async (req, res, next) => {
    const { title, description, price, lenght_milles, a_time_id } = req.body;
    try {
        await knex("abonements").insert({
            title, description, price, lenght_milles, a_time_id
        })
        res.send("abonement was been created")
    } catch (e) {
        next(e)
    }
});

router.get("/abonement-times", async (req, res, next) => {
    try {
        const abonement_times = await knex.select("*")
        .from("abonement_times")
        res.send(abonement_times)
    } catch (e) {
        next(e)
    }
});

router.get("/abonements", async (req, res, next) => {
    try {
        const abonements = await knex.select("*")
        .from("abonements")
        .leftJoin("abonement_times", "abonement_times.time_id", "abonements.a_time_id");
        res.send(abonements)
    } catch (e) {
        next(e)
    }
});

router.get("/classes", async (req, res, next) => {
    try {
        const classes = await knex.select("*")
        .from("classes")
        .leftJoin("trainers", "trainers.trainer_id", "classes.t_id");
        res.send(classes)
    } catch (e) {
        next(e)
    }
});

router.post("/add-classes", async (req, res, next) => {
    const { title, description, price, t_id, class_time, number_seats} = req.body;
    try {
        await knex("classes").insert({
            title, description, price, t_id, class_time, number_seats
        })
        res.send("classes was been created")
    } catch (e) {
        next(e)
    }
});

router.post('/orders', async (req, res, next) => {
    try {
        const orders = await knex.select("*")
            .from("orders")
            .where("user_id", req.body.user_id)
        res.send(orders)
    } catch (e) {
        next(e)
    }
})

router.post('/decline-order', async (req, res, next) => {
    try {
        const orderId = req.body.order_id
        await knex("orders").where("order_id", orderId).update({
            order_status: "Отменен"
        })
        res.send("Отмена успешна")
    } catch (e) {
        next(e)
    }
})

router.get('/categories', async (req, res, next) => {
    try {
        const categories = await knex.select("*").from("categories")
        res.send(categories)
    } catch (e) {
        next(e)
    }
})

router.get('/products/:id', async (req, res, next) => {
    try {
        const id = req.params.id
        const product = await knex.select("*")
            .from("products")
            .joinRaw("join countries ON countries.country_id = products.c_id", [])
            .joinRaw("join flower_types ON flower_types.type_id = products.t_id", [])
            .joinRaw("join categories ON categories.category_id = products.cat_id", [])
            .where("product_id", id)
        res.send(product[0])
    } catch (e) {
        next(e)
    }
})

router.post('/create-order', async (req, res, next) => {
    try {
        const pwd = req.body.password;

        const orderInfo = req.body.order_info;
        const userId = req.body.user_id;
        const orderName = uuid.v4()
        const id = uuid.v4()

        const user = await knex.select("*").from("users").where("id", userId)

        const validated = await bcrypt.compare(pwd, user[0].password)

        if (!validated) {
            throw ApiError.ValidatingError()
        }

        const deserialized = JSON.parse(orderInfo);

        await knex('orders').insert({
            order_id: id,
            user_id: userId,
            order_info: orderInfo,
            order_name: orderName,
            order_status: "В обработке",
        })


        res.send({ message: "Заказ сформирован" })

    } catch (e) {
        next(e)
    }
})


router.get('/refresh', async (req, res, next) => {
    try {
        const { refreshToken } = req.cookies;

        if (!refreshToken) {
            throw ApiError.UnauthorizedError()
        }

        const userData = tokenService.validateRefreshToken(refreshToken);
        const tokenFromDB = await tokenService.findToken(refreshToken)
        if (!userData || !tokenFromDB) {
            throw ApiError.UnauthorizedError()
        }

        const user = await knex
            .select('*')
            .from('users')
            .where('id', userData.id)

        const userdto = user[0]
        const tokens = tokenService.generateTokens({ ...userdto })
        await tokenService.saveToken(userdto.id, tokens.refreshToken)

        res.cookie('refreshToken', tokens.refreshToken, { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true })
        res.send({ ...tokens, user: userdto })
    } catch (e) {
        next(e)
    }
})

router.get("/all-orders", async (req, res, next) => {
    try {
        const orders = await knex
            .select("*")
            .from("orders")
            .leftJoin("users", "users.id", "orders.user_id")

        res.status(200).send(orders)
    } catch (e) {
        next(e)
    }
})

router.post("/change-order", async (req, res, next) => {
    try {
        const { order_id, order_status, seen, order_json } = req.body

        await knex("orders")
            .where("order_id", order_id)
            .update({
                order_status,
                seen
            })

        if (order_status === "Собирается") {
            await (async function () {
                for await (const obj of order_json) {
                    const available = (obj.quantity - obj.c_quantity) > 0
                    await knex("products").where("product_id", obj.product_id).update({
                        quantity: obj.quantity - obj.c_quantity,
                        available: available
                    })
                }
            })();

            setTimeout(async () => {
                const ord = await knex.select("*").from("orders").where("order_id", order_id)
                if ((ord[0].order_status !== "Отменен") || (ord[0].order_status !== "Отменен администратором")) {
                    await knex('orders').update({
                        order_status: "Готов к выдаче"
                    }).where("order_id", order_id)
                }
            }, 30000)
        }

        res.status(200).send("order was changed")
    } catch (e) {
        next(e)
    }
})

router.get('/additional-info', async (req, res, next) => {
    try {
        const countries = await knex
            .select("*")
            .from("countries")

        const categories = await knex
            .select("*")
            .from("categories")

        const flowerTypes = await knex
            .select("*")
            .from("flower_types")

        res.status(200).json({ categories, countries, types: flowerTypes })
    } catch (e) {
        next(e)
    }
})

router.get('/users', async (req, res, next) => {
    try {
        const users = await knex
            .select("*")
            .from("users")

        res.status(200).send(users)
    } catch (e) {
        next(e)
    }
})

router.get('/trainers', async (req, res, next) => {
    try {
        const trainers = await knex
            .select("*")
            .from("trainers")

        res.status(200).send(trainers)
    } catch (e) {
        next(e)
    }
})

router.get('/trainers/:id', async (req, res, next) => {
    try {
        const trainer = await knex
            .select("*")
            .from("trainers")
            .where('trainer_id', req.params.id)
        console.log(trainer)
        res.status(200).send(trainer[0])
    } catch (e) {
        next(e)
    }
})

router.post('/add-trainer', async (req, res, next) => {
    try {
        const id = uuid.v4()
        await knex("trainers").insert({ ...req.body, trainer_id: id })

        res.status(200).send("trainer has been added")
    } catch (e) {
        next(e)
    }
})

router.post('/change-product', async (req, res, next) => {
    try {
        const { product_id, title, image_url, price, c_id, t_id, cat_id, available, prod_date, quantity } = req.body;
        if (req.body.deleted) {
            await knex("products")
                .where("product_id", product_id)
                .delete()
            res.status(200).send("Товар успешно удален")
        } else {
            if (req.body.product_id) {
                await knex("products")
                    .where("product_id", req.body.product_id)
                    .update({
                        product_id, title, image_url, price, c_id, t_id, cat_id, available, prod_date, quantity
                    })
                res.status(200).json({ product_id })
            } else {
                const id = uuid.v4()
                await knex("products")
                    .insert({
                        product_id: id, title, image_url, price, c_id, t_id, cat_id, available, prod_date, quantity
                    })
                res.status(200).json({ product_id: id })
            }
        }
    } catch (e) {
        next(e)
    }
})

router.post("/upload", async (req, res, next) => {
    try {
        await upload(req, res, async (err) => {
            await knex('products')
                .where("product_id", req.body.product_id)
                .update({
                    image_url: `${req.file.originalname}`
                })
            if (err) {
                res.sendStatus(500);
            }
            res.send(req.file)
        });
    } catch (e) {
        next(e)
    }
}
);

router.post('/change-trainer', async (req, res, next) => {
    try {
        const { trainer_id, fio, department, specification, link_goto, birth_stamp, work_expirince, avatar_url } = req.body;
        if (req.body.deleted) {
            await knex("trainers")
                .where("trainer_id", trainer_id)
                .delete()
            res.status(200).send("Тренер успешно удален")
    } 
    else {
        if (req.body.trainers_id != 0) {
            await knex("trainers")
                .where("trainer_id", req.body.trainer_id)
                .update({
                    trainer_id, fio, department, specification, link_goto, birth_stamp, work_expirince, avatar_url
                });
        } else {
            await knex("trainer")
                .insert({
                    trainer_id, fio, department, specification, link_goto, birth_stamp, work_expirince, avatar_url
                });
        }
    }

    res.status(200).send("Тренер успешно изменен");

} catch (e) {
    next(e);
}
});


router.post('/change-class', async (req, res, next) => {
    try {
        const { deleted, title, description, t_id, class_time, price, number_seats, class_id } = req.body;
        if (deleted) {
            await knex("classes")
                .where("class_id", class_id)
                .delete()
            res.status(200).send("class успешно удален")
    } else {
        await knex("classes")
        .where("class_id", class_id)
        .update({
            title, description, t_id, class_time, price, number_seats
        });
    }

    res.status(200).send("Тренер успешно изменен");

} catch (e) {
    next(e);
}
});



router.put("/requests/:requestId/status", async (req, res) => { 
    const requestId = parseInt(req.params.requestId); 
    const newStatus = req.body.status;

    try {
      await UsersService.updateRequestStatus(requestId, newStatus);
      res.json({ message: "Статус запроса успешно изменен." });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "При изменении статуса запроса произошла ошибка." });
    }
});

router.post('/change-category', async (req, res, next) => {
    try {
        const { category, category_id } = req.body;

        if (req.body.deleted) {
            const hasProducts = await knex.select("*").from("products").where("cat_id", category_id)

            if (hasProducts[0]) {
                throw ApiError.BadRequest("Невозможно удалить. Есть товары с такой категорией!")
            }

            await knex("categories")
                .where("category_id", category_id)
                .delete()
        } else {
            if (req.body.category_id != 0) {
                await knex("categories")
                    .where("category_id", req.body.category_id)
                    .update({
                        category
                    })
            } else {
                await knex("categories")
                    .insert({
                        category
                    })
            }
        }

        res.status(200).send("Товар успешно изменен")
    } catch (e) {
        next(e)
    }
})

module.exports = router