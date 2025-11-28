const CryptoJS = require('crypto-js')
require('dotenv').config();
const kesetSecret = 'W3lcome123';

function getDecryptedString (str){
  const bytes = CryptoJS.AES.decrypt(str, kesetSecret)
  const decryptedData = bytes.toString(CryptoJS.enc.Utf8)
  return decryptedData;
}

function doEncryptString (str) {
  const ciphertext = CryptoJS.AES.encrypt(str, kesetSecret).toString();
  return ciphertext;
}

module.exports = {
    getDecryptedString,
    doEncryptString
};