const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const { authorize } = require('../middlewares/authMiddleware');

router.get('/', eventController.getAllEvents);
router.get('/:id', eventController.getEventById);
router.post('/', authorize(['ADMIN', 'REPRESENTANTE']), eventController.createEvent);
router.put('/:id', authorize(['ADMIN', 'REPRESENTANTE']), eventController.updateEvent);
router.delete('/:id', authorize(['ADMIN', 'REPRESENTANTE']), eventController.deleteEvent);

module.exports = router;
