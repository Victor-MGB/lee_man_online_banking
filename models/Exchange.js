const mongoose = require("mongoose");

const exchangeRateSchema = new mongoose.Schema({
  baseCurrency: { type: String, required: true },
  targetCurrency: { type: String, required: true },
  rate: { type: Number, required: true },
  lastUpdated: { type: Date, default: Date.now },
});

module.exports = mongoose.model("ExchangeRate", exchangeRateSchema);
