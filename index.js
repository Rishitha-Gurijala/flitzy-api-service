let express = require('express');
global.app = express();
const {
    getRoutes
} = require("./routes/routes.js");

const dotenv = require('dotenv');
dotenv.config();
const PORT = process.env.PORT || 3001;

getRoutes();

app.listen(PORT);
console.log("Listening on port 3000");