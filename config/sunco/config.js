let SunshineConversationsClient = require('sunshine-conversations-client');

let defaultClient = SunshineConversationsClient.ApiClient.instance;
let basicAuth = defaultClient.authentications['basicAuth'];
basicAuth.username = process.env.SUNCO_KEY_ID;
basicAuth.password = process.env.SUNCO_KEY_SECRET;

module.exports = {
    defaultClient
};
