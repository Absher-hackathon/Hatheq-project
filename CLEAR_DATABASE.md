# How to Clear All Database Data

This guide explains how to delete all data from the TruthScope database.

## Method 1: Using the API Endpoint (Recommended)

You can use the admin API endpoint to clear all data:

```bash
# Using curl
curl -X DELETE http://localhost:8787/api/admin/clear-all-data

# Or using fetch in browser console
fetch('/api/admin/clear-all-data', { method: 'DELETE' })
  .then(res => res.json())
  .then(data => console.log(data));
```

**Note:** This endpoint deletes data from all tables:

- `session_reports`
- `nlp_analysis`
- `behavioral_analysis`
- `questions`
- `interrogation_sessions`

## Method 2: Using Wrangler CLI (For Cloudflare D1)

If you're using Cloudflare D1 database, you can execute SQL directly:

```bash
# Execute the clear_all_data.sql file
wrangler d1 execute <database-name> --file=./migrations/clear_all_data.sql

# Or execute SQL directly
wrangler d1 execute <database-name> --command="DELETE FROM session_reports; DELETE FROM nlp_analysis; DELETE FROM behavioral_analysis; DELETE FROM questions; DELETE FROM interrogation_sessions;"
```

Replace `<database-name>` with your actual database name from `wrangler.json`.

## Method 3: Using SQL File

You can also use the SQL file directly:

```bash
# For local development
wrangler d1 execute <database-name> --local --file=./migrations/clear_all_data.sql

# For production
wrangler d1 execute <database-name> --file=./migrations/clear_all_data.sql
```

## Method 4: Manual SQL Execution

If you have direct access to the database, you can run:

```sql
DELETE FROM session_reports;
DELETE FROM nlp_analysis;
DELETE FROM behavioral_analysis;
DELETE FROM questions;
DELETE FROM interrogation_sessions;
```

## Warning

⚠️ **WARNING:** All of these methods will permanently delete ALL data from the database. This action cannot be undone. Make sure you have a backup if you need to restore the data later.

## Backup Before Clearing

Before clearing the database, you might want to create a backup:

```bash
# Export database (for Cloudflare D1)
wrangler d1 export <database-name> --output=backup.sql

# Or use the API to export data before clearing
```
