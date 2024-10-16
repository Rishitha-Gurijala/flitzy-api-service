
const {
    create,
    calculateTransportPrice,
    getProducts,
    getCategories,
    getSlides,
    getOrders,
    storeWishList,
    getWishListItems,
    storeCart,
    getCartListItems,
    getCheckoutItems,
} = require("../controller/userController.js");


function getRoutes() {
    app.get("/user/transportPrice/:userId/:storeId", calculateTransportPrice);
    app.get("/api/products", getProducts);
    app.get("/api/categories", getCategories);
    app.get("/api/slides", getSlides);
    app.get("/api/orders", getOrders);
    app.get("/api/wishlistItems/:userId", getWishListItems);
    app.get("/api/cartItems/:userId", getCartListItems);
    app.get("/api/checkout/:userId/:storeId", getCheckoutItems);
    app.get("/user/create/:userId", create);



    app.post("/api/wishlist", storeWishList);
    app.post("/api/cart", storeCart);
}


module.exports = { 
    getRoutes
};
