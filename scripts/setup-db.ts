import { neon } from "@neondatabase/serverless";
import * as fs from "fs";
import * as path from "path";

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_GPF7YBi0fgbw@ep-restless-glitter-advc3pag-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require";

async function setupDatabase() {
  console.log("🚀 Setting up Neon Database...\n");

  const sql = neon(DATABASE_URL);

  try {
    // Read the schema file
    const schemaPath = path.join(process.cwd(), "schema.sql");
    const schemaSQL = fs.readFileSync(schemaPath, "utf-8");

    // Split by semicolons and execute each statement
    const statements = schemaSQL
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));

    console.log(`📄 Executing ${statements.length} SQL statements...\n`);

    for (const statement of statements) {
      try {
        // Skip pure comments
        if (statement.match(/^\/\*[\s\S]*?\*\/$/)) {
          continue;
        }

        await sql(statement);

        // Log table creation
        if (statement.includes("CREATE TABLE")) {
          const match = statement.match(
            /CREATE TABLE (?:IF NOT EXISTS )?(\w+)/i
          );
          if (match) {
            console.log(`✅ Created table: ${match[1]}`);
          }
        } else if (statement.includes("CREATE INDEX")) {
          const match = statement.match(
            /CREATE INDEX (?:IF NOT EXISTS )?(\w+)/i
          );
          if (match) {
            console.log(`📑 Created index: ${match[1]}`);
          }
        } else if (statement.includes("CREATE TRIGGER")) {
          const match = statement.match(/CREATE TRIGGER (\w+)/i);
          if (match) {
            console.log(`⚡ Created trigger: ${match[1]}`);
          }
        } else if (statement.includes("CREATE OR REPLACE VIEW")) {
          const match = statement.match(/CREATE OR REPLACE VIEW (\w+)/i);
          if (match) {
            console.log(`👁️  Created view: ${match[1]}`);
          }
        }
      } catch (err: any) {
        // Ignore "already exists" errors
        if (!err.message?.includes("already exists")) {
          console.error(`❌ Error executing statement:`, err.message);
        }
      }
    }

    console.log("\n✨ Database setup completed successfully!");
    console.log("\n📊 Verifying tables...");

    // Verify tables were created
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `;

    console.log("\n📋 Created tables:");
    tables.forEach((t: any) => {
      console.log(`  - ${t.table_name}`);
    });
  } catch (error) {
    console.error("\n❌ Database setup failed:", error);
    process.exit(1);
  }
}

setupDatabase();
