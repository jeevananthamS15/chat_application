const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  // Get token from header (e.g., axios.defaults.headers.common['x-auth-token'])
  const token = req.header('x-auth-token');

  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.user; // { id: '...', username: '...' }
    next();
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
  }
};