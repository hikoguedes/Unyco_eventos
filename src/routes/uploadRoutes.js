const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');

// POST /api/upload - Upload de imagem para public/uploads/
router.post('/', uploadController.uploadImage);

module.exports = router;
