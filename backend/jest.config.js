// Raises Jest's default 5000ms hook/test timeout. This project's tests hit
// a real MongoDB Atlas cluster (no in-memory/mocked DB), and the free-tier
// cluster's connection setup — especially the first connect from any given
// test-worker process — has repeatedly taken longer than 5s under this
// session's actual network conditions, intermittently failing an
// unpredictable subset of suites' beforeAll hooks with "Exceeded timeout of
// 5000 ms for a hook" even though nothing in the test or the code under
// test is actually broken. This isn't masking a real failure — it's
// matching the timeout to real, observed Atlas connection latency.
module.exports = {
  testTimeout: 20000,
};
