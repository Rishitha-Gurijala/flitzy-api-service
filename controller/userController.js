const { mongoConnect } = require("../mongoConnect.js");
var dist = require('geo-distance-js');
const _ = require("lodash");

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

let usersCollection = "users_details";
let storeCollection = "store_details";
let transportCollection = "city_transport_details";
let checkoutCollection = "checkout_details";
let cartCollection = "cart_details";
let wishlistCollection = "wishlist_details";


async function create(req, res) {
    try {
        let userId = req.params.userId;
        let db = await mongoConnect();
        let userExist = await db.collection(usersCollection).findOne({ user_id: userId });
        if (userExist) {
            return res.status(400).json({
                message: "User Exists:"
            });
        } else {
            await db.collection(usersCollection).insertOne({ user_id: userId });
            return res.status(200).send("User inserted");
        }
    } catch (err) {
        res.status(500).json({ error: "Internal Server Error." })
    }
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

async function calculateTransportPrice(req, res) {
    let params = req.params;
    let userId = params.userId;
    let storeId = params.storeId;


    let db = await mongoConnect();
    let userExist = await db.collection(usersCollection).findOne({ user_id: userId });
    let storeExist = await db.collection(storeCollection).findOne({ id: storeId });

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


    if(res == "returnPrice") {
        return price;
    }
    return res.status(200).send(price);
}

async function getProducts(req, response) {  
    WooCommerce.get('products', async function (err, data, res) {
        let rawJson = JSON.parse(res);
        let finalProductsList = getFinalOutputJson(rawJson, constantFields.products);
        finalProductsList = refactorProductsObject(finalProductsList);
        
        let redisKey = 'allCategories'; 
        let categoriesData = await client.get(redisKey);
        categoriesData = JSON.parse(categoriesData);

        let categoriesObject = {};
        for (let cat of categoriesData) {
            let obj = {};
            if (cat.parent) {
                obj = categoriesData.find(o => o.id === cat.parent);
            }
            categoriesObject[cat.id] = obj.name;
        }
        finalProductsList.map((product) => {
            let catId = product.category.id;
            product.subCategory = '';
            if (!categoriesObject[catId]) {
                product.category = [product.category.name]
            } else {
                product.subCategory = product.category.name;
                product.category = [categoriesObject[product.category.id]];
            }
        })

        let redisKeyProd = 'allProducts';
        await client.set(redisKeyProd, JSON.stringify(finalProductsList));
    
        return response.json(finalProductsList);
    })
}

async function getCategories(req, response) {
    WooCommerce.get('products/categories', async function (err, data, res) {
        let rawJson = JSON.parse(res);
        let finalProductsList = getFinalOutputJson(rawJson, constantFields.categories);
        finalProductsList = refactorCategoriesObject(finalProductsList);

    let redisKey = 'allCategories';
    await client.set(redisKey, JSON.stringify(finalProductsList));

    finalProductsList = finalProductsList.filter(o => !o.parent && o.name!="Uncategorized");
    return response.json(finalProductsList);
    })
}

function getSlides(req, res) {
    let finalProductsList = [
        {
            "created_at": "2023-10-06T09:24:24.000000Z",
            "id": 1,
            "image": "https://nurserylive.com/cdn/shop/files/nurserylive-app-home-page-banner-plants-v3_9a4542b8-e6b2-4c88-8c5a-0dc0993fac5f_670x400.jpg?v=1636743230",
            "updated_at": "2023-10-06T09:24:24.000000Z"
        },
        {
            "created_at": "2023-10-06T09:24:31.000000Z",
            "id": 2,
            "image": "https://nurserylive.com/cdn/shop/files/nurserylive-app-home-page-banner-balcony-and-terrace-garden-metal-stand-v3_c1641745-019f-492b-bb98-34fc435c3f8f_670x400.jpg?v=1636743163",
            "updated_at": "2023-10-06T09:24:31.000000Z"
        },
        {
            "created_at": "2023-10-06T09:24:38.000000Z",
            "id": 3,
            "image": "https://nurserylive.com/cdn/shop/files/nurserylive-app-home-page-cactus-and-succulent-banner-v3_1_670x400.jpg?v=1637848499",
            "updated_at": "2023-10-06T09:24:38.000000Z"
        }
    ]
    return res.json(finalProductsList);
}

function getOrders(req, response) {
    WooCommerce.get('orders', function (err, data, res) {
        let rawJson = JSON.parse(res);
        // let finalProductsList = getFinalOutputJson(rawJson, constantFields.categories);
        return response.json(rawJson);
    })
}

async function storeWishList(req, res) {

    let body = req.body; 
    let userId = req?.body?.userId;
    let db = await mongoConnect();
    let userExist = await db.collection(wishlistCollection).findOne({ user_id: userId });
    if(!userExist) {
        await db.collection(wishlistCollection).insertOne({ user_id: userId });
        userExist = { user_id: userId }
    }
    if(body?.operation && body?.operation == 'add') {
        let wishListItems = userExist.wishListItems ? userExist.wishListItems : {};
        wishListItems[body.wishListProduct] = {
            created_on: new Date()
        }
        await db.collection(wishlistCollection).updateOne({ user_id: userId }, {
            $set:{
                wishListItems
            }
        });
        let finalProductsList = [{
            message: "Item added to Wishlist",
            data: wishListItems
        }]
        return res.json(finalProductsList);
    }
    else if(body?.operation && body?.operation == 'delete') {
        let wishListItems = userExist.wishListItems ? userExist.wishListItems : [];
        delete wishListItems[body.wishListProduct];
        await db.collection(wishlistCollection).updateOne({ user_id: userId }, {
            $set:{
                wishListItems
            }
        });
        let finalProductsList = [{
            message: "Item deleted from Wishlist",
            data: wishListItems
        }]
        return res.json(finalProductsList);
    }
}

async function storeCart(req, res) {

    let body = req.body;
    let userId = req?.body?.userId;
    let db = await mongoConnect();
    let userExist = await db.collection(cartCollection).findOne({ user_id: userId });
    if(!userExist) {
        await db.collection(cartCollection).insertOne({ user_id: userId });
        userExist = { user_id: userId }
    }
    let cartItems = userExist.cartItems ? userExist.cartItems : {};
    if(body?.operation && body?.operation == 'add') {
        let quantityOfItem = 1;
        if(body.cartProduct in cartItems) {
            quantityOfItem = cartItems[body.cartProduct].quantity + quantityOfItem;
        }
        cartItems[body.cartProduct] = {
            quantity: quantityOfItem,
            created_on: new Date()
        };
        await db.collection(cartCollection).updateOne({ user_id: userId }, {
            $set:{
                cartItems
            }
        });
        let finalProductsList = [{
            message: "Item added to Cart",
            data: cartItems
        }]
        return res.json(finalProductsList);
    }    
    else if(body?.operation && body?.operation == 'delete') {
        let quantityOfItem = 1;
        if(body.cartProduct in cartItems) {
            quantityOfItem = cartItems[body.cartProduct].quantity - quantityOfItem;
        }
        if(quantityOfItem <= 0) {
            delete cartItems[body.cartProduct];
        } else {
            cartItems[body.cartProduct].quantity = quantityOfItem;
        }
        await db.collection(cartCollection).updateOne({ user_id: userId }, {
            $set:{
                cartItems
            }
        });
        let finalProductsList = [{
            message: "Item deleted from Cart",
            data: cartItems
        }]
        return res.json(finalProductsList);
    }
}

async function  updateLocation (req, res, next)  {
    console.log(JSON.stringify(req.body))
    const { longitude, latitude, pin_save_name, house_name, address, nearby_location, pin_code} = req.body; 
    try {

        let db = await mongoConnect();
        await db.collection(usersCollection).updateOne({ user_id: req.userId}, {$set: { longitude: longitude, latitude: latitude, pin_save_name: pin_save_name, house_name: house_name, address: address, nearby_location: nearby_location, pin_code: pin_code}});

        res.status(200).send(`Address updated successfully`);

    } catch (error) {
        res.status(error?.status || 400).send(error?.message || 'Something went wrong');
    }
};


async function calculateTotalPricesOfProducts(cartItems, allProducts, userExist, storeExist) {
    let regularPrice = 0.00;
    let salePrice = 0.00;
    let cartPrice = 0.00;
    allProducts.map((prod) => {
        if(Object.keys(cartItems).includes(prod.id) ||
            Object.keys(cartItems).includes(prod.id.toString())) {
            regularPrice += (prod.regular_price) * prod.quantity;
            salePrice += (prod.price - prod.regular_price) * prod.quantity;
            cartPrice += (prod.price) * prod.quantity;
        }
    });

    let request = {
        params: {
            userId: userExist.user_id,
            storeId: storeExist.id
        }
    }
    let transportPrice = await calculateTransportPrice(request, "returnPrice");

    return {
        vendorPrice: regularPrice + parseFloat(transportPrice),
        flitzyPrice: salePrice,
        cartPrice,
        transportPrice
    }
}

async function getWishListItems(req, res) {
    let redisKeyProd = 'allProducts';
    let allProducts = await client.get(redisKeyProd);
    allProducts = JSON.parse(allProducts);

    let userId = req.params.userId;

    let db = await mongoConnect();
    let userExist = await db.collection(wishlistCollection).findOne({ user_id: userId });
    let wishListItems = userExist.wishListItems;
    let finalProductsList = [];
    allProducts.map((prod) => {
        if(Object.keys(wishListItems).includes(prod.id)||
                Object.keys(wishListItems).includes(prod.id.toString())) {
            finalProductsList.push(prod);
        }
    })
    return res.json(finalProductsList);


    
}

async function getCartListItems(req, res) {
    let redisKeyProd = 'allProducts';
    let allProducts = await client.get(redisKeyProd);
    allProducts = JSON.parse(allProducts);

    let userId = req.params.userId;

    let db = await mongoConnect();
    let userExist = await db.collection(cartCollection).findOne({ user_id: userId });
    let cartItems = userExist.cartItems;
    let finalProductsList = [];
    allProducts.map((prod) => {
        if(Object.keys(cartItems).includes(prod.id) ||
            Object.keys(cartItems).includes(prod.id.toString())) {
            prod.quantity = cartItems[prod.id].quantity;
            finalProductsList.push(prod);
        }
    })
    return res.json(finalProductsList);
}

async function getCheckoutItems(req, res) {
    let redisKeyProd = 'allProducts';
    let allProducts = await client.get(redisKeyProd);
    allProducts = JSON.parse(allProducts);

    let userId = req.params.userId;
    let storeId = req.params.storeId;

    let db = await mongoConnect();
    let userExist = await db.collection(cartCollection).findOne({ user_id: userId });
    let storeExist = await db.collection(storeCollection).findOne({ id: storeId });
    
    let cartItems = userExist.cartItems;
    let finalProductsList = [];
    allProducts.map((prod) => {
        if(Object.keys(cartItems).includes(prod.id) ||
                Object.keys(cartItems).includes(prod.id.toString())) {
            prod.quantity = cartItems[prod.id].quantity;
            finalProductsList.push(prod);
        }
    });
    let totalPrices = await calculateTotalPricesOfProducts(cartItems, allProducts, userExist, storeExist);
    let checkoutDetails = {
        products: finalProductsList,
        cartPrice: totalPrices.cartPrice,
        flitzyPrice: totalPrices.flitzyPrice,
        vendorPrice: totalPrices.vendorPrice,
        transportPrice: totalPrices.transportPrice,
        user_id: userId,
        store_id: storeId
    }
    checkoutDetails.created_date = new Date();
    await db.collection(checkoutCollection).insertOne(checkoutDetails);

    return res.json(checkoutDetails);
}

function refactorProductsObject(finalProductsList) {
    let finalList = [];
    for(let prod of finalProductsList) {
        let eachProd = prod;
        eachProd.image = prod.images[0].src;
        eachProd.category = prod.categories[0];
        delete eachProd.categories;
        delete eachProd.images;
        updatePrices(eachProd);
        finalList.push(eachProd);
    }
    return finalList;
}

function updatePrices(eachProd) {
    let actualPrice = parseFloat(eachProd.price);

    let discount = actualPrice * constantFields.DISCOUNT;
    let margin = actualPrice * constantFields.MARGIN;


    let regularPrice = actualPrice + discount + margin;
    let salePrice = actualPrice + margin;

    eachProd.price = salePrice;
    eachProd.regular_price = actualPrice;
    eachProd.sale_price = regularPrice;

    return eachProd;
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

function refactorCategoriesObject(finalProductsList) {
    let finalList = [];
    for(let prod of finalProductsList) {
        let eachProd = prod;
        let image = prod.image;
        if(image) {
            eachProd.image = image.src;
            eachProd.created_at = image.date_created;
            eachProd.updated_at = image.date_modified;
        }
        finalList.push(eachProd);
    }
    return finalList;
}

module.exports = {
    create,
    calculateTransportPrice,
    getCategories,
    getOrders,
    getSlides,
    storeWishList,
    getWishListItems,
    storeCart,
    getCartListItems,
    getCheckoutItems,
    getProducts,
    updateLocation
};
