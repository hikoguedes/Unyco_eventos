/**
 * UNYCO Esporte - Auth Routes
 */
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate, authorize } = require('../middlewares/authMiddleware');

// Rotas públicas e de identificação
router.post('/login', authController.login);
router.get('/me', authenticate, authController.getMe);
router.post('/switch-user', authController.switchUser);

// Rotas de gestão de operadores (Exclusivo Administrador Geral)
router.get('/users', authenticate, authController.getAllUsers);
router.post('/users', authenticate, authorize(['ADMIN']), authController.createUser);
router.put('/users/:id', authenticate, authorize(['ADMIN']), authController.updateUser);
router.delete('/users/:id', authenticate, authorize(['ADMIN']), authController.deleteUser);

module.exports = router;
