#!/bin/bash
# I/O configuration
ca_name=ca
server_name=shield
client_name=client

# fix for loading cerificate config
SCRIPT_LINK=$(readlink $0)
if [ -z ${SCRIPT_LINK} ]; then
  CONF_DIR="$( cd $(dirname $0) && pwd)"
else
  CONF_DIR="$( cd "$(dirname $0)" && cd "$(dirname ${SCRIPT_LINK})" && pwd)"
fi;

# CA
ca_config_file="${CONF_DIR}/${ca_name}-csr.conf"
ca_key_file=${ca_name}-key.pem
ca_cert_file=${ca_name}-cert.pem

# Server
server_config_file="${CONF_DIR}/${server_name}-csr.conf"
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

# Generate client certificate
if [[ $1 != "-client" ]]; then
  exit
fi  

# Client
client_config_file="${CONF_DIR}/${client_name}-csr.conf"
client_key_file=${client_name}-key.pem
client_csr_file=${client_name}-csr.pem
client_cert_file=${client_name}-cert.pem
client_p12_file=${client_name}.p12

# generate Client CSR
if [[ ! -f ${client_key_file} ]] || [[ ! -f ${client_csr_file} ]]; then
  openssl genrsa -out ${client_key_file} 2048
  openssl req -new -sha256 -config ${client_config_file} -key ${client_key_file} -out ${client_csr_file}
fi

# sign Client
openssl x509 -sha256 -req -days 365 -in ${client_csr_file} -CA ${ca_cert_file} -CAkey ${ca_key_file} -CAcreateserial -out ${client_cert_file} -extensions v3_ca -extfile <(cat << EXT
[ v3_ca ]
basicConstraints       = CA:false
subjectKeyIdentifier   = hash
authorityKeyIdentifier = keyid,issuer
EXT
)

# package Client cert + key
openssl pkcs12 -export -out ${client_p12_file} -inkey ${client_key_file} -in ${client_cert_file} -certfile ${ca_cert_file}