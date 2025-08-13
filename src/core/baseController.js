const autoBind = require("auto-bind");

class baseController {
  constructor() {
    autoBind(this);
  }

  async response(
    res,
    statusCode,
    success,
    message,
    data = null,
    errors = null
  ) {
    const responseObject = {
      success,
      message,
      data,
      errors,
    };
    return res.status(statusCode).json(responseObject);
  }
}

module.exports = baseController;
