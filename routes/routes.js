
const {
    create,
    calculatePrice,
    getProducts,
    getCategories,
    getSlides,
    getOrders,
    storeWishList,
} = require("../controller/userController.js");


function getRoutes() {
    app.get("/user/transportPrice/:userId/:storeId", calculatePrice);
    app.get("/api/products", getProducts);
    app.get("/api/categories", getCategories);
    app.get("/api/slides", getSlides);
    app.get("/api/orders", getOrders);
    app.post("/api/wishlist", storeWishList);
    app.get("/user/create/:userId", create);
}


module.exports = { 
    getRoutes
};
