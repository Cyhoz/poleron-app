const { WebpayPlus } = require('transbank-sdk');
const { Options, IntegrationApiKeys, IntegrationCommerceCodes, Environment } = require('transbank-sdk');

// En producción deberías usar tus credenciales reales en .env
const commerceCode = process.env.WEBPAY_COMMERCE_CODE || IntegrationCommerceCodes.WEBPAY_PLUS;
const apiKey = process.env.WEBPAY_API_KEY || IntegrationApiKeys.WEBPAY;
const environment = process.env.NODE_ENV === 'production' ? Environment.Production : Environment.Integration;

const tx = new WebpayPlus.Transaction(new Options(commerceCode, apiKey, environment));

module.exports = { tx };
