/**
 * UNYCO Esporte - Hotel Routes
 */
const express = require('express');
const router = express.Router();
const hotelController = require('../controllers/hotelController');
const { authorize } = require('../middlewares/authMiddleware');

// Curadoria Geral de Hotéis
router.get('/', hotelController.getAllHotels);
router.get('/:id', hotelController.getHotelById);
router.post('/', authorize(['ADMIN', 'CONSULTOR']), hotelController.createHotel);
router.put('/:id', authorize(['ADMIN', 'CONSULTOR']), hotelController.updateHotel);
router.delete('/:id', authorize(['ADMIN', 'CONSULTOR']), hotelController.deleteHotel);

// Hotéis vinculados a Eventos
router.get('/event/:eventId', hotelController.getHotelsByEvent);
router.post('/event/:eventId/link', authorize(['ADMIN', 'CONSULTOR']), hotelController.linkHotelToEvent);
router.delete('/event/:eventId/link/:hotelId', authorize(['ADMIN', 'CONSULTOR']), hotelController.unlinkHotelFromEvent);

module.exports = router;
