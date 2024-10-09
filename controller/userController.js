const { mongoConnect } = require("../mongoConnect.js");
var dist = require('geo-distance-js');

const WooCommerceApi = require('woocommerce-api');
const wooConfig = require('../wooConfig');
const constantFields = require('../constantFields.js');




const WooCommerce = new WooCommerceApi({
    url: wooConfig.siteUrl,
    consumerKey: wooConfig.consumerKey,
    consumerSecret: wooConfig.consumerSecret,
    wpAPI: true,
    version: "wc/v1"
});


async function create(req, res) {
    try {
        let userId = req.params.userId;
        var collection = "users_details";
        let db = await mongoConnect();
        let userExist = await db.collection(collection).findOne({ user_id: userId });
        if (userExist) {
            return res.status(400).json({
                message: "User Exists:"
            });
        } else {
            await db.collection(collection).insertOne({ user_id: userId });
            return res.status(200).send("User inserted");
        }
    } catch (err) {
        res.status(500).json({ error: "Internal Server Error." })
    }
}

async function calculatePrice(req, res) {
    let params = req.params;
    let userId = params.userId;
    let storeId = params.storeId;

    let usersCollection = "users_details";
    let storeCollection = "store_details";
    let transportCollection = "city_transport_details";

    let db = await mongoConnect();
    let userExist = await db.collection(usersCollection).findOne({ user_id: userId });
    let storeExist = await db.collection(storeCollection).findOne({ store_reg_id: storeId });

    if (!userExist) {
        return res.status(500).json({ error: "Invalid User" })
    }
    if (!storeExist) {
        return res.status(500).json({ error: "Invalid Store" })
    }

    let distance = dist.getDistance(
        storeExist.latitude,
        storeExist.longitude,
        userExist.latitude,
        userExist.longitude
    );
    let qwe = distance / 1000;
    distance = Math.round(distance / 1000);

    let cityOfStore = storeExist.city;
    let transportPerCity = await db.collection(transportCollection).find({ city: cityOfStore }).toArray();


    let price = calculatePriceFromDistance(distance, transportPerCity);


    return res.status(200).send(price);
}

function getProductsWoo(req, response) {
    WooCommerce.get('products', function (err, data, res) {
        let rawJson = JSON.parse(res);
        let finalProductsList = getFinalOutputJson(rawJson, constantFields.products);
        return response.json(finalProductsList);
    })
}


function getFinalOutputJson(rawJson, requiredIds) {
    let finalProductsList = [];
    rawJson.map((i) => {
        let resObj = {};
        for (let field of Object.keys(i)) {
            if (requiredIds.includes(field)) {
                resObj[field] = i[field];
            }
        }
        finalProductsList.push(resObj);
    });
    return finalProductsList;
}

function getCategories(req, response) {
    WooCommerce.get('products/categories', function (err, data, res) {
        let rawJson = JSON.parse(res);
        let finalProductsList = getFinalOutputJson(rawJson, constantFields.categories);
        return response.json(finalProductsList);
    })
}



function calculatePriceFromDistance(distance, transportPerCity) {
    for (let transp of transportPerCity) {
        let slabSplit = transp.slab.split('-');
        let lowerLimit = parseInt(slabSplit[0]);
        let higherLimit = parseInt(slabSplit[1]);
        if (distance > lowerLimit && distance <= higherLimit) {
            return transp.price;
        }
    }
    return '10';

}

module.exports = {
    create,
    calculatePrice,
    getCategories,
    getProductsWoo
};
