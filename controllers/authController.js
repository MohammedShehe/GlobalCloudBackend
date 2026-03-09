const bcrypt = require("bcrypt");
const db = require("../config/db");

exports.registerFamily = async (req, res) => {

  const connection = db;

  try {

    let {
      family_name,
      password,
      confirm_password,
      members,
      admin_index
    } = req.body;

    // Normalize family name (avoid case duplicates)
    family_name = family_name?.trim().toLowerCase();

    // Basic validation
    if (!family_name || !password || !confirm_password) {
      return res.status(400).json({
        message: "Family name and password required"
      });
    }

    if (password !== confirm_password) {
      return res.status(400).json({
        message: "Passwords do not match"
      });
    }

    if (!Array.isArray(members) || members.length === 0) {
      return res.status(400).json({
        message: "At least one family member required"
      });
    }

    if (members.length > 10) {
      return res.status(400).json({
        message: "Maximum 10 members allowed"
      });
    }

    if (admin_index === undefined || admin_index >= members.length) {
      return res.status(400).json({
        message: "Admin must be selected from members"
      });
    }

    // Validate member fields
    for (let member of members) {

      if (
        !member.first_name ||
        !member.second_name ||
        !member.third_name
      ) {
        return res.status(400).json({
          message: "Each member must have first, second and third name"
        });
      }

    }

    // Prevent duplicate members in request
    const memberNames = members.map(m =>
      `${m.first_name}-${m.second_name}-${m.third_name}`.toLowerCase()
    );

    const uniqueNames = new Set(memberNames);

    if (uniqueNames.size !== memberNames.length) {
      return res.status(400).json({
        message: "Duplicate family members are not allowed"
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // START TRANSACTION
    connection.beginTransaction((err) => {

      if (err) {
        return res.status(500).json({ error: err });
      }

      // Insert family
      const familyQuery =
        "INSERT INTO families (family_name, family_password) VALUES (?, ?)";

      connection.query(
        familyQuery,
        [family_name, hashedPassword],
        (err, familyResult) => {

          if (err) {

            return connection.rollback(() => {

              if (err.code === "ER_DUP_ENTRY") {
                return res.status(400).json({
                  message: "Family name already exists"
                });
              }

              return res.status(500).json({ error: err });

            });

          }

          const familyId = familyResult.insertId;

          let completed = 0;

          members.forEach((member, index) => {

            const role = index === admin_index ? "admin" : "member";

            const memberQuery = `
              INSERT INTO family_members
              (family_id, first_name, second_name, third_name, role)
              VALUES (?, ?, ?, ?, ?)
            `;

            connection.query(
              memberQuery,
              [
                familyId,
                member.first_name.trim(),
                member.second_name.trim(),
                member.third_name.trim(),
                role
              ],
              (err) => {

                if (err) {

                  return connection.rollback(() => {

                    if (err.code === "ER_DUP_ENTRY") {
                      return res.status(400).json({
                        message: "This family member already exists in this family"
                      });
                    }

                    return res.status(500).json({ error: err });

                  });

                }

                completed++;

                if (completed === members.length) {

                  // COMMIT
                  connection.commit((err) => {

                    if (err) {
                      return connection.rollback(() => {
                        res.status(500).json({ error: err });
                      });
                    }

                    res.status(201).json({
                      message: "Family registered successfully",
                      family_id: familyId,
                      admin_member: members[admin_index]
                    });

                  });

                }

              }
            );

          });

        }
      );

    });

  } catch (error) {

    res.status(500).json({ error: error.message });

  }

};