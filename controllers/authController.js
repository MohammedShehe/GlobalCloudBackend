// controllers/authController.js

const bcrypt = require("bcrypt");
const db = require("../config/db");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const JWT_SECRET = process.env.JWT_SECRET;

// -------------------- REGISTER FAMILY --------------------
exports.registerFamily = async (req, res) => {
  const connection = db;

  try {
    let { family_name, password, confirm_password, members, admin_index } = req.body;
    family_name = family_name?.trim().toLowerCase();

    if (!family_name || !password || !confirm_password) {
      return res.status(400).json({ message: "Family name and password required" });
    }
    if (password !== confirm_password) {
      return res.status(400).json({ message: "Passwords do not match" });
    }
    if (!Array.isArray(members) || members.length === 0) {
      return res.status(400).json({ message: "At least one family member required" });
    }
    if (members.length > 10) {
      return res.status(400).json({ message: "Maximum 10 members allowed" });
    }
    if (admin_index === undefined || admin_index >= members.length) {
      return res.status(400).json({ message: "Admin must be selected from members" });
    }

    for (let member of members) {
      if (!member.first_name || !member.second_name || !member.third_name) {
        return res.status(400).json({ message: "Each member must have first, second, and third name" });
      }
    }

    const memberNames = members.map(m => `${m.first_name}-${m.second_name}-${m.third_name}`.toLowerCase());
    if (new Set(memberNames).size !== memberNames.length) {
      return res.status(400).json({ message: "Duplicate family members are not allowed" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    connection.beginTransaction(err => {
      if (err) return res.status(500).json({ error: err });

      const familyQuery = "INSERT INTO families (family_name, family_password) VALUES (?, ?)";
      connection.query(familyQuery, [family_name, hashedPassword], (err, familyResult) => {
        if (err) return connection.rollback(() => {
          if (err.code === "ER_DUP_ENTRY") return res.status(400).json({ message: "Family name already exists" });
          return res.status(500).json({ error: err });
        });

        const familyId = familyResult.insertId;
        let completed = 0;

        members.forEach((member, index) => {
          const role = index === admin_index ? "admin" : "member";
          const memberQuery = `
            INSERT INTO family_members (family_id, first_name, second_name, third_name, role)
            VALUES (?, ?, ?, ?, ?)
          `;
          connection.query(
            memberQuery,
            [familyId, member.first_name.trim(), member.second_name.trim(), member.third_name.trim(), role],
            (err) => {
              if (err) return connection.rollback(() => res.status(500).json({ error: err }));

              completed++;
              if (completed === members.length) {
                connection.commit(err => {
                  if (err) return connection.rollback(() => res.status(500).json({ error: err }));
                  res.status(201).json({ message: "Family registered successfully", family_id: familyId });
                });
              }
            }
          );
        });
      });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// -------------------- LOGIN FAMILY --------------------
exports.loginFamily = (req, res) => {
  const { first_name, second_name, third_name, family_name, password } = req.body;

  if (!first_name || !second_name || !third_name || !family_name || !password) {
    return res.status(400).json({ message: "All fields (including family_name) are required" });
  }

  const normalizedFamilyName = family_name.trim().toLowerCase();

  const memberQuery = `
    SELECT m.id AS member_id, m.first_name, m.third_name, m.role, m.family_id,
           f.family_name, f.family_password
    FROM family_members m
    JOIN families f ON f.id = m.family_id
    WHERE m.first_name = ? AND m.second_name = ? AND m.third_name = ? AND f.family_name = ?
  `;

  db.query(
    memberQuery,
    [first_name.trim(), second_name.trim(), third_name.trim(), normalizedFamilyName],
    async (err, results) => {
      if (err) return res.status(500).json({ error: err });
      if (results.length === 0) return res.status(404).json({ message: "Member not found" });

      const member = results[0];
      const isMatch = await bcrypt.compare(password, member.family_password);

      if (!isMatch) return res.status(401).json({ message: "Incorrect password" });

      const token = jwt.sign(
        {
          member_id: member.member_id,
          family_id: member.family_id,
          role: member.role,
          first_name: member.first_name,
          third_name: member.third_name
        },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      res.status(200).json({
        token,
        first_name: member.first_name,
        third_name: member.third_name,
        role: member.role,
        family_name: member.family_name
      });
    }
  );
};

// -------------------- AUTH MIDDLEWARE --------------------
exports.authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: "Token required" });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: "Invalid token" });
    req.user = user;
    next();
  });
};