const express = require('express');
const router = express.Router();
const {
  createExpense,
  getUserExpenses,
  getExpense,
  updateExpense,
  deleteExpense,
  addComment,
  deleteComment,
  toggleReaction,
} = require('../controllers/expenseController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/', getUserExpenses);
router.post('/', createExpense);
router.get('/:id', getExpense);
router.put('/:id', updateExpense);
router.delete('/:id', deleteExpense);

router.post('/:id/comments', addComment);
router.delete('/:id/comments/:commentId', deleteComment);

router.post('/:id/reactions', toggleReaction);

module.exports = router;
