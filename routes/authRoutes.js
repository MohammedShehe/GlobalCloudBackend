const express = require("express");
const router = express.Router();

const { registerFamily } = require("../controllers/authController");

router.post("/register", registerFamily);

module.exports = router;