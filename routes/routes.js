
const {
    create,
    calculatePrice,
    getProductsWoo
} = require("../controller/userController.js");


function getRoutes() {
    app.get("/user/transportPrice/:userId/:storeId", calculatePrice);
    app.get("/getProducts", getProductsWoo);
    app.get("/user/create/:userId", create);
}


module.exports = { 
    getRoutes
};
