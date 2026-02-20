#!/bin/bash
# Deploy the ABA solver to Google Cloud Run.
#
# Prerequisites:
#   - gcloud CLI installed and authenticated
#   - GCP_PROJECT_ID environment variable set
#
# Usage:
#   GCP_PROJECT_ID=my-project ./solver/deploy.sh

set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-ordusscheduler-2026}"
REGION="${GCP_REGION:-us-central1}"
SERVICE_NAME="aba-solver"

echo "Deploying $SERVICE_NAME to $REGION in project $PROJECT_ID ..."

gcloud run deploy "$SERVICE_NAME" \
  --source ./solver \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 4 \
  --timeout 120 \
  --max-instances 3 \
  --set-env-vars "SOLVER_WORKERS=4"

SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --format "value(status.url)")

echo ""
echo "Deployed successfully!"
echo "Service URL: $SERVICE_URL"
echo ""
echo "Add this to your .env file:"
echo "  VITE_SOLVER_URL=$SERVICE_URL"
