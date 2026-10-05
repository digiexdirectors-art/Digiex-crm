const express = require('express');
const router = express.Router();
const controller = require('../controllers/clientController');
const authMiddleware = require('../middleware/authMiddleware');

// Public route: client token verification from email link
router.post('/verify-email-link', controller.verifyClientByToken);

router.use(authMiddleware);

router.get('/', controller.getClients);
router.post('/', controller.createClient);
router.get('/my-projects', controller.getMyProjects);
router.get('/:id', controller.getClientById);
router.put('/:id', controller.updateClient);
router.post('/:id/verify', controller.verifyClient);
router.post('/:id/send-verification-email', controller.sendClientVerificationEmailLink);
router.post('/:id/override-verification', controller.overrideVerification);
router.post('/:id/notes', controller.addClientNote);
router.post('/:id/documents', controller.uploadClientDocument);
router.delete('/:id/documents/:docId', controller.deleteClientDocument);

module.exports = router;
