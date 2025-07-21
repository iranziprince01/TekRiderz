const nano = require('nano')('http://prince:iranzi123@localhost:5984');

async function findUSReferences() {
  console.log('🔍 Searching all databases for "US" references...\n');
  
  const databases = ['courses', 'users', 'enrollments', 'files', 'progress', 'grades', 'analytics', 'assessments'];
  
  for (const dbName of databases) {
    try {
      console.log(`📊 Checking ${dbName} database...`);
      const db = nano.use(dbName);
      const docs = await db.list({ include_docs: true });
      
      const usReferences = [];
      
      docs.rows.forEach(row => {
        const doc = row.doc;
        if (!doc) return;
        
        // Search in common fields that might contain names
        const fieldsToCheck = ['name', 'instructorName', 'title', 'description', 'text', 'content'];
        
        fieldsToCheck.forEach(field => {
          if (doc[field] && typeof doc[field] === 'string' && doc[field].includes('US')) {
            usReferences.push({
              id: doc._id,
              field: field,
              value: doc[field],
              type: doc.type || 'unknown'
            });
          }
        });
      });
      
      if (usReferences.length > 0) {
        console.log(`❌ Found ${usReferences.length} "US" references in ${dbName}:`);
        usReferences.forEach(ref => {
          console.log(`   - ID: ${ref.id}`);
          console.log(`   - Field: ${ref.field}`);
          console.log(`   - Value: "${ref.value}"`);
          console.log(`   - Type: ${ref.type}`);
          console.log('');
        });
      } else {
        console.log(`✅ No "US" references found in ${dbName}`);
      }
      
    } catch (error) {
      console.log(`⚠️  Error checking ${dbName}: ${error.message}`);
    }
  }
  
  console.log('\n🎯 Search complete!');
}

findUSReferences().catch(console.error); 