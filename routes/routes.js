
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
    updateLocation
} = require("../controller/userController.js");
const {verifyToken} = require('../middleware/authMiddleware');


function getRoutes() {
    // GET CALLS
    app.get("/user/transportPrice/:userId/:storeId", verifyToken, calculateTransportPrice);
    app.get("/api/products", verifyToken, getProducts);
    app.get("/api/categories", verifyToken, getCategories);
    app.get("/api/slides", verifyToken, getSlides);
    app.get("/api/orders", verifyToken, getOrders);
    app.get("/api/wishlistItems/:userId", verifyToken, getWishListItems);
    app.get("/api/cartItems/:userId", verifyToken, getCartListItems);
    app.get("/api/checkout/:userId/:storeId", verifyToken, getCheckoutItems);
    app.get("/user/create/:userId", verifyToken, create);

    // POST CALLS
    app.post("/api/wishlist", verifyToken, storeWishList);
    app.post("/api/cart", verifyToken, storeCart);
    app.post("/api/updateLocation", verifyToken, updateLocation);
}


module.exports = { 
    getRoutes
};
