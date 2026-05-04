const express = require('express');
const router = express.Router();
const {
  createSettlement,
  getUserSettlements,
  deleteSettlement,
} = require('../controllers/settlementController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/', getUserSettlements);
router.post('/', createSettlement);
router.delete('/:id', deleteSettlement);

module.exports = router;
