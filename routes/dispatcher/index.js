var express = require('express');
var SunshineConversationsClient = require('sunshine-conversations-client');
const { getDecryptedString } = require('../../config/encrypt/config');
var router = express.Router();
const logger = require('pino')()

const suncoConfigEncrypted = process.env.SUNCO;
const zdFieldsEncrypted = process.env.ZD_TICKET_FIELDS;
const ultimateSwIntegrationId = process.env.SUNCO_ULTIMATE_SW_ID;
const ultimateWhitelistChannel = process.env.SUNCO_ULTIMATE_WHITELIST_ID;
const zdFieldsDecrypted = JSON.parse(getDecryptedString(zdFieldsEncrypted));
const suncoConfigDecrypted = JSON.parse(getDecryptedString(suncoConfigEncrypted));
const suncoAppId = suncoConfigDecrypted.app_id;
const zdMarketplaceFieldId = zdFieldsDecrypted.store;
const zdConversationFieldId = zdFieldsDecrypted.conversation_id;
const zdAffiliateFieldId = zdFieldsDecrypted.affiliate;

router.get('/logging', function(req, res, next) {
    let logs = {
        process: '/dispatcher/zero'
    }
    logger.info(logs);
    logger.warn(logs);
    logger.error(logs);
    logger.trace(logs);
    res.status(200).send({});
})

router.get('/config', function(req, res, next) {
    const fieldsList = JSON.parse(getDecryptedString(zdFieldsEncrypted));
    res.status(200).send({ticket_fields: fieldsList, sunco: suncoConfigDecrypted})
});

router.post('/zero', async function(req, res, next) {
    if (!req.body.events) {
        console.warn(req.body);
        return res.status(400).send({ error: 'No events in request body' });
    }
    let logs = {
        process: '/dispatcher/zero'
    }
    const eventPayload = req.body.events[0];
    const convPayload = eventPayload.payload.conversation;
    const messagePayload = eventPayload.payload.message;
    const inboundConversationId = convPayload.id;
    const inboundConversationUserId = messagePayload.author.userId;
    const inboundConversationContent = messagePayload.content;
    const inboundSource = messagePayload.source.type;
    // const activeSw = convPayload.activeSwitchboardIntegration.id;
    // const eventsId = eventPayload.id;
    const conversationMetadata = convPayload.metadata;
    try {
        logs['conversation_id'] = inboundConversationId;
        logs['message'] = `passing conversation ${inboundConversationId}`
        // console.info('dispatcher zero - passing conversation id : ', inboundConversationId);
        if (inboundSource != 'api:conversations') {
            logs['action'] = 'bypass to agent';
            logs['reason'] = 'non api:conversations';
            logger.info(logs);
            // console.info('non api:conversations - bypass to agent');
            await bypassToAgent(inboundConversationId, conversationMetadata);
            return res.status(200).send({ dispatch_zero: 'bypassed to agent'});
        }
        logs['action'] = 'pass';
        logger.info(logs);
        let affiliateTags = 'non_affiliate';
        let initiateTags = 'non_initiate';
        let isInitiate = false;
        if (conversationMetadata) {
            if (conversationMetadata[zdAffiliateFieldId] == 1) {
                affiliateTags = 'affiliate'
            }
            if (messagePayload.metadata) {
                if (messagePayload.metadata.agent_id) {
                    isInitiate = true;
                    initiateTags = 'initiate_chat'
                }
            }
            // const conversationApi = new SunshineConversationsClient.ConversationsApi();
            // let conversationBody = new SunshineConversationsClient.ConversationUpdateBody();
            // conversationBody = {
            //     metadata: {
            //         // 'dataCapture.systemField.tags': affiliateTags,
            //         [zdConversationFieldId]: inboundConversationId
            //     }
            // }
            // await conversationApi.updateConversation(suncoAppId, inboundConversationId, conversationBody);
            conversationMetadata['dataCapture.systemField.tags'] = `${initiateTags}`;
            conversationMetadata[zdConversationFieldId] = inboundConversationId;
            conversationMetadata[zdAffiliateFieldId] = affiliateTags;
            if (ultimateWhitelistChannel.includes(conversationMetadata[zdMarketplaceFieldId])) {
                if (isInitiate) {
                    // console.info(conversationMetadata);
                    await bypassToAgent(inboundConversationId, conversationMetadata);
                    res.status(200).send({ dispatch_zero: 'Message passed and message posted'});
                } else {
                    // console.info(conversationMetadata);
                    const passControlApi = new SunshineConversationsClient.SwitchboardActionsApi();
                    let passControlBody = new SunshineConversationsClient.PassControlBody();
                    passControlBody = {
                        switchboardIntegration: ultimateSwIntegrationId,
                        metadata: conversationMetadata
                    }
                    // console.info(passControlBody);
                    const postMessageApi = new SunshineConversationsClient.MessagesApi();
                    let postMessageBody = new SunshineConversationsClient.MessagePost();
                    postMessageBody = {
                        author: {
                            type: 'user',
                            userId: inboundConversationUserId
                        },
                        content: inboundConversationContent
                    }
                    console.info('dispatcher/zero - passing conversation id : ', inboundConversationId);
                    await passControlApi.passControl(suncoAppId, inboundConversationId, passControlBody);
                    await postMessageApi.postMessage(suncoAppId, inboundConversationId, postMessageBody);
                    res.status(200).send({ dispatch_zero: 'Message passed and message posted'});
                }
            } else {
                console.info('Other inbound conversation id ---- bypass to agent')
                await bypassToAgent(inboundConversationId, conversationMetadata);
                res.status(200).send({ dispatch_zero: 'bypassed to agent'});
            }
        } else {
            console.info('no metadata ---- bypass to agent')
            await bypassToAgent(inboundConversationId, conversationMetadata);
            res.status(200).send({ dispatch_zero: 'bypassed to agent'});
        }
    } catch (error) {
        console.warn('exception conversation : ', inboundConversationId)
        logs['body'] = req.body;
        await bypassToAgent(inboundConversationId, conversationMetadata);
        if (error.status && error.body) {
            if (error.body.errors) {
                logs['message'] = error.body.errors;
                logger.error(logs);
                return res.status(error.status).send({error: error.body.errors});
            } else {
                logs['message'] = error.body;
                logger.error(logs);
                return res.status(error.status).send({error: error.body});
            }
            // if (error.status >= 500 && error.status < 600) {}
        } else {
            logs['message'] = error;
            logger.error(logs);
            return res.status(500).send({error: error});
        }
    }
});

