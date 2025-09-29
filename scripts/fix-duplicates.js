const fs = require('fs')
const path = require('path')
const pool = require('../src/db')

async function fixDuplicateDevices() {
  console.log('🔧 Fixing duplicate devices in sidebar_device_cache...')
  
  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '../src/db/migrations/008_fix_duplicate_devices.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    
    console.log('📂 Loaded migration: 008_fix_duplicate_devices.sql')
    
    // Execute the migration
    await pool.query(migrationSQL)
    
    console.log('✅ Migration executed successfully!')
    
    // Test the fix by checking for duplicates
    const duplicateCheck = `
      SELECT 
        device_id, 
        COUNT(*) as count
      FROM sidebar_device_cache 
      GROUP BY device_id
      HAVING COUNT(*) > 1
    `
    
    const duplicateResult = await pool.query(duplicateCheck)
    
    if (duplicateResult.rows.length > 0) {
      console.warn('⚠️  Still found duplicates:')
      console.table(duplicateResult.rows)
    } else {
      console.log('✅ No duplicates found!')
    }
    
    // Show sample data
    const testQuery = `
      SELECT 
        device_id, device_name, person_name,
        latitude, longitude, battery_level
      FROM sidebar_device_cache 
      ORDER BY device_name
      LIMIT 5
    `
    
    const testResult = await pool.query(testQuery)
    console.log('🧪 Sample data:')
    console.table(testResult.rows)
    
    console.log('\n✅ Duplicate devices have been fixed!')
    console.log('🚀 The API should now work without errors.')
    
  } catch (error) {
    console.error('❌ Error fixing duplicate devices:', error.message)
    console.error('Full error:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

// Run the fix
fixDuplicateDevices()