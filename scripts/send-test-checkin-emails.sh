#!/bin/bash
# Script to send test check-in reminder emails to brett.earl@gmail.com
# Usage: ./scripts/send-test-checkin-emails.sh [BASE_URL]

BASE_URL="${1:-https://checkinv5-775780318058.australia-southeast2.run.app}"
TEST_EMAIL="brett.earl@gmail.com"

echo "🧪 Sending Test Check-In Reminder Emails"
echo "=========================================="
echo "Base URL: $BASE_URL"
echo "Test Email: $TEST_EMAIL"
echo ""

echo "📧 Testing: 24 Hours Before Window Closes"
RESPONSE1=$(curl -s -X POST "$BASE_URL/api/scheduled-emails/check-in-window-close-24h" \
  -H "Content-Type: application/json" \
  -d "{\"testEmail\":\"$TEST_EMAIL\"}")
echo "$RESPONSE1" | jq '.' 2>/dev/null || echo "$RESPONSE1"
echo ""

echo "📧 Testing: 1 Hour Before Window Closes"
RESPONSE2=$(curl -s -X POST "$BASE_URL/api/scheduled-emails/check-in-window-close-1h" \
  -H "Content-Type: application/json" \
  -d "{\"testEmail\":\"$TEST_EMAIL\"}")
echo "$RESPONSE2" | jq '.' 2>/dev/null || echo "$RESPONSE2"
echo ""

echo "📧 Testing: 2 Hours After Window Closes"
RESPONSE3=$(curl -s -X POST "$BASE_URL/api/scheduled-emails/check-in-window-closed" \
  -H "Content-Type: application/json" \
  -d "{\"testEmail\":\"$TEST_EMAIL\"}")
echo "$RESPONSE3" | jq '.' 2>/dev/null || echo "$RESPONSE3"
echo ""

echo "✅ Testing complete!"
echo "📧 Check $TEST_EMAIL for test emails"
echo ""
echo "Note: Emails will only be sent if there are active check-in assignments"
echo "      that match the timing criteria (24h before, 1h before, or 2h after close)."