router.post('/one', async function(req, res, next) {
    let logs = {
        process: '/dispatcher/one'
    }
    const eventPayload = req.body.events[0];
    const convPayload = eventPayload.payload.conversation;
    const inboundConversationId = convPayload.id;
    const conversationMetadata = convPayload.metadata;
    logs['conversation_id'] = inboundConversationId;
    try {
        if (convPayload.activeSwitchboardIntegration.name == 'Dispatcher-One') {
            logs['action'] = 'pass';
            logger.info(logs);
            let affiliateTags = '';
            if (conversationMetadata) {
                if (conversationMetadata[zdAffiliateFieldId] == 1) {
                    affiliateTags = 'affiliate'
                }
                conversationMetadata[zdConversationFieldId] = inboundConversationId;
                conversationMetadata[zdAffiliateFieldId] = affiliateTags;
                // conversationMetadata[zdAffiliateFieldId] = affiliateTags;
                const passControlApi = new SunshineConversationsClient.SwitchboardActionsApi();
                let passControlBody = new SunshineConversationsClient.PassControlBody();
                passControlBody = {
                    switchboardIntegration: 'zd-agentWorkspace',
                    metadata: conversationMetadata
                }
                // console.info(passControlBody)
                await passControlApi.passControl(suncoAppId, inboundConversationId, passControlBody);
                res.status(200).send({ dispatch_one: 'Message passed and message posted'});
            } else {
                console.info('no metadata ---- bypass to agent')
                await bypassToAgent(inboundConversationId, conversationMetadata);
                res.status(200).send({ dispatch_one: 'Message passed and message posted'});
            }
        } else {
            logs['action'] = 'ignore';
            logger.info(logs);
            console.info(`ignore -- switchboard integration ${inboundConversationId} active on: ${convPayload.activeSwitchboardIntegration.name}`);
            res.status(200).send({ dispatch_one: 'Message passed and message posted'});
        }
    } catch (error) {
        console.warn('exception conversation : ', inboundConversationId)
        logs['body'] = req.body;
        await bypassToAgent(inboundConversationId, conversationMetadata);
        if (error.status && error.body) {
            if (error.body.errors) {
                logs['message'] = error.body.errors;
                logger.error(logs);
                return res.status(error.status).send({error: error.body.errors});
            } else {
                logs['message'] = error.body;
                logger.error(logs);
                return res.status(error.status).send({error: error.body});
            }
        } else {
            logs['message'] = error;
            logger.error(logs);
            return res.status(500).send({error: error});
        }
    }
    // conversationMetadata['dataCapture.systemField.tags'] = `${initiateTags}`;
});

async function bypassToAgent (conversationId, metadata) {
    console.info('bypass to agent - passing conversation id : ', conversationId);
    const passControlApi = new SunshineConversationsClient.SwitchboardActionsApi();
    let passControlBody = new SunshineConversationsClient.PassControlBody();
    passControlBody = {
        switchboardIntegration: 'zd-agentWorkspace',
        metadata: metadata
    }
    await passControlApi.passControl(suncoAppId, conversationId, passControlBody);
}

module.exports = router;
