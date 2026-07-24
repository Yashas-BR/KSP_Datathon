#!/bin/bash

echo "=========================================="
echo "  KSP Crime Analytics Platform - Deploy"
echo "=========================================="
echo ""

# Clean previous artifacts
echo "📦 Cleaning previous deployment artifacts..."
rm -rf deploy_package/ deploy_package.zip

# Create deployment package
echo "📁 Creating deployment package..."
mkdir -p deploy_package
mkdir -p deploy_package/ksp
mkdir -p deploy_package/frontend

# Copy backend files
echo "   - Copying backend files..."
cp app.py app-config.json requirements.txt deploy_package/
cp -r ksp/* deploy_package/ksp/

# Copy frontend files
echo "   - Copying frontend files..."
cp -r frontend/* deploy_package/frontend/

# Create zip
echo "📦 Creating zip archive..."
cd deploy_package
zip -r ../deploy_package.zip ./*
cd ..

echo ""
echo "✅ Deployment package created: deploy_package.zip"
echo ""
echo "📋 Next Steps:"
echo "1. Upload deploy_package.zip to Zoho Catalyst Console"
echo "2. Or use CLI: catalyst deploy"
echo "3. Or use: catalyst deploy --config catalyst.json"
echo ""
echo "🔗 After deployment:"
echo "   - Frontend: https://your-app.catalystappsail