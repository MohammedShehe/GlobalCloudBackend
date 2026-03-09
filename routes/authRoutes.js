const express = require("express");
const router = express.Router();

const { registerFamily, loginFamily } = require("../controllers/authController");

router.post("/register", registerFamily);
router.post("/login", loginFamily); 

module.exports = router;