const express = require('express');
const router = express.Router();
const {
  getProfile,
  updateProfile,
  changePassword,
  searchUsers,
  getBalanceSummary,
  markNotificationsRead,
  updatePaymentMethods,
  getUserPaymentMethods,
  getFriends,
} = require('../controllers/userController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.put('/password', changePassword);
router.get('/search', searchUsers);
router.get('/balance-summary', getBalanceSummary);
router.put('/notifications/read', markNotificationsRead);

router.put('/me/payment-methods', updatePaymentMethods);
router.get('/me/friends', getFriends);
router.get('/:id/payment-methods', getUserPaymentMethods);

module.exports = router;
