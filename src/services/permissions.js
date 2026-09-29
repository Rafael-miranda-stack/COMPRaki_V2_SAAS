const db = require("../db");

async function projectAccess(projectId, userId) {
  const q = await db.query(`
    SELECT p.id, p.owner_id,
           CASE WHEN p.owner_id=$2 THEN 'OWNER' ELSE pm.role END AS role
      FROM projects p
      LEFT JOIN project_members pm
        ON pm.project_id=p.id AND pm.user_id=$2
     WHERE p.id=$1
       AND (p.owner_id=$2 OR pm.user_id=$2)
     LIMIT 1
  `,[projectId,userId]);
  return q.rows[0] || null;
}

function canEdit(access) {
  return access && (access.role === "OWNER" || access.role === "EDITOR");
}

function isOwner(access) {
  return access && access.role === "OWNER";
}

module.exports = { projectAccess, canEdit, isOwner };
