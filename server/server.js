const PORT = 4001

const express = require('express'), http = require('http');
const controller = require("./controller/controller");
const errorMiddleware = require("./middlewares/error_middleware")
const app = express();
const server = http.createServer(app);

const cors = require('cors');

const cookieParser = require('cookie-parser')
const path = require("path");

app.use(express.json())
app.use(cookieParser())
app.use(cors({credentials: true, origin: ['http://localhost:3000']}))
app.use("/api", controller);
app.use('/public', express.static(path.join(__dirname + '/public')))

app.use(errorMiddleware)

const start = async () => {
    try {
        server.listen(PORT, () => console.log('Server listening on port: ', PORT))
    } catch (e) {
        console.log(e)
    }
}

start()