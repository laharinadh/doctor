/**
 * Master Test Suite Runner
 * Executes all 5 test categories:
 *  1. Unit Testing
 *  2. White Box Testing
 *  3. Black Box Testing
 *  4. Integration Testing
 *  5. API Testing
 */
const { spawn } = require('child_process');
const path = require('path');

const suites = [
  {
    category: '1. Unit Testing',
    description: 'Isolated testing of pure functions, models, validators, and middlewares',
    files: [
      'test/unit/utils.test.js',
      'test/unit/validators.test.js',
      'test/unit/middleware.test.js',
    ],
  },
  {
    category: '2. White Box Testing',
    description: 'Internal branch coverage, algorithmic edge cases, error handlers, and crypto HMAC',
    files: [
      'test/whitebox/error-handler-branches.test.js',
      'test/whitebox/auth-branches.test.js',
      'test/whitebox/schedule-algorithm.test.js',
      'test/whitebox/payment-signature.test.js',
    ],
  },
  {
    category: '3. Black Box Testing',
    description: 'Specification testing, equivalence partitions, boundary values, role privilege limits',
    files: [
      'test/blackbox/equivalence-boundary.test.js',
    ],
  },
  {
    category: '4. Integration Testing',
    description: 'Cross-layer flows testing Routes -> Controllers -> Services -> MySQL Database',
    files: [
      'test/integration/doctor-schedule-flow.test.js',
      'test/integration/patient-admin-flow.test.js',
    ],
  },
  {
    category: '5. API Testing',
    description: 'End-to-end REST HTTP contracts, headers, response status codes, and JSON schemas',
    files: [
      'test/api/rest-api.test.js',
      'test/api/admin-management.test.js',
    ],
  },
  {
    category: '6. Security Core Verification',
    description: 'Defense against privilege escalation, unauthenticated access, SQL injection, and info disclosure',
    files: [
      'test/security/security-core.test.js',
    ],
  },
  {
    category: '7. Production Readiness & Hardening',
    description: 'Demonstrations of DB rollback, secrets check, rate limiting, HSTS, backup, idempotency, webhook replay, cloud storage, stress testing, vulnerabilities & compliance',
    files: [
      'test/production-readiness.test.js',
    ],
  },
];

async function runCommand(cmd, args) {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'pipe',
      shell: false,
      env: { ...process.env, NODE_ENV: 'test', AUTH_MODE: 'test' },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

function parseTestSummary(output) {
  const passMatch = output.match(/ℹ pass (\d+)/);
  const failMatch = output.match(/ℹ fail (\d+)/);
  const durationMatch = output.match(/ℹ duration_ms ([\d.]+)/);

  return {
    passed: passMatch ? parseInt(passMatch[1], 10) : 0,
    failed: failMatch ? parseInt(failMatch[1], 10) : 0,
    durationMs: durationMatch ? parseFloat(durationMatch[1]) : 0,
  };
}

async function main() {
  console.log('\n======================================================================');
  console.log('🩺 DOCTOR CONSULTATION BACKEND — COMPREHENSIVE TEST SUITE RUNNER');
  console.log('======================================================================');
  console.log('Categories: Unit Testing | White Box | Black Box | Integration | API');
  console.log('Environment: Node.js ' + process.version + ' | Test Runner: native node:test');
  console.log('======================================================================\n');

  let grandTotalPassed = 0;
  let grandTotalFailed = 0;
  let grandTotalDuration = 0;
  const results = [];

  for (const suite of suites) {
    console.log(`\n⏳ Running [${suite.category}]...`);
    console.log(`   Scope: ${suite.description}`);

    let categoryPassed = 0;
    let categoryFailed = 0;
    let categoryDuration = 0;

    for (const file of suite.files) {
      process.stdout.write(`   • ${file} ... `);
      const res = await runCommand('node', ['--test', file]);
      const summary = parseTestSummary(res.stdout);

      categoryPassed += summary.passed;
      categoryFailed += summary.failed;
      categoryDuration += summary.durationMs;

      if (res.code === 0 && summary.failed === 0) {
        console.log(`✅ PASSED (${summary.passed} tests, ${summary.durationMs.toFixed(1)}ms)`);
      } else {
        console.log(`❌ FAILED (${summary.failed} failed out of ${summary.passed + summary.failed})`);
        if (res.stderr) console.error(res.stderr);
      }
    }

    results.push({
      category: suite.category,
      passed: categoryPassed,
      failed: categoryFailed,
      durationMs: categoryDuration,
    });

    grandTotalPassed += categoryPassed;
    grandTotalFailed += categoryFailed;
    grandTotalDuration += categoryDuration;
  }

  console.log('\n======================================================================');
  console.log('📊 TEST EXECUTION SUMMARY REPORT');
  console.log('======================================================================');
  console.log('| Test Category            | Passed | Failed | Duration   | Status  |');
  console.log('|--------------------------|--------|--------|------------|---------|');

  for (const r of results) {
    const status = r.failed === 0 ? '✅ PASS' : '❌ FAIL';
    const catPadded = r.category.padEnd(24);
    const passPadded = String(r.passed).padStart(6);
    const failPadded = String(r.failed).padStart(6);
    const durPadded = `${(r.durationMs / 1000).toFixed(2)}s`.padStart(10);
    console.log(`| ${catPadded} | ${passPadded} | ${failPadded} | ${durPadded} | ${status} |`);
  }

  console.log('|--------------------------|--------|--------|------------|---------|');
  const grandPass = String(grandTotalPassed).padStart(6);
  const grandFail = String(grandTotalFailed).padStart(6);
  const grandDur = `${(grandTotalDuration / 1000).toFixed(2)}s`.padStart(10);
  console.log(`| Total Suite Execution    | ${grandPass} | ${grandFail} | ${grandDur} | ${grandTotalFailed === 0 ? '🏆 PASS' : '⚠️ FAIL'} |`);
  console.log('======================================================================\n');

  if (grandTotalFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main();
