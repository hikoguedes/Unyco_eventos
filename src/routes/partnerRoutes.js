const express = require('express');
const router = express.Router();
const partnerController = require('../controllers/partnerController');
const { authorize } = require('../middlewares/authMiddleware');

// Rotas do Portal do Parceiro
router.post('/portal/login', partnerController.loginPortal);
router.get('/:id/portal-summary', partnerController.getPartnerPortalSummary);
router.put('/:id/banking', partnerController.updatePartnerBanking);
router.put('/:id/password', partnerController.updatePartnerPassword);

// Rotas Administrativas e Gerais
router.get('/', partnerController.getAllPartners);
router.get('/:id', partnerController.getPartnerById);
router.get('/:id/wallet', partnerController.getPartnerWallet);
router.post('/', authorize(['ADMIN', 'REPRESENTANTE']), partnerController.createPartner);
router.put('/:id', authorize(['ADMIN', 'REPRESENTANTE']), partnerController.updatePartner);
router.delete('/:id', authorize(['ADMIN', 'REPRESENTANTE']), partnerController.deletePartner);

module.exports = router;

