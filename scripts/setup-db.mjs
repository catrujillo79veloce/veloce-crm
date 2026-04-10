import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))

const supabaseUrl = "https://naxshwyyohvqdgsgiyxc.supabase.co"
const serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5heHNod3l5b2h2cWRnc2dpeXhjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDU2NTk0MCwiZXhwIjoyMDkwMTQxOTQwfQ.vQk4tcSEK9pNcEXtevD2l2sIltxwDcFb4ECvvilb0bw"

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const migrations = [
  "001_crm_initial.sql",
  "002_crm_rls_policies.sql",
  "003_crm_functions.sql",
  "004_crm_seed.sql",
]

async function runMigration(filename) {
  const sql = readFileSync(join(__dirname, "..", "supabase", "migrations", filename), "utf-8")
  console.log(`\n--- Running ${filename} (${sql.length} chars) ---`)

  const { data, error } = await supabase.rpc("exec_sql", { query: sql })
  if (error) {
    // RPC might not exist, try direct fetch to the pg endpoint
    console.log(`RPC failed: ${error.message}. Trying REST SQL...`)

    // Use the Supabase Management API query endpoint
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": serviceRoleKey,
        "Authorization": `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ query: sql }),
    })
    if (!res.ok) {
      console.log(`REST failed too. Status: ${res.status}`)
      return false
    }
  }
  console.log(`✓ ${filename} completed`)
  return true
}

// Alternative: Use pg directly
async function runWithPg() {
  console.log("Attempting direct SQL execution via Supabase...")

  // Combine all migrations
  let allSql = ""
  for (const f of migrations) {
    allSql += readFileSync(join(__dirname, "..", "supabase", "migrations", f), "utf-8") + "\n"
  }

  // Try to execute via the query endpoint
  try {
    const response = await fetch(`${supabaseUrl}/pg/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ query: allSql }),
    })

    if (response.ok) {
      const result = await response.json()
      console.log("✓ All migrations executed successfully!")
      console.log(result)
      return true
    } else {
      const text = await response.text()
      console.log(`Failed: ${response.status} ${text.substring(0, 200)}`)
    }
  } catch (err) {
    console.log(`Error: ${err.message}`)
  }

  return false
}

async function main() {
  console.log("=== Veloce CRM Database Setup ===\n")

  const success = await runWithPg()
  if (!success) {
    console.log("\n⚠ Automatic SQL execution is not available.")
    console.log("Please run the SQL manually in Supabase Dashboard > SQL Editor.")
    console.log("Migration files are in: supabase/migrations/")
    console.log("\nFiles to run in order:")
    migrations.forEach(f => console.log(`  - ${f}`))
  }
}

main()
