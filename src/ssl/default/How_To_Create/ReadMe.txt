Here will be explained, how can you create the Private Key,
Certificate Request and Self-Signed Certificate at once.

There two scripts, you can use for it: Windows PowerShell Script and Windows Batch Script.
Both Scripts do the same thing, so you can choose the way you prefer.

There is one Important Thing, equal for both ways:
!! You need to run the Script on Windows OS, which have an Internet Explorer !!

So, how to use the Scripts exactly?
If you prefer "bat"-File, Be Careful with variables Declaration!!
spaces by equal sign are forbidden!! (right: "var=value", wrong: "var= value")
If you can't run "ps1"-File, try to start PowerShell as Administrator and call "set-executionpolicy remotesigned"

Before you start the prefered Script, please set important variables, like said below (under 1.)
(! You can skip next part (1-3), if Certificate is needed only for Developement (not public use) !)

  1. As first you need to put all the information under the "-- Certificate Information --" comment
     pass_length refers to the password that you need to protect your private key.
     The key is useful without that phrase. That password by default will be written to ./cert/pass.txt

  2. You can also change the path for output files under the "-- Paths --" comment

  3. The creation of certificate runs with openssl.
     Commands for creating the file are explained under comment "** Create a Certificate **"
     Better explanation you can find under: https://nodejs.org/api/tls.html#tls_tls_ssl

You will get 4 Files (under "./cert" by default)
"ca.key" is your private key
"ca.pw.json" includes password for your private key
"domain_name_csr.pem" is the Signification Request, you should provide to your Certificate Authority
"ca.crt" is self-signed certificate you can use for some tests till your Request is officially signed

To run the server you'll need to place "ca.key", "ca.crt" and "ca.pw.json" to the "src/ssl" directory of the server.


----- Procedure of Official certification -----

If you want to officially sign your Certificate, you need to provide "domain_name_csr.pem" to your Certificate Authority.
After Certificate Authority has approved your request, they should provide you with officially-signed certificate,
that you need to use instead of self-generated "ca.crt".
IMPORTANT! If you don't follow the next step, your page will be shown as insecure!!
You'll need to get the latest version of every Certificate in Certification Chain
and place it into "src/ssl/cert_chain" directory!
