#!/bin/sh

# CA
ca_name=ca
ca_key_file=${ca_name}-key.pem
ca_cert_file=${ca_name}-cert.pem

openssl genrsa -out ${ca_key_file} 2048
openssl req -new -sha256 -x509 -days 1024 -key ${ca_key_file} -out ${ca_cert_file} 

# Server
server_name=shield
server_key_file=${server_name}-key.pem
server_csr_file=${server_name}-csr.pem
server_cert_file=${server_name}-cert.pem

openssl genrsa -out ${server_key_file} 2048
openssl req -new -sha256 -key ${server_key_file} -out ${server_csr_file}
openssl x509 -sha256 -req -days 365 -in ${server_csr_file} -CA ${ca_cert_file} -CAkey ${ca_key_file} -CAcreateserial -out ${server_cert_file}