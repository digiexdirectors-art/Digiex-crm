const Role = require('../models/Role');
const AuditLog = require('../models/AuditLog');

// Helper for logging
const createAuditLog = async (action, module, documentId, details) => {
  try {
    await AuditLog.create({ action, module, documentId, details });
  } catch (error) {
    console.error('Audit Log Error:', error);
  }
};

// Create a new role
exports.createRole = async (req, res) => {
  try {
    const { name, userType, department, description, permissions } = req.body;
    const newRole = new Role({ name, userType, department, description, permissions });
    const savedRole = await newRole.save();
    
    await createAuditLog('CREATE', 'ROLE', savedRole._id, savedRole);
    
    res.status(201).json({ success: true, data: savedRole });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Get all roles
exports.getRoles = async (req, res) => {
  try {
    const filters = {};
    if (req.query.department) filters.department = req.query.department;
    if (req.query.userType) filters.userType = req.query.userType;
    if (req.query.isActive !== undefined) filters.isActive = req.query.isActive;

    const roles = await Role.find(filters).populate('userType department');
    res.status(200).json({ success: true, data: roles });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get role by ID
exports.getRoleById = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }
    res.status(200).json({ success: true, data: role });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update role
exports.updateRole = async (req, res) => {
  try {
    const updatedRole = await Role.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!updatedRole) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }

    await createAuditLog('UPDATE', 'ROLE', updatedRole._id, req.body);

    res.status(200).json({ success: true, data: updatedRole });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Delete role
exports.deleteRole = async (req, res) => {
  try {
    const role = await Role.findByIdAndDelete(req.params.id);
    if (!role) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }

    await createAuditLog('DELETE', 'ROLE', role._id, { name: role.name });

    res.status(200).json({ success: true, message: 'Role deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
