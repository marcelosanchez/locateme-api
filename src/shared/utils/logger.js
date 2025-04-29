const isDevelopment = process.env.NODE_ENV === 'development';

exports.log = (...args) => {
  if (isDevelopment) {
    console.log(...args);
  }
};

exports.error = (...args) => {
  console.error(...args);
};
