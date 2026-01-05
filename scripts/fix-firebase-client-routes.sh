#!/bin/bash
# Script to convert Firebase client SDK routes to Admin SDK

# Function to convert a route file
convert_route() {
  local file=$1
  echo "Converting $file..."
  
  # Replace imports
  sed -i '' 's/from.*firebase\/firestore.*//g' "$file" 2>/dev/null || sed -i 's/from.*firebase\/firestore.*//g' "$file"
  sed -i '' 's/import { db } from.*firebase-client.*/import { getDb } from '\''@\/lib\/firebase-server'\'';/g' "$file" 2>/dev/null || sed -i 's/import { db } from.*firebase-client.*/import { getDb } from '\''@\/lib\/firebase-server'\'';/g' "$file"
  
  # Add getDb() call at start of handler
  if ! grep -q "const db = getDb()" "$file"; then
    sed -i '' '/^export async function.*{/a\
  const db = getDb();
' "$file" 2>/dev/null || sed -i '/^export async function.*{/a\
  const db = getDb();
' "$file"
  fi
  
  # Replace collection() with db.collection()
  sed -i '' 's/collection(db, /db.collection(/g' "$file" 2>/dev/null || sed -i 's/collection(db, /db.collection(/g' "$file"
  sed -i '' 's/collection(db)/db.collection/g' "$file" 2>/dev/null || sed -i 's/collection(db)/db.collection/g' "$file"
  
  # Replace addDoc() with db.collection().add()
  sed -i '' 's/addDoc(collection(db, \([^)]*\)),/db.collection(\1).add({/g' "$file" 2>/dev/null || sed -i 's/addDoc(collection(db, \([^)]*\)),/db.collection(\1).add({/g' "$file"
  
  # Replace serverTimestamp() with new Date()
  sed -i '' 's/serverTimestamp()/new Date()/g' "$file" 2>/dev/null || sed -i 's/serverTimestamp()/new Date()/g' "$file"
  
  # Replace getDoc(doc(db, ...)) with db.collection().doc().get()
  sed -i '' 's/getDoc(doc(db, \([^,]*\), \([^)]*\)))/db.collection(\1).doc(\2).get()/g' "$file" 2>/dev/null || sed -i 's/getDoc(doc(db, \([^,]*\), \([^)]*\)))/db.collection(\1).doc(\2).get()/g' "$file"
  
  # Replace doc(db, ...) with db.collection().doc()
  sed -i '' 's/doc(db, \([^,]*\), \([^)]*\))/db.collection(\1).doc(\2)/g' "$file" 2>/dev/null || sed -i 's/doc(db, \([^,]*\), \([^)]*\))/db.collection(\1).doc(\2)/g' "$file"
  
  # Replace setDoc(doc(db, ...), ...) with db.collection().doc().set()
  sed -i '' 's/setDoc(doc(db, \([^,]*\), \([^)]*\)),/db.collection(\1).doc(\2).set(/g' "$file" 2>/dev/null || sed -i 's/setDoc(doc(db, \([^,]*\), \([^)]*\)),/db.collection(\1).doc(\2).set(/g' "$file"
  
  echo "✅ Converted $file"
}

# Convert all identified files
for file in \
  src/app/api/create-sample-questions/route.ts \
  src/app/api/create-sample-responses/route.ts \
  src/app/api/create-sample-users/route.ts \
  src/app/api/create-test-question/route.ts \
  src/app/api/create-test-response/route.ts \
  src/app/api/test-client-access/route.ts \
  src/app/api/clients/[id]/scoring/route.ts; do
  if [ -f "$file" ]; then
    convert_route "$file"
  fi
done

echo "✅ All routes converted!"















