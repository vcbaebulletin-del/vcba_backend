const { NotFoundError } = require('./errorHandler');

const notFoundHandler = (req, res, next) => {
  const message = `Route ${req.originalUrl} not found`;
  next(new NotFoundError(message));
};

module.exports = notFoundHandler;
