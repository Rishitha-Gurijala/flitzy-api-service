let express = require('express');
global.app = express();
const {
    getRoutes
} = require("./routes/routes.js");

let {createClient} = require('redis');
global.client = createClient();
client.on('error', err => console.log('Redis Client Error', err));
client.connect();

const dotenv = require('dotenv');
dotenv.config();
const PORT = process.env.PORT || 3001;

getRoutes();

app.listen(PORT);
console.log("Listening on port 3000");