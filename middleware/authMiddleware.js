const jwt = require('jsonwebtoken');
const asyncRedis = require("async-redis");
const redisClient = asyncRedis.createClient({
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT, // default Redis port
});

  
  redisClient.on("connect", () => {
    console.log("Connected to Redis server");
  });
  
  // Handle Redis connection errors
  redisClient.on("error", (error) => {
    console.error("Redis connection error:", error);
  });
async function verifyToken(req, res, next) {
    const token = req.header('Authorization');
    if (!token) return res.status(401).json({ error: 'Access denied' });
    try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.user_id;
    let inPutUserId = req.userId;
    const resultToken = await redisClient.get(inPutUserId);
    if(token == resultToken){
    next();
    }else{
        res.status(401).json({ error: 'Invalid token' });
    }
    } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
 }
}

module.exports = {verifyToken}