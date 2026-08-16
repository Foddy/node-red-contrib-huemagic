# Test fixtures

`key.pem` / `cert.pem` are a throwaway self-signed certificate for the fake Hue Bridge
in `test/eventstream.test.js`. It only ever serves `127.0.0.1` on a random port during
the test run and grants access to nothing. Do not reuse it anywhere else.

Regenerate with:

```
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 36500 -nodes -subj "/CN=huemagic-test"
```
