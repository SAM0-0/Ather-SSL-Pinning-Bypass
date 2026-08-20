# Ather SSL Pinning & Security Bypass

A Frida script that bypasses **root detection**, **Frida detection**, and **SSL pinning** in the **Ather Mobile App** (`com.athermobileapp`).

## Features

### Root Detection Bypass
- `performSecurityCheck` → returns clean result
- `checkRootBinaries` → `false`
- `checkRootPackages` → `false`
- `checkSuExistence` → `false`
- `checkDangerousProps` → `false`
- `isSystemPartitionReadWrite` → `false`
- `checkSELinuxStatus` → `false`
- `isEnvironmentSuspect` → `false`

### Frida Detection Bypass
- `checkFridaProcesses` → `false`
- `checkFridaPorts` → `false`
- `checkFridaArtifacts` → `false`

### File & Path Hooks
- Blocks `File.exists()` on su binaries and frida-server paths
- Blocks `File.canExecute()` on su binaries
- Sanitizes `PATH` environment variable to remove `/su` paths
- Intercepts `FileReader` to spoof SELinux enforce status
- Rewrites `/proc/mounts` to show system as `ro` instead of `rw`
- Filters Frida ports (`69AA`, `69AB`) from `/proc/net/tcp`
- Intercepts `Runtime.exec` for `ps` commands
- Blocks `String.contains` checks for `frida`, `xposed`, `substrate`

### SSL Pinning Bypass
- **OkHttp3 CertificatePinner** — `check` and `check$okhttp` bypassed
- **TrustManagerImpl** — `verifyChain` returns untrusted chain
- **X509TrustManager** — Custom `TrustAllManager` registered
- **HostnameVerifier** — Custom verifier always returns `true`
- **OkHttp3 OkHostnameVerifier** — Both overloads bypassed
- **WebViewClient** — `onReceivedSslError` auto-proceeds

## Requirements

- [Frida](https://frida.re/) installed on host
- `frida-server` running on rooted Android device
- Target app: `com.athermobileapp`

## Usage

```bash
frida -U -f com.athermobileapp -l ather-bypass.js --no-pause
```

Or attach to a running app:

```bash
frida -U com.athermobileapp -l ather-bypass.js
```

## Console Output

```
========================================
[*] Ather Security Bypass + SSL Bypass loaded
[*] Root checks:   BYPASSED (6)
[*] Frida checks:  BYPASSED (3)
[*] SSL pinning:   BYPASSED
[*] File hooks:    ACTIVE
========================================
```

## Disclaimer

This tool is for **educational and authorized security testing purposes only**. Unauthorized access to computer systems is illegal. Always obtain proper authorization before testing.

## License

MIT
