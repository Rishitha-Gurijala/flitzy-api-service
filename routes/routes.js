
const {
    create,
    calculatePrice,
    getProducts,
    getCategories,
    getSlides,
    getOrders,
    updateLocation
} = require("../controller/userController.js");
const {verifyToken} = require('../middleware/authMiddleware');


function getRoutes() {
    app.get("/user/transportPrice/:userId/:storeId",verifyToken,  calculatePrice);
    app.get("/api/products", verifyToken, getProducts);
    app.get("/api/categories", verifyToken, getCategories);
    app.get("/api/slides", verifyToken, getSlides);
    app.get("/api/orders", verifyToken, getOrders);
    app.get("/user/create/:userId", verifyToken, create);
    app.post("/api/updateLocation", verifyToken, updateLocation);
}


module.exports = { 
    getRoutes
};
