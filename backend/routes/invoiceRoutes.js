const express = require('express');
const router = express.Router();
const controller = require('../controllers/invoiceController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.post('/', controller.createInvoice);
router.get('/', controller.getInvoices);
router.get('/clients', controller.getClients);
router.get('/:id', controller.getInvoiceById);
router.put('/:id', controller.updateInvoice);
router.post('/clone/:id', controller.cloneInvoice);
router.delete('/:id', controller.deleteInvoice);

module.exports = router;
