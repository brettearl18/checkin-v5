#!/bin/bash

# Script to create Silvana Earl's admin account
# Make sure your dev server is running on localhost:3000

echo "Creating admin account for Silvana Earl..."
echo ""

curl -X POST http://localhost:3000/api/admin/set-admin \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "k5rT8EGNUqbWCSf5g56msZoFdX02",
    "email": "Silvi@vanahealth.com.au",
    "firstName": "Silvana",
    "lastName": "Earl",
    "password": "ChangeThisPassword123!"
  }'

echo ""
echo ""
echo "✅ Account creation request sent!"
echo "⚠️  IMPORTANT: Change the password after first login!"
echo ""
echo "You can now log in with:"
echo "  Email: Silvi@vanahealth.com.au"
echo "  Password: ChangeThisPassword123!"
echo "  Role: Admin"









