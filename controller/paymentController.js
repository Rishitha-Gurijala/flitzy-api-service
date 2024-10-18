const { mongoConnect } = require("../mongoConnect.js");
var dist = require('geo-distance-js');
const _ = require("lodash");
const axios = require("axios");
const sha256 = require("sha256");
const uniqid = require("uniqid");
const dotenv = require('dotenv');
dotenv.config();

const WooCommerceApi = require('woocommerce-api');
const wooConfig = require('../wooConfig.js');
const constantFields = require('../constantFields.js');


const WooCommerce = new WooCommerceApi({
    url: wooConfig.siteUrl,
    consumerKey: wooConfig.consumerKey,
    consumerSecret: wooConfig.consumerSecret,
    wpAPI: true,
    version: "wc/v1"
});


let checkoutCollection = "checkout_details";
let transactionHistory = "transaction_history";

async function initiatePayment(req, res) {
    // Initiate a payment
  
    // Transaction amount
    let amount = req?.body?.amount;
    let phone = req?.body?.phone;
    let userId = req?.body?.userId;
    let storeId = req?.body?.storeId;
    let merchantTransactionId = req?.body?.merchantTransactionId;
  
    // redirect url => phonePe will redirect the user to this url once payment is completed. It will be a GET request, since redirectMode is "REDIRECT"
    let normalPayLoad = {
      merchantId: process.env.MERCHANT_ID, //* PHONEPE_MERCHANT_ID . Unique for each account (private)
      merchantTransactionId: merchantTransactionId,
      merchantUserId: userId,
      amount: amount * 100, // converting to paise
      redirectUrl: `${process.env.APP_BASE_URL}:${process.env.PORT}/payment/validate/${merchantTransactionId}`,
      redirectMode: 'REDIRECT',
      mobileNumber: phone,
      paymentInstrument: {
        type: "PAY_PAGE",
      },
    };
  
    // make base64 encoded payload
    let bufferObj = Buffer.from(JSON.stringify(normalPayLoad), "utf8");
    let base64EncodedPayload = bufferObj.toString("base64");
  
    // X-VERIFY => SHA256(base64EncodedPayload + "/pg/v1/pay" + SALT_KEY) + ### + SALT_INDEX
    let string = base64EncodedPayload + "/pg/v1/pay" + process.env.SALT_KEY;
    let sha256_val = sha256(string);
    let xVerifyChecksum = sha256_val + "###" + process.env.SALT_INDEX;
    let db = await mongoConnect();
  
    axios
      .post(
        `${process.env.PHONE_PE_HOST_URL}/pg/v1/pay`,
        {
          request: base64EncodedPayload,
        },
        {
          headers: {
            "Content-Type": "application/json",
            "X-VERIFY": xVerifyChecksum,
            accept: "application/json",
          },
        }
      )
      .then(async function (response) {
        console.log("response->", JSON.stringify(response.data));
        
        let transactionHistoryData = {
            userId: userId,
            storeId: storeId,
            amount: amount,
            phone: phone,
            merchantTransactionId: merchantTransactionId,
            created_date: new Date(),
            isTransactionSuccessful: true
        }
        await db.collection(transactionHistory).insertOne(transactionHistoryData);
        await db.collection(checkoutCollection).updateOne({store_id: storeId, merchantTransactionId: merchantTransactionId}, {$set:{isTransactionSuccessful: true}});
        res.send(response.data.data.instrumentResponse.redirectInfo.url);
      })
      .catch(async function (error) {
        await db.collection(checkoutCollection).updateOne({store_id: storeId, merchantTransactionId: merchantTransactionId}, {$set:{isTransactionSuccessful: false}});
        res.send(error);
      });
  };

  async function verifyPaymentStatus(req, res) {
    const { merchantTransactionId } = req.query;
    // check the status of the payment using merchantTransactionId
    if (merchantTransactionId) {
      let statusUrl =
        `${process.env.PHONE_PE_HOST_URL}/pg/v1/status/${process.env.MERCHANT_ID}/` +
        merchantTransactionId;
  
      // generate X-VERIFY
      let string =
        `/pg/v1/status/${process.env.MERCHANT_ID}/` + merchantTransactionId + process.env.SALT_KEY;
      let sha256_val = sha256(string);
      let xVerifyChecksum = sha256_val + "###" + process.env.SALT_INDEX;
      let db = await mongoConnect();
  
      axios
        .get(statusUrl, {
          headers: {
            "Content-Type": "application/json",
            "X-VERIFY": xVerifyChecksum,
            "X-MERCHANT-ID": merchantTransactionId,
            accept: "application/json",
          },
        })
        .then(async function (response) {
          console.log("response->", response.data);
          if (response.data && response.data.code === "PAYMENT_SUCCESS") {
            // redirect to FE payment success status page
            await db.collection(checkoutCollection).updateOne({merchantTransactionId: merchantTransactionId}, {$set:{isTransactionSuccessful: true}});
            await db.collection(transactionHistory).updateOne({merchantTransactionId: merchantTransactionId}, {$set:{isTransactionSuccessful: true}});
            res.send(response.data);
          } else {
            // redirect to FE payment failure / pending status page
            await db.collection(checkoutCollection).updateOne({merchantTransactionId: merchantTransactionId}, {$set:{isTransactionSuccessful: false}});
            await db.collection(transactionHistory).updateOne({merchantTransactionId: merchantTransactionId}, {$set:{isTransactionSuccessful: false}});
            return res.status(500).json({
                message: `transaction with merchant id ${merchantTransactionId} has been failed!!!`
            });
          }
        })
        .catch(function (error) {
          // redirect to FE payment failure / pending status page
          res.send(error);
        });
    } else {
      res.send("Sorry!! Error");
    }
  };


module.exports = {
    initiatePayment,
    verifyPaymentStatus
};
