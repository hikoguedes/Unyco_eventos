const express = require('express');
const router = express.Router();
const partnerController = require('../controllers/partnerController');
const { authorize } = require('../middlewares/authMiddleware');

router.get('/', partnerController.getAllPartners);
router.get('/:id', partnerController.getPartnerById);
router.post('/', authorize(['ADMIN', 'REPRESENTANTE']), partnerController.createPartner);
router.put('/:id', authorize(['ADMIN', 'REPRESENTANTE']), partnerController.updatePartner);
router.delete('/:id', authorize(['ADMIN', 'REPRESENTANTE']), partnerController.deletePartner);

module.exports = router;
