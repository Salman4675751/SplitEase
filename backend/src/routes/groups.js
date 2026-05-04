const express = require('express');
const router = express.Router();
const {
  getGroups,
  createGroup,
  getGroup,
  updateGroup,
  deleteGroup,
  addMember,
  removeMember,
  getGroupBalances,
} = require('../controllers/groupController');
const { getGroupExpenses } = require('../controllers/expenseController');
const { getGroupSettlements } = require('../controllers/settlementController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/', getGroups);
router.post('/', createGroup);
router.get('/:id', getGroup);
router.put('/:id', updateGroup);
router.delete('/:id', deleteGroup);

router.post('/:id/members', addMember);
router.delete('/:id/members/:userId', removeMember);

router.get('/:id/balances', getGroupBalances);
router.get('/:groupId/expenses', getGroupExpenses);
router.get('/:groupId/settlements', getGroupSettlements);

module.exports = router;
