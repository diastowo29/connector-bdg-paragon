const CryptoJS = require('crypto-js')
require('dotenv').config();
const keset = process.env.KESET;

function getDecryptedString (str){
  const bytes = CryptoJS.AES.decrypt(str, keset)
  const decryptedData = bytes.toString(CryptoJS.enc.Utf8)
  return decryptedData;
}

function doEncryptString (str) {
  const ciphertext = CryptoJS.AES.encrypt(str, keset).toString();
  return ciphertext;
}

module.exports = {
    getDecryptedString,
    doEncryptString
};