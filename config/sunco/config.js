let SunshineConversationsClient = require('sunshine-conversations-client');
const { getDecryptedString } = require('../encrypt/config');
const suncoConfigEncrypted = process.env.SUNCO;
const suncoConfigDecrypted = JSON.parse(getDecryptedString(suncoConfigEncrypted));

let defaultClient = SunshineConversationsClient.ApiClient.instance;
let basicAuth = defaultClient.authentications['basicAuth'];
basicAuth.username = suncoConfigDecrypted.key_id;
basicAuth.password = suncoConfigDecrypted.secret;

module.exports = {
    defaultClient
};
