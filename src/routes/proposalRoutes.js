const express = require('express');
const router = express.Router();
const proposalController = require('../controllers/proposalController');
const { authorize } = require('../middlewares/authMiddleware');

router.get('/', proposalController.getAllProposals);
router.get('/:id', proposalController.getProposalById);
router.post('/', authorize(['ADMIN', 'CONSULTOR', 'REPRESENTANTE']), proposalController.createProposal);
router.put('/:id', authorize(['ADMIN', 'CONSULTOR', 'REPRESENTANTE']), proposalController.updateProposal);
router.delete('/:id', authorize(['ADMIN', 'CONSULTOR', 'REPRESENTANTE']), proposalController.deleteProposal);

module.exports = router;
