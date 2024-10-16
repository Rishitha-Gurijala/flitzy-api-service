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

    let usersCollection = "users_details";
    let storeCollection = "store_details";
    let transportCollection = "city_transport_details";

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

    finalProductsList = finalProductsList.filter(o => !o.parent);
    return response.json(finalProductsList);
    })
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

async function storeWishList(req, res) {
    let collection = "users_details";

    let body = req.body; 
    let userId = req?.body?.userId;
    let db = await mongoConnect();
    let userExist = await db.collection(collection).findOne({ user_id: userId });
    if(body?.operation && body?.operation == 'add' && userExist) {
        let wishListItems = userExist.wishListItems ? userExist.wishListItems : [];
        wishListItems.push(body.wishListProduct);
        wishListItems = _.uniq(wishListItems);
        await db.collection(collection).updateOne({ user_id: userId }, {
            $set:{
                wishListItems
            }
        });
        let finalProductsList = [{
            message: "Item added to Wishlist"
        }]
        return res.json(finalProductsList);
    }
    else if(body?.operation && body?.operation == 'delete' && userExist) {
        let wishListItems = userExist.wishListItems ? userExist.wishListItems : [];
        wishListItems = wishListItems.filter(function(item) {
            return item !== body.wishListProduct
        })
        await db.collection(collection).updateOne({ user_id: userId }, {
            $set:{
                wishListItems
            }
        });
        let finalProductsList = [{
            message: "Item deleted from Wishlist"
        }]
        return res.json(finalProductsList);
    }
}

async function storeCart(req, res) {
    let collection = "users_details";

    let body = req.body;
    let userId = req?.body?.userId;
    let db = await mongoConnect();
    let userExist = await db.collection(collection).findOne({ user_id: userId });
    let cartItems = userExist && userExist.cartItems ? userExist.cartItems : {};
    if(body?.operation && body?.operation == 'add' && userExist) {
        let quantityOfItem = 1;
        if(body.cartProduct in cartItems) {
            quantityOfItem = cartItems[body.cartProduct] + quantityOfItem;
        }
        cartItems[body.cartProduct] = quantityOfItem;
        await db.collection(collection).updateOne({ user_id: userId }, {
            $set:{
                cartItems
            }
        });
    }    
    else if(body?.operation && body?.operation == 'delete' && userExist) {
        let quantityOfItem = 1;
        if(body.cartProduct in cartItems) {
            quantityOfItem = cartItems[body.cartProduct] - quantityOfItem;
        }
        if(quantityOfItem <= 0) {
            delete cartItems[body.cartProduct];
        } else {
            cartItems[body.cartProduct] = quantityOfItem;
        }
        await db.collection(collection).updateOne({ user_id: userId }, {
            $set:{
                cartItems
            }
        });
    }
    return res.json(cartItems);
}

async function  updateLocation (req, res, next)  {
    console.log(JSON.stringify(req.body))
    const { longitude, latitude, pin_save_name, house_name, address, nearby_location, pin_code} = req.body; 
    try {


        var userCollection = "users_details";
        let db = await mongoConnect();
        await db.collection(userCollection).updateOne({ user_id: req.userId}, {$set: { longitude: longitude, latitude: latitude, pin_save_name: pin_save_name, house_name: house_name, address: address, nearby_location: nearby_location, pin_code: pin_code}});

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
            regularPrice += prod.regular_price;
            salePrice += prod.price - prod.regular_price;
            cartPrice += prod.price;
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
    let collection = "users_details"

    let userId = req.params.userId;

    let db = await mongoConnect();
    let userExist = await db.collection(collection).findOne({ user_id: userId });
    let wishListItems = userExist.wishListItems;
    let finalProductsList = [];
    allProducts.map((prod) => {
        if(wishListItems.includes(prod.id)) {
            finalProductsList.push(prod);
        }
    })
    return res.json(finalProductsList);


    
}

async function getCartListItems(req, res) {
    let redisKeyProd = 'allProducts';
    let allProducts = await client.get(redisKeyProd);
    allProducts = JSON.parse(allProducts);
    let collection = "users_details"

    let userId = req.params.userId;

    let db = await mongoConnect();
    let userExist = await db.collection(collection).findOne({ user_id: userId });
    let cartItems = userExist.cartItems;
    let finalProductsList = [];
    allProducts.map((prod) => {
        if(Object.keys(cartItems).includes(prod.id) ||
            Object.keys(cartItems).includes(prod.id.toString())) {
            finalProductsList.push(prod);
        }
    })
    return res.json(finalProductsList);
}

async function getCheckoutItems(req, res) {
    let redisKeyProd = 'allProducts';
    let allProducts = await client.get(redisKeyProd);
    allProducts = JSON.parse(allProducts);
    let collection = "users_details";
    let storeCollection = "store_details";

    let userId = req.params.userId;
    let storeId = req.params.storeId;

    let db = await mongoConnect();
    let userExist = await db.collection(collection).findOne({ user_id: userId });
    let storeExist = await db.collection(storeCollection).findOne({ id: storeId });
    
    let cartItems = userExist.cartItems;
    let finalProductsList = [];
    allProducts.map((prod) => {
        if(Object.keys(cartItems).includes(prod.id) ||
                Object.keys(cartItems).includes(prod.id.toString())) {
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
    await db.collection('checkout_details').insertOne(checkoutDetails);

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
