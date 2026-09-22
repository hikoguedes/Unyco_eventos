const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { authorize } = require('../middlewares/authMiddleware');

router.get('/', categoryController.getAllCategories);
router.get('/:id', categoryController.getCategoryById);
router.post('/', authorize(['ADMIN', 'REPRESENTANTE']), categoryController.createCategory);
router.put('/:id', authorize(['ADMIN', 'REPRESENTANTE']), categoryController.updateCategory);
router.delete('/:id', authorize(['ADMIN', 'REPRESENTANTE']), categoryController.deleteCategory);

module.exports = router;
