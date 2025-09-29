const fs = require('fs')
const path = require('path')
const pool = require('../src/db')

async function removePersonPictureColumn() {
  console.log('🔧 Removing person_picture column references...')
  
  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '../src/db/migrations/007_fix_person_picture_column.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    
    console.log('📂 Loaded migration: 007_fix_person_picture_column.sql')
    
    // Execute the migration
    await pool.query(migrationSQL)
    
    console.log('✅ Migration executed successfully!')
    
    // Test the fix by querying the materialized view WITHOUT person_picture
    const testQuery = `
      SELECT 
        device_id, device_name, person_name,
        latitude, longitude, battery_level
      FROM sidebar_device_cache 
      LIMIT 3
    `
    
    const testResult = await pool.query(testQuery)
    console.log('🧪 Test query results (without person_picture):')
    console.table(testResult.rows)
    
    console.log('\n✅ person_picture column references have been removed!')
    console.log('🚀 The API should now work without errors.')
    console.log('📝 Note: person_picture column will be added back later when needed.')
    
  } catch (error) {
    console.error('❌ Error removing person_picture column:', error.message)
    console.error('Full error:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

// Run the fix
removePersonPictureColumn()