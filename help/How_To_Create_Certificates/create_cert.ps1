# important dependencies
$env:RANDFILE = ".rnd"
$env:OPENSSL_CONF = "openssl.cnf"
$scriptpath = $MyInvocation.MyCommand.Path
$dir = Split-Path $scriptpath
Push-Location $dir

# -- Certificate Information --
$country = "DE"                          # Country Name (2 letter code)
$state = "Nordrhein-Westfalen"           # State or Province Name (full name)
$city = "Juelich"                        # Locality Name (eg, city)
$company = "Forschungszentrum Juelich"   # Organization Name (eg, company)
$company_unit = "ICS-TAE"                # Organizational Unit Name (eg, section)
$domain = "hnf-gds.ibn.kfa-juelich.de"   # Domain Name (Address)
$email = "n.tiefes@fz-juelich.de"        # Email Address
$days = "1100"                           # Certificate validity duration in days

$pass_length = 256;                      # Length of passphrase (min 4, max 1024)

# -- Paths --
$output_dir = ".\cert"                   # where to write output files
$pass_json = $output_dir + "\ca.pw.json" # where to store the password

# Generate password
$pass = (./openssl.exe rand -base64 $pass_length) | Out-String 
$pass = $pass -replace "`n|`r",""

# Check if outputdir exists. If not -> create it.
if(!(Test-Path -Path $output_dir )){
    New-Item -ItemType directory -Path $output_dir | out-null
}

# Store passwords
[io.file]::WriteAllText($pass_json, "{ `"password`": `"$pass`" }")

# Put the Infos together
$subj = "/C=$country/ST=$state/L=$city/O=$company/OU=$company_unit/CN=$domain/emailAddress=$email"

# ** Create a Certificate **

# generate a private key for CA
./openssl.exe genrsa -passout pass:$pass -des3 `
            -out "$output_dir\ca.key" 4096
            
# generate the certificate signing request          
./openssl.exe req -passin pass:$pass `
            -new `
            -sha256 `
            -key "$output_dir\ca.key" `
            -subj $subj `
            -out "$output_dir\$($domain)_CSR.pem"

# Create self-signed public key
./openssl.exe x509 -passin pass:$pass `
            -req `
            -sha256 `
            -days $days% `
            -in "$output_dir\$($domain)_CSR.pem" `
            -signkey "$output_dir\ca.key"`
            -out "$output_dir\ca.crt"

# Remove temporary files
If (Test-Path $env:RANDFILE){
	Remove-Item $env:RANDFILE
}
If (Test-Path ".srl"){
	Remove-Item ".srl"
}

echo "Certificate Creation succesfully done"
$HOST.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") | OUT-NULL
$HOST.UI.RawUI.Flushinputbuffer()