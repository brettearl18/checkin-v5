#!/bin/bash
# Enable Stage 3: Pre-Created Assignments System
# This enables the feature flag on Cloud Run

echo "🚀 Enabling Stage 3: Pre-Created Assignments System"
echo ""
echo "This will:"
echo "  ✅ Set USE_PRE_CREATED_ASSIGNMENTS=true"
echo "  ✅ Deploy new revision to Cloud Run"
echo "  ✅ Enable new simplified check-ins system"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "Cancelled."
    exit 1
fi

echo ""
echo "🔧 Updating Cloud Run service..."
gcloud run services update checkinv5 \
  --region australia-southeast2 \
  --update-env-vars="USE_PRE_CREATED_ASSIGNMENTS=true"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Feature flag enabled successfully!"
    echo ""
    echo "📊 Next steps:"
    echo "  1. Wait ~1-2 minutes for deployment to complete"
    echo "  2. Test: /client-portal/check-ins (verify all weeks visible)"
    echo "  3. Monitor logs for errors"
    echo ""
    echo "⏮️  To rollback, run:"
    echo "  gcloud run services update checkinv5 --region australia-southeast2 --update-env-vars=\"USE_PRE_CREATED_ASSIGNMENTS=false\""
else
    echo ""
    echo "❌ Error enabling feature flag. Please check the error above."
    exit 1
fi

