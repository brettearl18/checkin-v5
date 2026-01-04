#!/usr/bin/env node

/**
 * API Route Authentication Audit Script
 * 
 * Scans all API route files and checks for authentication usage.
 * Identifies routes that might be missing authentication.
 */

const fs = require('fs');
const path = require('path');

const API_DIR = path.join(__dirname, '../src/app/api');
const AUTH_PATTERNS = [
  'requireAuth',
  'requireAdmin',
  'requireCoach',
  'verifyClientAccess',
  'requireRole'
];

const SKIP_PATTERNS = [
  '// AUTHENTICATION NOT REQUIRED', // Routes explicitly marked as public
  '// PUBLIC ENDPOINT',
  'export const dynamic', // Just checking for route files
];

function scanDirectory(dir, routeFiles = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      scanDirectory(fullPath, routeFiles);
    } else if (entry.isFile() && entry.name === 'route.ts') {
      routeFiles.push(fullPath);
    }
  }
  
  return routeFiles;
}

function checkFileAuth(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(path.join(__dirname, '../src/app/api'), filePath);
  const routePath = '/' + relativePath.replace(/\\/g, '/').replace('/route.ts', '');
  
  // Skip test endpoints that are disabled in production
  if (content.includes('NODE_ENV === \'production\'') && 
      (content.includes('DISABLED IN PRODUCTION') || content.includes('Not Found'))) {
    return {
      route: routePath,
      file: filePath,
      status: 'SKIP',
      reason: 'Test endpoint - disabled in production',
      hasAuth: null
    };
  }
  
  // Check for explicit public endpoint markers
  const isExplicitlyPublic = SKIP_PATTERNS.some(pattern => content.includes(pattern));
  if (isExplicitlyPublic) {
    return {
      route: routePath,
      file: filePath,
      status: 'PUBLIC',
      reason: 'Explicitly marked as public endpoint',
      hasAuth: false
    };
  }
  
  // Check for authentication patterns
  const hasAuth = AUTH_PATTERNS.some(pattern => {
    // Check if pattern is used in function calls (not just comments or type definitions)
    const regex = new RegExp(`\\b${pattern}\\s*\\(`, 'g');
    return regex.test(content);
  });
  
  // Get HTTP methods defined
  const methods = [];
  if (content.includes('export async function GET')) methods.push('GET');
  if (content.includes('export async function POST')) methods.push('POST');
  if (content.includes('export async function PUT')) methods.push('PUT');
  if (content.includes('export async function DELETE')) methods.push('DELETE');
  if (content.includes('export async function PATCH')) methods.push('PATCH');
  
  return {
    route: routePath,
    file: filePath,
    status: hasAuth ? 'PROTECTED' : 'UNPROTECTED',
    reason: hasAuth ? 'Has authentication check' : 'No authentication pattern found',
    hasAuth,
    methods
  };
}

function main() {
  console.log('🔍 API Route Authentication Audit\n');
  console.log('Scanning API routes...\n');
  
  const routeFiles = scanDirectory(API_DIR);
  console.log(`Found ${routeFiles.length} API route files\n`);
  
  const results = routeFiles.map(checkFileAuth);
  
  const protected = results.filter(r => r.status === 'PROTECTED');
  const unprotected = results.filter(r => r.status === 'UNPROTECTED');
  const publicRoutes = results.filter(r => r.status === 'PUBLIC');
  const skipped = results.filter(r => r.status === 'SKIP');
  
  console.log('📊 Summary:');
  console.log(`✅ Protected: ${protected.length}`);
  console.log(`❌ Unprotected: ${unprotected.length}`);
  console.log(`🌐 Public: ${publicRoutes.length}`);
  console.log(`⏭️  Skipped (test endpoints): ${skipped.length}\n`);
  
  if (unprotected.length > 0) {
    console.log('❌ UNPROTECTED ROUTES (Review Required):\n');
    unprotected.forEach(route => {
      console.log(`  ${route.route}`);
      console.log(`    Methods: ${route.methods.join(', ') || 'Unknown'}`);
      console.log(`    File: ${route.file}`);
      console.log('');
    });
  }
  
  if (publicRoutes.length > 0) {
    console.log('🌐 PUBLIC ROUTES (Explicitly marked):\n');
    publicRoutes.forEach(route => {
      console.log(`  ${route.route}`);
      console.log(`    Methods: ${route.methods ? route.methods.join(', ') : 'Unknown'}`);
      console.log('');
    });
  }
  
  // Generate detailed report
  const report = {
    summary: {
      total: results.length,
      protected: protected.length,
      unprotected: unprotected.length,
      public: publicRoutes.length,
      skipped: skipped.length
    },
    unprotected: unprotected.map(r => ({
      route: r.route,
      methods: r.methods,
      file: path.relative(process.cwd(), r.file)
    })),
    public: publicRoutes.map(r => ({
      route: r.route,
      methods: r.methods,
      file: path.relative(process.cwd(), r.file)
    }))
  };
  
  const reportPath = path.join(__dirname, '../API_AUTH_AUDIT_REPORT.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`📄 Detailed report saved to: ${reportPath}\n`);
  
  if (unprotected.length > 0) {
    console.log('⚠️  WARNING: Unprotected routes found!');
    process.exit(1);
  } else {
    console.log('✅ All routes are protected or explicitly marked as public!');
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}

module.exports = { checkFileAuth, scanDirectory };

