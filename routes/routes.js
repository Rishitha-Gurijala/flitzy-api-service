
const {
    create,
    calculatePrice,
    getProductsWoo,
    getCategories,
    getOrders,
} = require("../controller/userController.js");


function getRoutes() {
    app.get("/user/transportPrice/:userId/:storeId", calculatePrice);
    app.get("/api/products", getProductsWoo);
    app.get("/api/categories", getCategories);
    app.get("/api/orders", getOrders);
    app.get("/user/create/:userId", create);
}


module.exports = { 
    getRoutes
};
