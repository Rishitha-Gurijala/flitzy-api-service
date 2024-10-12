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

function getProducts(req, response) {
    WooCommerce.get('products', function (err, data, res) {
        let rawJson = JSON.parse(res);
        let finalProductsList = getFinalOutputJson(rawJson, constantFields.products);
        finalProductsList = refactorProductsObject(finalProductsList);
        return response.json(finalProductsList);
    })
}

function refactorProductsObject(finalProductsList) {
    let finalList = [];
    for(let prod of finalProductsList) {
        let eachProd = prod;
        eachProd.image = prod.images[0].src;
        eachProd.category = [prod.categories[0].name];
        delete eachProd.categories;
        delete eachProd.images;
        finalList.push(eachProd);
    }
    return finalList;
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
        finalProductsList = refactorCategoriesObject(finalProductsList);
        return response.json(finalProductsList);
    })
}

function refactorCategoriesObject(finalProductsList) {
    let finalList = [];
    for(let prod of finalProductsList) {
        let eachProd = {};
        eachProd.id = prod.id;
        eachProd.name = prod.name;
        let image = prod.image;
        if(image) {
            eachProd.image = image.src;
            eachProd.created_at = image.date_created;
            eachProd.updated_at = image.date_modified;
            finalList.push(eachProd);
        }
    }
    return finalList;
}

function getSlides(req, res) {
    let finalProductsList =[{"created_at": "2023-10-06T09:24:24.000000Z", "id": 1, "image": "https://dine-hub.rn-admin.site/storage/N1uHQjbLRjFdDm46nMC5UjJHPfhhZgvrPfUJ8HS2.png", "updated_at": "2023-10-06T09:24:24.000000Z"}, {"created_at": "2023-10-06T09:24:31.000000Z", "id": 2, "image": "https://dine-hub.rn-admin.site/storage/TbyfNs5en7Ppcbrag2Blzi8qAK8sqpW8VfLQH6tW.png", "updated_at": "2023-10-06T09:24:31.000000Z"}, {"created_at": "2023-10-06T09:24:38.000000Z", "id": 3, "image": "https://dine-hub.rn-admin.site/storage/xyOj6UP0VbncyzZdkQdKBmFTOVU3OkXscyZPQLpj.png", "updated_at": "2023-10-06T09:24:38.000000Z"}]
    return res.json(finalProductsList);
}


function getOrders(req, response) {
    WooCommerce.get('orders', function (err, data, res) {
        let rawJson = JSON.parse(res);
        // let finalProductsList = getFinalOutputJson(rawJson, constantFields.categories);
        return response.json(rawJson);
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
    getOrders,
    getSlides,
    getProducts
};
