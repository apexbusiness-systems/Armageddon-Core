
const forge = require('node-forge');
const fs = require('fs');
const path = require('path');

const certsDir = path.join(__dirname, '../certs');
if (!fs.existsSync(certsDir)) {
    fs.mkdirSync(certsDir, { recursive: true });
}

console.log('Generating Armageddon CA...');
const caKeys = forge.pki.rsa.generateKeyPair(2048);
const caCert = forge.pki.createCertificate();
caCert.publicKey = caKeys.publicKey;
caCert.serialNumber = '01';
caCert.validity.notBefore = new Date();
caCert.validity.notAfter = new Date();
caCert.validity.notAfter.setFullYear(caCert.validity.notBefore.getFullYear() + 1);
const caAttrs = [{
    name: 'commonName',
    value: 'Armageddon CA'
}];
caCert.setSubject(caAttrs);
caCert.setIssuer(caAttrs);
caCert.setExtensions([{
    name: 'basicConstraints',
    cA: true
}]);
caCert.sign(caKeys.privateKey, forge.md.sha256.create());

console.log('Generating Client Certificate...');
const clientKeys = forge.pki.rsa.generateKeyPair(2048);
const clientCert = forge.pki.createCertificate();
clientCert.publicKey = clientKeys.publicKey;
clientCert.serialNumber = '02';
clientCert.validity.notBefore = new Date();
clientCert.validity.notAfter = new Date();
clientCert.validity.notAfter.setFullYear(clientCert.validity.notBefore.getFullYear() + 1);
const clientAttrs = [{
    name: 'commonName',
    value: 'Armageddon Client'
}];
clientCert.setSubject(clientAttrs);
clientCert.setIssuer(caAttrs);
clientCert.setExtensions([{
    name: 'basicConstraints',
    cA: false
}, {
    name: 'keyUsage',
    keyCertSign: false,
    digitalSignature: true,
    keyEncipherment: true,
    dataEncipherment: true
}, {
    name: 'extKeyUsage',
    clientAuth: true,
    serverAuth: true
}]);
clientCert.sign(caKeys.privateKey, forge.md.sha256.create());

// Save Files
const caPem = forge.pki.certificateToPem(caCert);
const caKeyPem = forge.pki.privateKeyToPem(caKeys.privateKey);
const clientPem = forge.pki.certificateToPem(clientCert);
const clientKeyPem = forge.pki.privateKeyToPem(clientKeys.privateKey);

fs.writeFileSync(path.join(certsDir, 'ca.pem'), caPem);
fs.writeFileSync(path.join(certsDir, 'ca.key'), caKeyPem);
fs.writeFileSync(path.join(certsDir, 'client.pem'), clientPem);
fs.writeFileSync(path.join(certsDir, 'client.key'), clientKeyPem);

console.log('✅ Certificates generated in certs/ directory.');
console.log('ACTION REQUIRED: Upload certs/ca.pem to Temporal Cloud Namespace settings.');
