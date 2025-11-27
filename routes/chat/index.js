var express = require('express');
var SunshineConversationsClient = require('sunshine-conversations-client');
// var defaultClient = SunshineConversationsClient.ApiClient.instance;
var router = express.Router();
const suncoAppId = process.env.SUNCO_APP_ID;
const ultimateSwIntegrationId = process.env.SUNCO_ULTIMATE_SW_ID;
const ultimateWhitelistChannel = process.env.SUNCO_ULTIMATE_WHITELIST_ID;
const zdMarketplaceFieldId = process.env.ZD_MARKETPLACE_FIELD_ID || '44657252529561';

router.post('/dispatcher/zero', async function(req, res, next) {
    if (!req.body.events) {
        console.log(req.body);
        return res.status(400).send({ error: 'No events in request body' });
    }
    const eventPayload = req.body.events[0];
    const convPayload = eventPayload.payload.conversation;
    const messagePayload = eventPayload.payload.message;
    // const conversationId = '6926b0273716e2f43d05c382';
    const inboundConversationId = convPayload.id;
    const inboundConversationUserId = messagePayload.author.userId;
    const inboundConversationContent = messagePayload.content;
    const inboundSource = messagePayload.source.type;
    // const activeSw = convPayload.activeSwitchboardIntegration.id;
    // const eventsId = eventPayload.id;
    const conversationMetadata = convPayload.metadata;
    try {
        if ((conversationMetadata) && (conversationMetadata[`dataCapture.ticketField.${zdMarketplaceFieldId}`] == ultimateWhitelistChannel) 
            && inboundSource == 'api:conversations') {
            const passControlApi = new SunshineConversationsClient.SwitchboardActionsApi();
            let passControlBody = new SunshineConversationsClient.PassControlBody();
            passControlBody = {
                switchboardIntegration: ultimateSwIntegrationId
            }
            const postMessageApi = new SunshineConversationsClient.MessagesApi();
            let postMessageBody = new SunshineConversationsClient.MessagePost();
            postMessageBody = {
                author: {
                    type: 'user',
                    userId: inboundConversationUserId
                },
                content: inboundConversationContent
            }
            console.log('dispatcher zero - passing conversation id : ', inboundConversationId);
            await passControlApi.passControl(suncoAppId, inboundConversationId, passControlBody);
            await postMessageApi.postMessage(suncoAppId, inboundConversationId, postMessageBody);
            res.status(200).send({ dispatch_zero: 'Message passed and message posted'});
        } else {
            console.log('Other inbound conversation id ---- bypass to agent')
            await bypassToAgent(inboundConversationId, conversationMetadata);
            res.status(200).send({ dispatch_zero: 'bypassed to agent'});
        }
    } catch (error) {
        await bypassToAgent(inboundConversationId, conversationMetadata);
        if (error.status && error.body) {
            console.log(error.status);
            if (error.body.errors) {
                console.log(error.body.errors);
                return res.status(error.status).send({error: error.body.errors});
            } else {
                console.log(error.body);
                return res.status(error.status).send({error: error.body});
            }
            // if (error.status >= 500 && error.status < 600) {}
        } else {
            return res.status(500).send({error: error});
        }
    }
});

router.post('/dispatcher/one', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

async function bypassToAgent (conversationId, metadata) {
    console.log('bypass to agent - passing conversation id : ', conversationId);
    console.log('bypass to agent - passing metadata : ', metadata);
    const passControlApi = new SunshineConversationsClient.SwitchboardActionsApi();
    let passControlBody = new SunshineConversationsClient.PassControlBody();
    passControlBody = {
        switchboardIntegration: 'zd-agentWorkspace',
        metadata: metadata
    }
    await passControlApi.passControl(suncoAppId, conversationId, passControlBody);
}

module.exports = router;
