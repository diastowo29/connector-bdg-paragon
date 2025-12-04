var express = require('express');
const axios = require('axios');
const { getDecryptedString } = require('../../config/encrypt/config');
var router = express.Router();
const zdFieldsEncrypted = process.env.ZD_TICKET_FIELDS;
const zdFieldsDecrypted = JSON.parse(getDecryptedString(zdFieldsEncrypted));
const suncoConfigEncrypted = process.env.SUNCO;
const suncoConfigDecrypted = JSON.parse(getDecryptedString(suncoConfigEncrypted));

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
            let imageName = inboundConversationContent.altText
            let imageType = inboundConversationContent.mediaType

            if (payload.conversation.metadata[zdFieldsDecrypted.marketplace_name] == 'shopee') {
              let formData = await downloadImageToBuffer(inboundConversationContent.mediaUrl, imageName, imageType, 0)
              if (formData) {
                let uploadImage = await uploadImageToBantudagang(formData, payload.conversation.metadata[zdFieldsDecrypted.store_id])
                if(uploadImage.message == 'SUCCESS'){
                  isValidSourceType = true
                  messageContent = {
                    image_url: uploadImage.data,
                    type: 'image'
                  }
                }
              } else {
                errorMessage = "Cannot sent image to user due to technical issue"
              }
            } else {
              isValidSourceType = true
              messageContent = {
                image_url: inboundConversationContent.mediaUrl,
                type: 'text'
              }
            }
            break;
        case 'file':
            let fileType = inboundConversationContent.mediaType
            if (fileType.includes('video')) {
              if(payload.conversation.metadata[zdFieldsDecrypted.marketplace_name] == 'shopee'){
                  /* let formData = await downloadImageToBuffer(payload.message.content.mediaUrl, imageName, fileType, 0)

                  if(formData){
                    let uploadImage = await uploadImageToBantudagang(formData, payload.conversation.metadata["dataCapture.ticketField.44657162155929"])

                    if(uploadImage.message == 'SUCCESS'){
                      isValidSourceType = true
                      param.content.image_url = uploadImage.data
                      param.content.type = 'image'
                    }
                  }else{
                    errorMessage = "Cannot sent image to user due to technical issue"
                  } */
              } else {
                isValidSourceType = true
                messageContent = {
                  image_url: inboundConversationContent.mediaUrl,
                  type: 'image'
                }
              }
            }
            break;
        default:
            break;
    }
    bdMessagePayload['content'] = messageContent;

    res.status(200).send({});
})

async function downloadImageToBuffer(url, imageName, imageType, flag) {
  let baseLog = `downloadImageToBuffer(${url}, ${imageName}, ${imageType})`
  let token = btoa(`${suncoConfigDecrypted.key_id}:${suncoConfigDecrypted.secret}`)
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'arraybuffer',
    headers:{
      'Authorization': `Basic ${token}`
    }
  })

  try {
    const imageBuffer = Buffer.from(response.data);
    const contentType = response.headers["content-type"] || imageType
    const imageBlob = new Blob([imageBuffer], { type: contentType })
    const formData = new FormData()

    if (flag == 0) {
      formData.append('file', imageBlob,  imageName)
      return formData
    } else {
      formData.append('source', imageBlob,  imageName)
      return imageBlob
    }
  } catch(error) {
    return null
  }
}

async function uploadImageToBantudagang(formData, storeCode){
  let baseLog = `uploadImageToBantudagang(${formData}, ${storeCode})`
  // --- need more BD config
  /* return axios.post( `${bantuDagang.bdData.url}/chat/upload/shopee?store_code=${storeCode}`, formData,{
    headers: {
      'Content-Type': 'multipart/form-data',
      'Authorization': `Bearer ${bantuDagang.bdData.accessToken}`
    }
  }).then(function(response){
    console.log(baseLog, 'upload image to bantudagang success', JSON.stringify(response.data))
    return response.data
  }).catch(async function(error){
    console.log(baseLog, 'upload image to bantudagang error')
    if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
      console.log(baseLog, error.response.data);
      console.log(baseLog, error.response.status);
      console.log(baseLog, error.response.headers);

      if(error.response.status == 401){
        await getRefreshToken()
        sendMessageToBantudagang(payload)
      }
    } else if (error.request) {
        // The request was made but no response was received
        // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
        // http.ClientRequest in node.js
      console.log(baseLog, error.request);
    } else {
        // Something happened in setting up the request that triggered an Error
      console.log(baseLog, 'Error', error.message);
    }
    console.log(baseLog, error.config)
    return {message: "FAILED"}
  }) */
}


module.exports = router;