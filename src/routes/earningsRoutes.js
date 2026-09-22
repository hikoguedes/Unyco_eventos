/**
 * UNYCO Esporte - Earnings & Commissions Routes
 */
const express = require('express');
const router = express.Router();
const earningsController = require('../controllers/earningsController');
const { authorize } = require('../middlewares/authMiddleware');

// Extrato e Ganhos Consolidado dos Parceiros
router.get('/', earningsController.getConsolidatedEarnings);
router.get('/partner/:partnerId', earningsController.getPartnerEarningsStatement);
router.put('/partner/:partnerId/commissions', authorize(['ADMIN']), earningsController.updatePartnerCommissionRates);

// Leads e Reservas de Hotelaria
router.get('/hotel-leads', earningsController.getAllHotelLeads);
router.post('/hotel-leads', authorize(['ADMIN', 'CONSULTOR', 'REPRESENTANTE']), earningsController.createHotelLead);
router.put('/hotel-leads/:id/status', authorize(['ADMIN', 'CONSULTOR']), earningsController.updateHotelLeadStatus);

module.exports = router;
