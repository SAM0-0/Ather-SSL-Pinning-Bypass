/*
 * Ather App Root/Frida Detection + SSL Bypass
 * Target: com.athermobileapp
 */

Java.perform(function () {

    // ========== ROOT CHECK BYPASS ==========
    var SecurityCheck = Java.use("com.ather.common.utils.coreUtils.SecurityCheck");

    SecurityCheck.performSecurityCheck.implementation = function () {
        console.log("[BYPASS] performSecurityCheck -> Secure");
        return Java.use("com.ather.common.utils.coreUtils.SecurityCheck$a$b").$new();
    };

    SecurityCheck.isEnvironmentSuspect.implementation = function () {
        return false;
    };

    SecurityCheck.checkRootBinaries.implementation = function () {
        console.log("[BYPASS] checkRootBinaries -> false");
        return false;
    };

    SecurityCheck.checkRootPackages.implementation = function () {
        console.log("[BYPASS] checkRootPackages -> false");
        return false;
    };

    SecurityCheck.checkSuExistence.implementation = function () {
        console.log("[BYPASS] checkSuExistence -> false");
        return false;
    };

    SecurityCheck.checkDangerousProps.implementation = function () {
        console.log("[BYPASS] checkDangerousProps -> false");
        return false;
    };

    SecurityCheck.isSystemPartitionReadWrite.implementation = function () {
        console.log("[BYPASS] isSystemPartitionReadWrite -> false");
        return false;
    };

    SecurityCheck.checkSELinuxStatus.implementation = function () {
        console.log("[BYPASS] checkSELinuxStatus -> false");
        return false;
    };

    // ========== FRIDA DETECTION BYPASS ==========
    SecurityCheck.checkFridaProcesses.implementation = function () {
        console.log("[BYPASS] checkFridaProcesses -> false");
        return false;
    };

    SecurityCheck.checkFridaPorts.implementation = function () {
        console.log("[BYPASS] checkFridaPorts -> false");
        return false;
    };

    SecurityCheck.checkFridaArtifacts.implementation = function () {
        console.log("[BYPASS] checkFridaArtifacts -> false");
        return false;
    };

    // ========== FILE HOOKS ==========
    var File = Java.use("java.io.File");
    File.exists.implementation = function () {
        var path = this.getAbsolutePath();
        var blocked = [
            "/system/bin/su", "/system/xbin/su", "/sbin/su",
            "/data/local/xbin/su", "/su/bin/su",
            "/data/local/tmp/frida-server", "/data/local/frida-server",
            "/system/lib/libfrida.so"
        ];
        if (blocked.indexOf(path) !== -1) {
            console.log("[BYPASS] File.exists -> false: " + path);
            return false;
        }
        return this.exists();
    };

    File.canExecute.implementation = function () {
        var path = this.getAbsolutePath();
        var blocked = [
            "/system/bin/su", "/system/xbin/su", "/sbin/su",
            "/data/local/xbin/su", "/su/bin/su"
        ];
        if (blocked.indexOf(path) !== -1) {
            return false;
        }
        return this.canExecute();
    };

    // ========== PATH SANITIZE ==========
    var System = Java.use("java.lang.System");
    System.getenv.overload("java.lang.String").implementation = function (key) {
        var val = this.getenv(key);
        if (key === "PATH" && val !== null) {
            var paths = val.split(":");
            var clean = [];
            for (var i = 0; i < paths.length; i++) {
                if (paths[i].indexOf("/su") === -1) {
                    clean.push(paths[i]);
                }
            }
            console.log("[BYPASS] PATH sanitized");
            return clean.join(":");
        }
        return val;
    };

    // ========== SELINUX HOOK ==========
    var FileReader = Java.use("java.io.FileReader");
    FileReader.$init.overload("java.lang.String").implementation = function (path) {
        if (path === "/sys/fs/selinux/enforce") {
            var tmpFile = Java.use("java.io.File").$new("/data/local/tmp/.selinux_bypass");
            tmpFile.createNewFile();
            var fos = Java.use("java.io.FileOutputStream").$new(tmpFile);
            fos.write(Java.use("java.lang.String").$new("1").getBytes());
            fos.close();
            this.$init(tmpFile.getAbsolutePath());
            return;
        }
        this.$init(path);
    };

    // ========== /proc/mounts HOOK ==========
    var BufferedReader = Java.use("java.io.BufferedReader");
    var originalReadLine = BufferedReader.readLine.overload();
    BufferedReader.readLine.overload().implementation = function () {
        var line = originalReadLine.call(this);
        if (line !== null && line.indexOf("/system ") !== -1 && line.indexOf("rw,") !== -1) {
            line = line.replace("rw,", "ro,");
            console.log("[BYPASS] /proc/mounts system -> read-only");
        }
        return line;
    };

    // ========== /proc/net/tcp HOOK ==========
    var FileInputStream = Java.use("java.io.FileInputStream");
    try {
        var originalRead = FileInputStream.read.overload("[B");
        FileInputStream.read.overload("[B").implementation = function (buf) {
            var result = originalRead.call(this, buf);
            if (result > 0) {
                var content = Java.use("java.lang.String").$new(buf, 0, result);
                if (content.indexOf("69AA") !== -1 || content.indexOf("69aa") !== -1 ||
                    content.indexOf("69AB") !== -1 || content.indexOf("69ab") !== -1) {
                    content = content.replace(/.*69[aaAbB].*\n/g, "");
                    var newBuf = content.getBytes();
                    Java.use("java.lang.System").arraycopy(newBuf, 0, buf, 0, newBuf.length);
                    console.log("[BYPASS] Frida ports filtered");
                    return newBuf.length;
                }
            }
            return result;
        };
        console.log("[SSL] FileInputStream.read hooked");
    } catch(e) {
        console.log("[SSL] FileInputStream.read hook skipped: " + e);
    }

    // ========== /proc cmdline HOOK ==========
    try {
        var Runtime = Java.use("java.lang.Runtime");
        Runtime.exec.overload("java.lang.String").implementation = function (cmd) {
            if (cmd.indexOf("ps") !== -1) {
                console.log("[BYPASS] ps intercepted");
            }
            return this.exec(cmd);
        };
        console.log("[BYPASS] Runtime.exec hooked");
    } catch(e) {
        console.log("[BYPASS] Runtime.exec hook skipped: " + e);
    }

    // ========== STRING CONTAINS HOOK ==========
    var String = Java.use("java.lang.String");
    String.contains.implementation = function (str) {
        var thisStr = this.toString();
        var searchStr = str.toString();
        if (searchStr === "frida" || searchStr === "frida-server" ||
            searchStr === "xposed" || searchStr === "substrate") {
            if (thisStr.indexOf("/proc/") !== -1 || thisStr.indexOf("/data/") !== -1) {
                console.log("[BYPASS] String.contains blocked: " + searchStr);
                return false;
            }
        }
        return this.contains(str);
    };

    // =============================================
    // SSL PINNING BYPASS
    // =============================================

    // OkHttp3 CertificatePinner
    try {
        var CertPinner = Java.use("okhttp3.CertificatePinner");
        CertPinner.check.overload("java.lang.String", "java.util.List").implementation = function (hostname, peerCertificates) {
            console.log("[SSL] OkHttp3 CertificatePinner.check bypassed for: " + hostname);
        };
        console.log("[SSL] OkHttp3 CertificatePinner hooked");
    } catch (e) {
        console.log("[SSL] OkHttp3 CertificatePinner not found, skipping");
    }

    // OkHttp3 CertificatePinner (alternative overload)
    try {
        var CertPinner2 = Java.use("okhttp3.CertificatePinner");
        CertPinner2.check$okhttp.overload("java.lang.String", "kotlin.jvm.functions.Function0").implementation = function (hostname, cleanupFn) {
            console.log("[SSL] OkHttp3 check$okhttp bypassed for: " + hostname);
        };
        console.log("[SSL] OkHttp3 check$okhttp hooked");
    } catch (e) {
        console.log("[SSL] OkHttp3 check$okhttp not found, skipping");
    }

    // TrustManagerImpl (Android platform)
    try {
        var TrustManagerImpl = Java.use("com.android.org.conscrypt.TrustManagerImpl");
        TrustManagerImpl.verifyChain.implementation = function (untrustedChain, trustAnchorChain, host, clientAuth, ocspData, tlsSctData) {
            console.log("[SSL] TrustManagerImpl.verifyChain bypassed for: " + host);
            return untrustedChain;
        };
        console.log("[SSL] TrustManagerImpl hooked");
    } catch (e) {
        console.log("[SSL] TrustManagerImpl not found, skipping");
    }

    // X509TrustManager
    try {
        var X509TM = Java.use("javax.net.ssl.X509TrustManager");
        var SSLContext = Java.use("javax.net.ssl.SSLContext");
        var TrustAllTM = Java.registerClass({
            name: "com.bypass.TrustAllManager",
            implements: [X509TM],
            methods: {
                checkClientTrusted: function (chain, authType) { },
                checkServerTrusted: function (chain, authType) { },
                getAcceptedIssuers: function () { return []; }
            }
        });
        var TrustAllArray = [TrustAllTM.$new()];
        var SSLContextInit = SSLContext.init.overload("[Ljavax.net.ssl.KeyManager;", "[Ljavax.net.ssl.TrustManager;", "java.security.SecureRandom");
        SSLContextInit.implementation = function (km, tm, sr) {
            console.log("[SSL] SSLContext.init -> TrustAllManager");
            SSLContextInit.call(this, km, TrustAllArray, sr);
        };
        console.log("[SSL] X509TrustManager hooked");
    } catch (e) {
        console.log("[SSL] X509TrustManager hook failed: " + e);
    }

    // HostnameVerifier
    try {
        var HostnameVerifier = Java.use("javax.net.ssl.HostnameVerifier");
        var SSLSocketFactory = Java.use("javax.net.ssl.SSLSocketFactory");
        var SSLSession = Java.use("javax.net.ssl.SSLSession");

        var HostnameVerifierImpl = Java.registerClass({
            name: "com.bypass.HostnameVerifierImpl",
            implements: [HostnameVerifier],
            methods: {
                verify: function (hostname, session) {
                    console.log("[SSL] HostnameVerifier.verify bypassed for: " + hostname);
                    return true;
                }
            }
        });

        var HttpsURLConnection = Java.use("javax.net.ssl.HttpsURLConnection");
        HttpsURLConnection.setDefaultHostnameVerifier.implementation = function (verifier) {
            console.log("[SSL] HttpsURLConnection.setDefaultHostnameVerifier -> TrustAll");
            HttpsURLConnection.setDefaultHostnameVerifier.call(this, HostnameVerifierImpl.$new());
        };
        HttpsURLConnection.setHostnameVerifier.implementation = function (verifier) {
            console.log("[SSL] HttpsURLConnection.setHostnameVerifier -> TrustAll");
            HttpsURLConnection.setHostnameVerifier.call(this, HostnameVerifierImpl.$new());
        };
        console.log("[SSL] HostnameVerifier hooked");
    } catch (e) {
        console.log("[SSL] HostnameVerifier hook failed: " + e);
    }

    // OkHttp3 built-in hostname verifier
    try {
        var OkHostnameVerifier = Java.use("okhttp3.internal.tls.OkHostnameVerifier");
        OkHostnameVerifier.verify.overload("java.lang.String", "java.security.cert.X509Certificate").implementation = function (hostname, cert) {
            console.log("[SSL] OkHostnameVerifier.verify bypassed for: " + hostname);
            return true;
        };
        OkHostnameVerifier.verify.overload("java.lang.String", "javax.net.ssl.SSLSession").implementation = function (hostname, session) {
            console.log("[SSL] OkHostnameVerifier.verify bypassed for: " + hostname);
            return true;
        };
        console.log("[SSL] OkHttp3 OkHostnameVerifier hooked");
    } catch (e) {
        console.log("[SSL] OkHttp3 OkHostnameVerifier not found, skipping");
    }

    // WebViewClient SSL error handler
    try {
        var WebViewClient = Java.use("android.webkit.WebViewClient");
        WebViewClient.onReceivedSslError.implementation = function (view, handler, error) {
            console.log("[SSL] WebViewClient.onReceivedSslError -> proceed");
            handler.proceed();
        };
        console.log("[SSL] WebViewClient SSL hooked");
    } catch (e) {
        console.log("[SSL] WebViewClient hook failed: " + e);
    }

    console.log("\n========================================");
    console.log("[*] Ather Security Bypass + SSL Bypass loaded");
    console.log("[*] Root checks:   BYPASSED (6)");
    console.log("[*] Frida checks:  BYPASSED (3)");
    console.log("[*] SSL pinning:   BYPASSED");
    console.log("[*] File hooks:    ACTIVE");
    console.log("========================================\n");
});
