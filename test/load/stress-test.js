if (process.argv.includes('--with-rate-limiter')) {
  process.env.NODE_ENV = 'production';
} else {
  process.env.NODE_ENV = process.env.NODE_ENV || 'test';
}
const request = require('supertest');
const app = require('../../app');

async function runLoadStressTest(totalRequests = 200, concurrency = 20, customEndpoints = null) {
  console.log(`\n======================================================`);
  console.log(`⚡ RUNNING PRODUCTION LOAD & STRESS TEST`);
  console.log(`======================================================`);
  console.log(`Total Requests: ${totalRequests} | Concurrency: ${concurrency}`);

  const defaultEndpoints = [
    { url: '/api/v1/health', headers: {} },
    { url: '/api/v1/health/deep', headers: {} },
  ];
  const endpoints = customEndpoints || defaultEndpoints;

  console.log(`Target Endpoints:`);
  endpoints.forEach((ep) => console.log(` - ${ep.url}`));

  const latencies = [];
  let successes = 0;
  let failures = 0;
  const statusCounts = {};
  const errors = [];

  const startTime = Date.now();
  let nextRequest = 0;

  async function worker() {
    while (true) {
      const requestNumber = nextRequest++;
      if (requestNumber >= totalRequests) {
        return;
      }

      const target = endpoints[requestNumber % endpoints.length];
      const reqStart = Date.now();
      try {
        const req = request(app).get(target.url);
        for (const [k, v] of Object.entries(target.headers || {})) {
          req.set(k, v);
        }
        const res = await req;
        const reqDuration = Date.now() - reqStart;
        latencies.push(reqDuration);

        if (res.status >= 200 && res.status < 400) {
          successes++;
          statusCounts[res.status] = (statusCounts[res.status] || 0) + 1;
        } else {
          failures++;
          statusCounts[res.status] = (statusCounts[res.status] || 0) + 1;
          errors.push({
            url: target.url,
            status: res.status,
            body: res.body,
            text: res.text,
          });
        }
      } catch (err) {
        failures++;
        statusCounts['NETWORK_ERR'] = (statusCounts['NETWORK_ERR'] || 0) + 1;
        errors.push({
          url: target.url,
          error: err.message,
          code: err.code,
        });
      }
    }
  }

  // Run concurrency pool of workers
  const workers = [];
  for (let i = 0; i < concurrency; i++) {
    workers.push(worker());
  }
  await Promise.all(workers);

  const totalDurationSeconds = (Date.now() - startTime) / 1000;
  latencies.sort((a, b) => a - b);

  const avgLatency = latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
  const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;
  const rps = totalDurationSeconds > 0 ? totalRequests / totalDurationSeconds : 0;

  const report = {
    totalRequests,
    concurrency,
    endpoints: endpoints.map(e => e.url),
    successes,
    failures,
    statusCounts,
    errorRate: ((failures / totalRequests) * 100).toFixed(2) + '%',
    durationSeconds: totalDurationSeconds.toFixed(2),
    requestsPerSecond: Math.round(rps),
    latencyMs: {
      min: latencies[0] || 0,
      avg: Math.round(avgLatency),
      p50,
      p95,
      p99,
      max: latencies[latencies.length - 1] || 0,
    },
    errorsSample: errors.slice(0, 10),
  };

  console.log(`\n📊 LOAD TEST BENCHMARK RESULTS:`);
  console.log(` - Completed: ${totalRequests} requests in ${report.durationSeconds}s`);
  console.log(` - Throughput: ${report.requestsPerSecond} req/sec`);
  console.log(` - Success Rate: ${((successes / totalRequests) * 100).toFixed(1)}% (Failures: ${failures})`);
  console.log(` - Latencies: Avg = ${report.latencyMs.avg}ms | p50 = ${p50}ms | p95 = ${p95}ms | p99 = ${p99}ms | Max = ${report.latencyMs.max}ms`);

  console.log(`\n📋 HTTP STATUS DISTRIBUTION:`);
  for (const [status, count] of Object.entries(statusCounts)) {
    console.log(` - ${status}: ${count}`);
  }

  if (errors.length > 0) {
    console.log(`\n❌ FIRST 10 FAILURES:`);
    errors.slice(0, 10).forEach((error, index) => {
      console.log(`\n[${index + 1}]`);
      console.log(JSON.stringify(error, null, 2));
    });
  }

  return report;
}

if (require.main === module) {
  // Support running specific endpoints via CLI argument:
  // e.g. node test/load/stress-test.js --health-only
  // e.g. node test/load/stress-test.js --deep-only
  let endpointsToTest = null;

  if (process.argv.includes('--health-only')) {
    endpointsToTest = [{ url: '/api/v1/health', headers: {} }];
  } else if (process.argv.includes('--deep-only')) {
    endpointsToTest = [{ url: '/api/v1/health/deep', headers: {} }];
  }

  const isRateLimitTest = process.argv.includes('--with-rate-limiter');

  runLoadStressTest(200, 20, endpointsToTest)
    .then((report) => {
      if (isRateLimitTest && report.statusCounts['429']) {
        console.log(`\n🛡️ RATE LIMITER VALIDATION: Successfully intercepted ${report.statusCounts['429']} requests with HTTP 429!`);
        process.exit(0);
      } else if (report.failures === 0) {
        console.log('\n✅ Stress test PASSED with 0 errors!');
        process.exit(0);
      } else {
        console.error('\n❌ Stress test finished with failures');
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error('\n❌ Stress test failed with exception:', err);
      process.exit(1);
    });
}

module.exports = {
  runLoadStressTest,
};
