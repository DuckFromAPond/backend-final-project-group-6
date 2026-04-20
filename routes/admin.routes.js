const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/roleCheck");
const adminController = require("../controllers/admin.controller");

// dashboard 
// router.get('/', protect, requireRole("Admin"), adminController.home);
// router.get('/dashboard', protect, requireRole("Admin"), adminController.home);

// user 
// router.get("/user", protect, requireRole('Admin'), adminController.showUser)
// router.patch('/users/:id/role', protect, requireRole("Admin"), adminController.updateUserRole);            // <-- or post here if want since it don't matter 
// router.patch('/users/:id/staus', protect, requireRole("Admin"), adminController.updateUserStatus);          // disable/enable user

// items 
// router.get('/items', protect, requireRole("Admin"), adminController.createItem);                               // preferably should show all items including who owns it                   
// router.delete('/items/:id', protect, requireRole("Admin"), adminController.archiveItem);             // don't hard delete items 
// router.post('/update', protect, requireRole("Admin"), adminController.updateOwnership);            // use provider method to get item  

// logs 
// router.get('/hisory', protect, requireRole("Admin"), adminController.createItem);                         // use provider method to get history 

// API
// router.get('/keys', protect, requireRole("Admin"), adminController.getKeys)
// router.post('/keys', protect, requireRole("Admin"), adminController.generateKeys)
// router.delete('/keys/:id', protect, requireRole("Admin"), adminController.deleteKey); 




// error 404
// router.use(adminController.notFound);


module.exports = router;