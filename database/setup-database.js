const fs = require("fs");
const path = require("path");
const { pool } = require("./database");

const runSqlFile = async (filePath) => {
  try {
    const sql = fs.readFileSync(filePath, "utf8");
    const queries = sql.split(";").filter((query) => query.trim() !== "");

    for (const query of queries) {
      if (query.trim() !== "") {
        await pool.promise().query(query);
        console.log(
          `Query executed successfully => ||START|| ${query} ||END||`
        );
      }
    }
  } catch (error) {
    console.error("Error executing SQL file:", error);
  }
};

const setupDatabase = async () => {
  const schemaPath = path.join(__dirname, "schema.sql");
  await runSqlFile(schemaPath);
  // end pool connections
  pool.end((err) => {
    if (err) {
      console.error("Error ending the pool:", err);
    } else {
      console.log("Pool has ended.");
    }
    process.exit(); // quit on end
  });
};

setupDatabase();
