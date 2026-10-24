if (process.argv.includes('--live')) throw new Error('The offline check cannot use --live.');
let fetchCalls = 0;
globalThis.fetch = (() => { fetchCalls++; throw new Error('HTTP fetch is disabled for the offline replay check.'); }) as typeof fetch;
await import('./demo-relief-agent');
if (fetchCalls !== 0) throw new Error('Offline replay attempted an HTTP fetch.');
console.log('Offline replay passed with HTTP fetch disabled; no sponsor or registry requests.');
