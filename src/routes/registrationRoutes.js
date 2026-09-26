const express = require('express');
const router = express.Router();
const registrationController = require('../controllers/registrationController');

// Inscrição pública em evento (aceita tanto /register quanto /registrations)
router.post('/events/:id/register', registrationController.registerForEvent);
router.post('/events/:id/registrations', registrationController.registerForEvent);

// Listar inscritos de um evento
router.get('/events/:id/registrations', registrationController.getEventRegistrations);

// Consultar comprovante por código único
router.get('/registrations/:code', registrationController.getRegistrationByCode);

// Atualizar inscrição
router.put('/registrations/:id', registrationController.updateRegistration);

// Cancelar/Excluir inscrição
router.delete('/registrations/:id', registrationController.deleteRegistration);

module.exports = router;
