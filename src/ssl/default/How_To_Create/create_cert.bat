@echo off &setlocal enabledelayedexpansion
cd %~dp0

rem important dependencies
set RANDFILE=.rnd
set OPENSSL_CONF=openssl.cnf

rem BE CAREFUL WITH EQUAL SIGN! PLEASE NO SPACES ON BOTH SIDES!! (eg. "var=value")

rem -- Certificate Information --
set "country=DE"&                         rem Country Name (2 letter code)
set "state=Nordrhein-Westfalen"&          rem State or Province Name (full name)
set "city=Juelich"&                       rem Locality Name (eg, city)
set "company=Forschungszentrum Juelich"&  rem Organization Name (eg, company)           
set "company_unit=ICS-TAE"&               rem Organizational Unit Name (eg, section)
set "domain=hnf-gds.ibn.kfa-juelich.de"&  rem Domain Name (Address)
set "email=n.tiefes@fz-juelich.de"&       rem Email Address
set "days=1100"&                          rem Certificate validity duration in days

rem Length of passphrase (min 4, max 1024)
set pass_length=256;                    

rem -- Paths --
set output_dir=.\cert&                    rem where to write output files
set pass_json=%output_dir%\ca.pw.json&    rem where to store the password

rem Check if outputdir exists. If not -> create it.
if not exist "%output_dir%" ( mkdir "%output_dir%" )

rem Generate password
for /f "delims=" %%a in ('openssl rand -base64 %pass_length%') do set "pass=!pass!%%a"
echo { "password": "%pass%" } > %pass_json%

rem Put the Infos together
set "subj=/C=%country%/ST=%state%/L=%city%/O=%company%/OU=%company_unit%/CN=%domain%/emailAddress=%email%"

rem ** Create a Certificate **

rem generate a private key for CA
openssl genrsa -passout pass:%pass% -des3 ^
            -out %output_dir%\ca.key 4096
            
rem generate the certificate signing request  
openssl req -passin pass:%pass% ^
            -new ^
            -sha256 ^
            -key %output_dir%\ca.key ^
            -subj "%subj%" ^
            -out %output_dir%\%domain%_CSR.pem
            
rem Create self-signed public key
openssl x509 -passin pass:%pass% ^
            -req ^
            -sha256 ^
            -days %days% ^
            -in %output_dir%\%domain%_CSR.pem ^
            -signkey %output_dir%\ca.key ^
            -out %output_dir%\ca.crt

rem Remove temporary Files
if exist "%RANDFILE%" ( del "%RANDFILE%" )
if exist ".srl" ( del ".srl" )

echo Certificate Creation succesfully done
pause