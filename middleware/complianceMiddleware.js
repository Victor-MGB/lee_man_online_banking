const performAMLCheck = (transactionDetails) => {
  if (transactionDetails.amount > 10000) {
    return {
      passed: false,
      reason: "Transaction amount exceeds AML threshold",
    };
  }
  return { passed: true };
};

const performFATCACheck = (transactionDetails) => {
  const restrictedCountries = ["CountryA", "CountryB"];
  if (restrictedCountries.includes(transactionDetails.toCurrency)) {
    return {
      passed: false,
      reason: "Transaction involves a restricted country under FATCA",
    };
  }
  return { passed: true };
};

const complianceMiddleware = (req, res, next) => {
  const { fromAccountNumber, amount, fromCurrency, toCurrency } = req.body;

  const transactionDetails = {
    fromAccountNumber,
    amount,
    fromCurrency,
    toCurrency,
    date: new Date(),
  };

  const amlResult = performAMLCheck(transactionDetails);
  if (!amlResult.passed) {
    return res.status(400).json({ message: amlResult.reason });
  }

  const fatcaResult = performFATCACheck(transactionDetails);
  if (!fatcaResult.passed) {
    return res.status(400).json({ message: fatcaResult.reason });
  }

  next();
};

module.exports = {
  complianceMiddleware,
};
