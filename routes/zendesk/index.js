var express = require('express');
var router = express.Router();
const zdFieldsEncrypted = process.env.ZD_TICKET_FIELDS;
const zdFieldsDecrypted = JSON.parse(getDecryptedString(zdFieldsEncrypted));

router.post('/zd/reply', async function(req, res, next) {
    if (!req.body.events) {
        console.warn(req.body);
        return res.status(400).send({ error: 'No events in request body' });
    }
    const eventPayload = req.body.events[0];
    const convPayload = eventPayload.payload.conversation;
    const messagePayload = eventPayload.payload.message;
    // const inboundConversationId = convPayload.id;
    // const inboundConversationUserId = messagePayload.author.userId;
    const inboundConversationContent = messagePayload.content;
    const inboundSource = messagePayload.source.type;
    let messageAuthor = messagePayload.author.type

    if (messageAuthor == 'business' && (inboundSource == 'zd:agentWorkspace' || inboundSource == 'ultimate')) {
        if (convPayload.metadata) {
            if (convPayload.metadata.origin_source_integration) {
                res.status(200).send({})
            }
        }
    }

    let isValidSourceType = false
    let errorMessage = 'Cannot sent document to the marketplace, due to API restriction'
    let bdMessagePayload = {
        store_code: convPayload.metadata[zdFieldsDecrypted.store],
        chat_code: convPayload.metadata[zdFieldsDecrypted.chat_code],
        mp_buyer_id: convPayload.metadata[zdFieldsDecrypted.user_id],
        content: {}
    }
    let messageContent = {};

    switch(inboundConversationContent.type) {
        case 'text':
            if (inboundConversationContent.text.includes('type: product')) {
                let messageText = inboundConversationContent.text.trim()
                let productId = (messageText.split('\n')[1]).split(' ')[1]
                messageContent = {
                    message: messageText,
                    mp_product_id: productId,
                    type: 'product'
                }
            } else {
                messageContent = {
                    message: inboundConversationContent.text,
                    type: 'text'
                }
            }
            break;
        case 'image':
            break;
        case 'file':
            break;
        default:
            break;
    }
    bdMessagePayload['content'] = messageContent;

    res.status(200).send({});
})


module.exports = router;