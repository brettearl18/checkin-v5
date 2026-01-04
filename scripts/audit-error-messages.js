#!/usr/bin/env node

/**
 * Error Message Information Leakage Audit Script
 * 
 * Scans API routes for error messages that might leak sensitive information.
 */

const fs = require('fs');
const path = require('path');

const API_DIR = path.join(__dirname, '../src/app/api');

// Patterns that indicate potential information leakage
const LEAKAGE_PATTERNS = [
  {
    pattern: /error\s*:\s*error\.(message|stack)/i,
    severity: 'HIGH',
    description: 'Direct error message/stack trace exposure'
  },
  {
    pattern: /console\.(error|log|warn).*error/i,
    severity: 'INFO',
    description: 'Console logging (check if also returned to client)'
  },
  {
    pattern: /process\.env\./,
    severity: 'HIGH',
    description: 'Environment variable exposure'
  },
  {
    pattern: /\/[a-z]+\/[a-z]+\/[a-z]+/i,
    severity: 'MEDIUM',
    description: 'File path patterns (false positives possible)'
  },
  {
    pattern: /database|db\.|firestore|collection/i,
    severity: 'MEDIUM',
    description: 'Database structure references'
  },
  {
    pattern: /User not found|Email not found|Account not found/i,
    severity: 'MEDIUM',
    description: 'User enumeration vulnerability'
  },
  {
    pattern: /stack/i,
    severity: 'HIGH',
    description: 'Stack trace exposure'
  },
  {
    pattern: /NODE_ENV.*development/i,
    severity: 'INFO',
    description: 'Development mode error details (acceptable if guarded)'
  }
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

function checkFileErrors(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(path.join(__dirname, '../src/app/api'), filePath);
  const routePath = '/' + relativePath.replace(/\\/g, '/').replace('/route.ts', '');
  
  const issues = [];
  const lines = content.split('\n');
  
  // Check for error patterns in return statements
  lines.forEach((line, lineNum) => {
    // Only check lines that return responses
    if (line.includes('NextResponse.json') && line.includes('error')) {
      LEAKAGE_PATTERNS.forEach(({ pattern, severity, description }) => {
        if (pattern.test(line)) {
          // Check if it's guarded by NODE_ENV check
          const isGuarded = content.substring(0, content.indexOf(line)).includes('NODE_ENV') &&
                           content.substring(0, content.indexOf(line)).includes('development');
          
          if (!isGuarded || severity === 'HIGH') {
            issues.push({
              line: lineNum + 1,
              lineContent: line.trim(),
              severity,
              description,
              isGuarded: severity !== 'HIGH' && isGuarded
            });
          }
        }
      });
    }
  });
  
  // Check for error object exposure
  const errorObjectMatches = content.matchAll(/error:\s*(error|err|exception)(\.message|\.stack|\.code)?/gi);
  for (const match of errorObjectMatches) {
    const context = content.substring(Math.max(0, match.index - 100), match.index + 100);
    if (context.includes('NextResponse.json') && !context.includes('NODE_ENV')) {
      issues.push({
        line: content.substring(0, match.index).split('\n').length,
        lineContent: context.trim(),
        severity: 'HIGH',
        description: 'Error object potentially exposed to client',
        isGuarded: false
      });
    }
  }
  
  return {
    route: routePath,
    file: filePath,
    issues
  };
}

function main() {
  console.log('🔍 Error Message Information Leakage Audit\n');
  console.log('Scanning API routes for error message issues...\n');
  
  const routeFiles = scanDirectory(API_DIR);
  console.log(`Found ${routeFiles.length} API route files\n`);
  
  const results = routeFiles.map(checkFileErrors).filter(r => r.issues.length > 0);
  
  const highSeverity = results.filter(r => r.issues.some(i => i.severity === 'HIGH'));
  const mediumSeverity = results.filter(r => r.issues.some(i => i.severity === 'MEDIUM'));
  
  console.log('📊 Summary:');
  console.log(`🔴 High Severity Issues: ${highSeverity.length} files`);
  console.log(`🟡 Medium Severity Issues: ${mediumSeverity.length} files`);
  console.log(`📝 Total Files with Issues: ${results.length}\n`);
  
  if (highSeverity.length > 0) {
    console.log('🔴 HIGH SEVERITY ISSUES:\n');
    highSeverity.forEach(result => {
      console.log(`  ${result.route}`);
      result.issues.filter(i => i.severity === 'HIGH').forEach(issue => {
        console.log(`    Line ${issue.line}: ${issue.description}`);
        console.log(`    ${issue.lineContent.substring(0, 100)}...`);
        console.log('');
      });
    });
  }
  
  if (mediumSeverity.length > 0) {
    console.log('🟡 MEDIUM SEVERITY ISSUES:\n');
    mediumSeverity.forEach(result => {
      console.log(`  ${result.route}`);
      result.issues.filter(i => i.severity === 'MEDIUM').forEach(issue => {
        console.log(`    Line ${issue.line}: ${issue.description}`);
        if (!issue.isGuarded) {
          console.log(`    ⚠️  Not guarded by NODE_ENV check`);
        }
        console.log('');
      });
    });
  }
  
  // Generate report
  const report = {
    summary: {
      totalFiles: routeFiles.length,
      filesWithIssues: results.length,
      highSeverity: highSeverity.length,
      mediumSeverity: mediumSeverity.length
    },
    issues: results.map(r => ({
      route: r.route,
      file: path.relative(process.cwd(), r.file),
      issues: r.issues
    }))
  };
  
  const reportPath = path.join(__dirname, '../ERROR_MESSAGE_AUDIT_REPORT.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`📄 Detailed report saved to: ${reportPath}\n`);
  
  if (highSeverity.length > 0) {
    console.log('⚠️  WARNING: High severity issues found!');
    process.exit(1);
  } else {
    console.log('✅ No high severity issues found!');
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}

module.exports = { checkFileErrors, scanDirectory };

