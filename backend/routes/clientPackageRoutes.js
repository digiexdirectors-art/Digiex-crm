const express = require('express');
const router = express.Router();
const controller = require('../controllers/clientPackageController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.post('/convert-lead', controller.convertLeadToClient);
router.post('/add-service', controller.addServiceDirectly);
router.put('/update-service/:id', controller.updateServiceDirectly);
router.post('/:id/features', controller.addFeature);
router.put('/:id/features/:featureId', controller.updateFeature);
router.delete('/:id/features/:featureId', controller.deleteFeature);
router.put('/update-expiration/:clientId', controller.updateProjectExpiration);
router.post('/:id/renew', controller.renewClientPackage);
router.get('/expiring-renewals', controller.getExpiringRenewals);
router.get('/', controller.getClientPackages);
router.put('/:id', controller.updateClientPackage);
router.delete('/:id', controller.deleteClientPackage);

module.exports = router;
