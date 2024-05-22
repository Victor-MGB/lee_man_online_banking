const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");

router.post("/register", userController.register);
router.post("/login", userController.login);
router.get('/', userController.getAllUsers);
router.post('/logout', userController.logout); // Add logout route
router.delete('/:userId', userController.deleteUser); // Route to delete a user

module.exports = router;
