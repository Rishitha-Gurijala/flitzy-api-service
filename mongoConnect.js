
const MongoClient = require('mongodb').MongoClient;
const dotenv = require('dotenv');
dotenv.config();

const url = process.env.MONGO_URL;
const dbName = process.env.DB_NAME;
let db;

MongoClient.connect(url).then(client => {
    console.log("Connected successfully to server");
    db = client.db(dbName);
});

async function mongoConnect() {
    return db;
}

module.exports = { mongoConnect };
