#!/bin/bash
# I/O configuration
ca_name=ca
server_name=shield

# CA
ca_config_file=${ca_name}-csr.conf
ca_key_file=${ca_name}-key.pem
ca_cert_file=${ca_name}-cert.pem

# Server
server_config_file=${server_name}-csr.conf
server_key_file=${server_name}-key.pem
server_csr_file=${server_name}-csr.pem
server_cert_file=${server_name}-cert.pem
# optional key encryption
function protectKey() {
  local ENC_KEY=$(openssl rsa -aes256 -in ${server_key_file})
  if [[ $? == 0 ]]; then
    echo "${ENC_KEY}" > ${server_key_file}
  fi
}

# arguments
if [[ $1 == "-protect" ]]; then
  protectKey
  exit
fi  

# generate missing CA
if [[ ! -f ${ca_key_file} ]] || [[ ! -f ${ca_cert_file} ]]; then
  openssl genrsa -out ${ca_key_file} 2048
  openssl req -new -sha256 -x509 -days 1024 -config ${ca_config_file} -key ${ca_key_file} -out ${ca_cert_file}
fi

# generate Server CSR
if [[ ! -f ${server_key_file} ]] || [[ ! -f ${server_csr_file} ]]; then
  openssl genrsa -out ${server_key_file} 2048
  openssl req -new -sha256 -config ${server_config_file} -key ${server_key_file} -out ${server_csr_file}
fi

# sign Server
CN=$(openssl req -in ${server_csr_file} -noout -subject -nameopt multiline | grep commonName | sed -n 's/ *commonName *= //p')
openssl x509 -sha256 -req -days 365 -in ${server_csr_file} -CA ${ca_cert_file} -CAkey ${ca_key_file} -CAcreateserial -out ${server_cert_file} -extensions v3_ca -extfile <(cat << EXT
[ v3_ca ]
basicConstraints       = CA:false
subjectKeyIdentifier   = hash
authorityKeyIdentifier = keyid,issuer
subjectAltName         = DNS:${CN}
EXT
)