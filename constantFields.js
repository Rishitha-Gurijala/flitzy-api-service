const constantFields = {
    products: [
        'id',
        'name',
        'weight',
        'price',
        'regular_price',
        'sale_price',
        'rating_count',
        'images',
        'average_rating',
        'short_description',
        'description',
        'categories',
        'stock_quantity'
    ],
    categories: [
        'id',
        'name',
        'parent',
        'image'
    ],
    DISCOUNT: 0.5, // 50%
    MARGIN: 0.1 // 10%
};
module.exports = constantFields;