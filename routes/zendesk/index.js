var express = require('express');
const axios = require('axios');
var SunshineConversationsClient = require('sunshine-conversations-client');
const { getDecryptedString } = require('../../config/encrypt/config');
const bantuDagang = require('../../models/bantudagang-env');
var router = express.Router();
const zdFieldsEncrypted = process.env.ZD_TICKET_FIELDS;
const bypassAllConversation = process.env.BYPASS_CONVERSATION === 'true' ? true : false;
const zdFieldsVars = JSON.parse(getDecryptedString(zdFieldsEncrypted));
const suncoConfigEncrypted = process.env.SUNCO;
const suncoConfigVars = JSON.parse(getDecryptedString(suncoConfigEncrypted));
const zendeskEncrypted = process.env.ZENDESK
const zendesk = JSON.parse(getDecryptedString(zendeskEncrypted))
const bantuDagangEncrypted = process.env.BANTUDAGANG
bantuDagang.default = JSON.parse(getDecryptedString(bantuDagangEncrypted))

/* router.get('/config', function(req, res) {
  res.status(200).send({
    sunco: suncoConfigVars,
    zendesk: zendesk,
    bantu_dagang: bantuDagang
  })
}) */

let productReview = {};
getProductReview(`${zendesk.url}/api/v2/custom_objects/product_review/records`)

router.post('/testing', function(req, res) {
  console.log(JSON.stringify(req.body))
  res.status(200).send({})
})

let csatRespond = {}
getCsatRespond()
getRefreshToken()

router.post('/agent_workspace/event', async function(req, res){
  let baseLog = '/bantudagang/agent_workspace/event POST -'
  
  try{
    // let trigger = req.body.events[0].type
    let payload = req.body.events[0].payload
    console.log(baseLog, JSON.stringify(req.body));
    let sourceType = payload.message.source.type
    let messageAuthor = payload.message.author.type
    let isCsatOffered = payload.conversation?.metadata ? true : false
    const convMetadata = payload.conversation.metadata
    isCsatOffered = isCsatOffered && convMetadata.hasOwnProperty('is_csat_offered') ? convMetadata.is_csat_offered : false
    
    /* if (messageAuthor == 'user' && sourceType == 'api:conversations') {
      if (payload.conversation.activeSwitchboardIntegration.integrationType == 'ultimate') {
        if (bypassAllConversation) {
          let passControlMetadata = convMetadata || {};
          await swPassControl(payload.conversation.id, passControlMetadata);
          return res.send('ok');
        }
      }
    } */

    if (messageAuthor == 'business') {
      // SEND MESSAGE TO BANTU DAGANG
      console.log(baseLog, 'message author is bussines')
      if(payload.conversation?.metadata?.origin_source_integration){
        console.log(baseLog, 'message origin from registered channel')
        res.send('ok')
        return
      }

      await sendMessageToBantudagang(payload)
      res.send('ok')
      return
    }

    if(messageAuthor == 'user' && sourceType == 'api:conversations' && isCsatOffered){
      if(payload.message.content.type == 'text'){
        let messageText = payload.message.content.text.trim()
        let ticketId = convMetadata.zd_ticket_id
        let currentCsat = convMetadata.csat_score
        let buyerRegion = convMetadata.buyer_region

        if (currentCsat=='csat_0') {
          if(messageText=='1'){
            // await updateConversation(payload.conversation.id, {csat_score: "csat_1", is_csat_offered: false}, 1)
            // await postMessage(csatRespond[buyerRegion].respond, payload.conversation.id, 0)
            // await zdUpdateTicket(ticketId,'csat_1')
            await updateConversation(payload.conversation.id, {csat_score: "csat_1", is_csat_offered: false}, 1),
            await Promise.all([
              postMessage(csatRespond[buyerRegion].respond, payload.conversation.id, 0),
              zdUpdateTicket(ticketId,'csat_1')
            ])
          }else if(messageText=='2'){
            // await updateConversation(payload.conversation.id, {csat_score: "csat_2"}, 1)
            // await postMessage(csatRespond[buyerRegion].respond_2, payload.conversation.id, 0)
            // await zdUpdateTicket(ticketId,'csat_2')
            await updateConversation(payload.conversation.id, {csat_score: "csat_2", is_csat_offered: false}, 1),
            await Promise.all([
              postMessage(csatRespond[buyerRegion].respond_2, payload.conversation.id, 0),
              zdUpdateTicket(ticketId,'csat_2')
            ])
          }else{
            res.send('ok')
            return
          }
        }else{
          res.send('ok')
          return
        }
      }else{
        res.send('ok')
        return
      }
    }

    res.send('ok')
  }catch(error){
    console.log(baseLog,'internal server error', error)
    res.status(500).send({message: "internal server error"})
  }
})

router.post('/reply_rating', function(req,res){
  let baseLog = '/bantudagang/dev/reply_rating POST -'
  try{
    console.log(baseLog, JSON.stringify(req.body))
    let name = req.body.name
    let rating = req.body.rating_review.split('_')[1]
    const highRate = ((rating == '4') || (rating == '5')) ? true : false;
    let fieldKey = `${req.body.store_type.toLowerCase()}_${rating}`
    const agentComment = req.body.agent_comment || '';
    const comment = (highRate) ? productReview[name][fieldKey] : agentComment

    return axios({
      url: `${bantuDagang.bdData.url}/product/rating`,
      method: 'post',
      data: {
        rating_code: req.body.rating_code,
        comment: comment
      },
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${bantuDagang.bdData.accessToken}`
      }
      }).then(function(){
        console.log(baseLog, 'reply rating success')
        res.send({
          status: true,
          message: 'Reply rating success'
        })
      }).catch(function(error){
        if (error.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          console.log(baseLog, 'error response', error.response.data)
        } else if (error.request) {
          // The request was made but no response was received
          // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
          // http.ClientRequest in node.js
          console.log(baseLog, 'error request', error.request)
        } else {
          // Something happened in setting up the request that triggered an Error
          console.log(baseLog,'Error', error.message);
        }
        console.log(baseLog, 'error config', error.config)
        res.status(400).send({
          status: false,
          message: 'Reply rating failed'
        })
      }
    )
  }catch(error){
    console.log(baseLog,'internal server error',error)
    res.status(400).send({
      status: false,
      message: 'Server failed to execution. Make sure you send clean data'
    })
  }
})

router.get('/sync_custom_object', function(req,res){
  getCsatRespond()
  getProductReview(`${zendesk.url}/api/v2/custom_objects/product_review/records`)
  res.send('custom object will be sync..')
})
/* INACTIVE ENDPOINT ---- SOON MAYBE :) */
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
      store_code: convPayload.metadata[zdFieldsVars.store],
      chat_code: convPayload.metadata[zdFieldsVars.chat_code],
      mp_buyer_id: convPayload.metadata[zdFieldsVars.user_id],
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

            if (payload.conversation.metadata[zdFieldsVars.marketplace_name] == 'shopee') {
              let formData = await downloadImageToBuffer(inboundConversationContent.mediaUrl, imageName, imageType, 0)
              if (formData) {
                let uploadImage = await uploadImageToBantudagang(formData, payload.conversation.metadata[zdFieldsVars.store_id])
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
              if(payload.conversation.metadata[zdFieldsVars.marketplace_name] == 'shopee'){
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

function getCsatRespond(){
  let baseLog = '[routes/bantudagang] getCsatRespond() -'
  axios({
    url: `${zendesk.url}/api/v2/custom_objects/csat_respond/records`,
    method: 'get',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': zendesk.token
    }
    }).then(function(response){
      console.log(baseLog, 'get object (csat_respond) success', JSON.stringify(response.data))
      let csatLang = {}
      response.data.custom_object_records.forEach(record => {
        csatLang[record.name.toLowerCase()] = record.custom_object_fields
      })

      csatRespond = csatLang
      return true
    }).catch(function(error){
      if (error.response) {
        console.log(baseLog, 'error response', error.response.data)
        getCsatRespond()
        return
      } else if (error.request) {
        console.log(baseLog, 'error request', error.request)
      } else {
        console.log(baseLog, 'Error', error.message);
      }
      console.log(baseLog, 'error config', error.config)
      return false
    }
  )
}

function updateConversation(convId, convMetadata, flag){
  let baseLog = `[routes/bantudagang] updateConversation(${convId}) -`
  // getApiInstance()
  let conversationApi = new SunshineConversationsClient.ConversationsApi()
  let conversationUpdateBody = new SunshineConversationsClient.ConversationUpdateBody()

  if(flag == 0){
    let newMetadata = {}

    for(let key in convMetadata){
      let newKey = key.replace('dataCapture.ticketField.', '')
      newMetadata[newKey] = convMetadata[key]
    }

    conversationUpdateBody.metadata = newMetadata
  } else {
    conversationUpdateBody.metadata = convMetadata
  }

  return conversationApi.updateConversation(suncoConfigVars.app_id, convId, conversationUpdateBody).then(function(data) {
    console.log(baseLog, 'success')
    return true
  }, function(error) {
    console.error(baseLog, 'error', error)
    setTimeout(()=>{
      updateConversation(convId, convMetadata, flag)
    }, 10000)
  })
}

function postMessage(message, conversationId, retryTime){
  let baseLog = `[routes/bantudagang] postMessage(${conversationId}) -`
  // getApiInstance()
  let messageApi = new SunshineConversationsClient.MessagesApi()
  let body = {
    "author": {
      "type": "business",
      "displayName": "System"
    },
    "content": {
      "type": "text",
      "text": message
    }
  }

  console.log(baseLog, message)
  messageApi.postMessage(suncoConfigVars.app_id, conversationId, body).then(function(message) {
    console.log(`${baseLog} success: #${message.messages[0].id}`)
    return true
  }, function(error) {
    console.error(baseLog, `error-${retry}`, error)
    if(retryTime<2){
      retryTime++
      setTimeout(function(){
        postMessage(message, conversationId, retryTime)
      }, 30000)
    }else{
      return false
    }
  })
}

function zdUpdateTicket(ticketId, csat){
  let baseLog = `[routes/bantudagang] zdUpdateTicket(${ticketId}) -`
  let url = `${zendesk.url}/api/v2/tickets/${ticketId}`
  let csatFieldId = zdFieldsVars.csat_score
  let csatStatus = zdFieldsVars.custom_csat_status

  let body = {
    ticket:{
      status: 'pending',
      custom_status_id: csatStatus,
      custom_fields:[
        {
          id: csatFieldId,
          value: csat
        }
      ]
    }
  }
  console.log(baseLog, url, JSON.stringify(body))

  axios.put(url,body,{
    headers: {
      "Authorization": zendesk.token,
      "Content-Type": 'application/json'
    }
  }).then(result =>{
    console.log(baseLog, 'ticket updated')
    return true
  }).catch(error =>{
    console.log(baseLog, 'update ticket error',JSON.stringify(error.toJSON()))
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.log(baseLog, 'error response')
    } else if (error.request) {
      // The request was made but no response was received
      // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
      // http.ClientRequest in node.js
      console.log(baseLog, 'error request');
    } else {
      // Something happened in setting up the request that triggered an Error
      console.log(baseLog, 'Error code', error.message);
    }

    return false
  })
}

async function sendMessageToBantudagang(payload){
  let baseLog = `[routes/bantudagang] sendMessageToBantudagang(${payload.conversation.id}) -`
//   console.log(JSON.stringify(payload))
  try{
    let isValidSourceType = false
    let errorMessage = 'Cannot sent document to the marketplace, due to API restriction'
    let param = {
      "store_code": payload.conversation.metadata[zdFieldsVars.store_id],
      "chat_code": payload.conversation.metadata[zdFieldsVars.chat_code],
      "mp_buyer_id": payload.conversation.metadata[zdFieldsVars.user_id],
      "content":{
        "message": "",
        "type": "",
        "image_url": "",
        "content": {}
      }
    }

    try{
      param.conversation_id = payload.conversation.metadata[zdFieldsVars.external_conversation_id]
      param.is_affiliate = payload.conversation.metadata[zdFieldsVars.affiliate] + ''
    }catch(error){
      console.log(baseLog, error)
    }

    console.log(baseLog, 'message type:', payload.message.content.type)
    if(payload.message.content.type == 'text'){
      isValidSourceType = true
      let messageText = payload.message.content.text.trim()

      if(payload.message.content.text.includes('type: product')){
        let reqId = (messageText.split('\n')[1]).split(' ')[1]

        if(payload.conversation.metadata[zdFieldsVars.marketplace_name] !== 'tokopedia'){
          let msg = messageText.split('\n')[0]+'\n'+messageText.split('\n')[1]
          param.content.message = msg
          param.content.content.mp_product_id = reqId.toString()
          param.content.type = 'product'
        }else{
          param.content.message = reqId
          param.content.type = 'text'
        }
      }else if(payload.message.content.text.includes('type: order')){
        let reqId = (messageText.split('\n')[1]).split(' ')[1]
        param.content.type = 'order'
        param.content.content.mp_order_id = reqId.toString()
      }else{
        param.content.message = payload.message.content.text
        param.content.type = 'text'
      }
    }

    if(payload.message.content.type == 'image'){
      if(payload.message.content.hasOwnProperty('htmlText') && payload.message.content.htmlText.includes('type: product')){
        let messageText = payload.message.content.htmlText.trim()
        let prodId = (messageText.split('\n')[1]).split(' ')[1]
        isValidSourceType = true

        if(payload.conversation.metadata[zdFieldsVars.marketplace_name] !== 'tokopedia'){
          let msg = messageText.split('\n')[0]
          param.content.message = msg
          param.content.content.mp_product_id = prodId
          param.content.type = 'product'
        }else{
          param.content.message = prodId
          param.content.type = 'text'
        }
      }else{
        if(payload.conversation.metadata[zdFieldsVars.marketplace_name] == 'shopee'){
          // upload image to shopee
          let imageName = payload.message.content.altText
          let imageType = payload.message.content.mediaType
          let formData = await downloadImageToBuffer(payload.message.content.mediaUrl, imageName, imageType)

          if(!formData){
            errorMessage = "Cannot sent image to user due to technical issue"
          }else{
            let uploadImage = await uploadImageToBantudagang(formData, payload.conversation.metadata[zdFieldsVars.store_id])

            if(uploadImage.message == 'SUCCESS'){
              isValidSourceType = true
              param.content.image_url = uploadImage.data
              param.content.type = 'image'
            }
          }
        }else{
          isValidSourceType = true
          param.content.image_url = payload.message.content.mediaUrl
          param.content.type = 'text'
        }
      }
    }

    if( payload.message.content.type == 'file'){
      let imageName = payload.message.content.altText
      let fileType = payload.message.content.mediaType

      if(fileType.includes('video')){
        if(payload.conversation.metadata[zdFieldsVars.marketplace_name] == 'shopee'){
          // upload image to shopee
          // let formData = await downloadImageToBuffer(payload.message.content.mediaUrl, imageName, fileType, 0)

          // if(formData){
          //   let uploadImage = await uploadImageToBantudagang(formData, payload.conversation.metadata["dataCapture.zdFieldsVars44657162155929"])

          //   if(uploadImage.message == 'SUCCESS'){
          //     isValidSourceType = true
          //     param.content.image_url = uploadImage.data
          //     param.content.type = 'image'
          //   }
          // }else{
          //   errorMessage = "Cannot sent image to user due to technical issue"
          // }
        }else{
          isValidSourceType = true
          param.content.image_url = payload.message.content.mediaUrl
          param.content.type = 'text'
        }
      }
    }

    if(isValidSourceType){
      // post chat reply to bantudagang
      console.log(baseLog, `${bantuDagang.bdData.url}/chat/reply`)
      console.log(baseLog, 'data:', JSON.stringify(param))

      if(payload.message.source.type == 'api:conversations' && payload.conversation.activeSwitchboardIntegration.integrationType == 'zd:answerBot'){
        // update metadata conversation.. tambahin tags initiate_chat,set assignee_id
        console.log(baseLog, 'initchat detected')
        let passControlMetadata = payload.conversation.metadata

        if(payload.message?.metadata?.agent_id){
          passControlMetadata[`dataCapture.ticketField.${zdFieldsVars.init_assignee_id}`] = payload.message.metadata.agent_id
          passControlMetadata["dataCapture.systemField.tags"] = 'initiate_chat'
        }

        console.log(baseLog, 'passcontrol metadata edited', passControlMetadata)
        await swPassControl(payload.conversation.id, passControlMetadata)
      }else{
        if(payload.message?.metadata?.agent_id){
          let tfConversationId = zdFieldsVars.conversation_id.replace('dataCapture.ticketField.','')
          let searchUrl = `${zendesk.url}/api/v2/search?query=type:ticket custom_field_${tfConversationId}:${payload.conversation.id} status<closed&sort_by=updated_at&sort_order=asc`
          console.log(baseLog, 'search url', searchUrl)
          
          let zdTicket = await axios({
            url: searchUrl,
            method: 'get',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': zendesk.token
            }
          }).then(function(response){
            console.log(baseLog, 'search ticket success', JSON.stringify(response.data))
            if(response.data.results.length>0) return response.data.results[0].id
            return null
          }).catch(async function(error){
            console.log(baseLog, 'search ticket error', error)
            return null
          })

          if(zdTicket){
            let addTagsUrl =  `${zendesk.url}/api/v2/tickets/${zdTicket}/tags`
            console.log(baseLog, 'add tags url', addTagsUrl)

            await axios({
              url:addTagsUrl,
              method: 'put',
              data: {tags:['initiate_chat']},
              headers: {
                'Content-Type': 'application/json',
                'Authorization': zendesk.token
              }
            }).then(function(response){
              console.log(baseLog, 'add ticket tags success')
              return true
            }).catch(async function(error){
              console.log(baseLog, 'add ticket tags error', error)
              return false
            })

            let popupUrl = `${zendesk.url}/api/v2/channels/voice/agents/${payload.message.metadata.agent_id}/tickets/${zdTicket}/display`
            console.log(baseLog, 'popup url', popupUrl)

            axios({
              url: popupUrl,
              method: 'post',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': zendesk.token
              }
            }).then(function(response){
              console.log(baseLog, 'popup ticket success', JSON.stringify(response.data))
            }).catch(async function(error){
              console.log(baseLog, 'popup ticket error', error)
            })
          }
        }
      }

      await axios({
        url: `${bantuDagang.bdData.url}/chat/reply`,
        method: 'post',
        data: param,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${bantuDagang.bdData.accessToken}`
        }
      }).then(function(response){
          console.log(baseLog, 'reply chat to bantudagang success', JSON.stringify(response.data))
          return true
      }).catch(async function(error){
        console.log(baseLog, 'reply chat to bantudagang error')
        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
          console.log(baseLog, 'error response', error.response.data)

          if(error.response.status == 401){
            await getRefreshToken()
            sendMessageToBantudagang(payload)
          }else if(error.response.status == 400){
            let messageApi = new SunshineConversationsClient.MessagesApi()
            // getApiInstance()
            let convBody ={
              "author": {
                "type": "user",
                "userExternalId": payload.conversation.metadata[zdFieldsVars.chat_code]
              },
              "content": {
                "type": "text",
                "htmlText": `<h3 style='color: #ff0044;'>System warning !</h3><code>${error.response.data.message}</code>`
              }
            }

            return messageApi.postMessage(suncoConfigVars.app_id, payload.conversation.id, convBody).then(function(message) {
              console.log(baseLog, 'send error message success')
              return true
            }, function(error) {
              console.log(baseLog, 'send error message failed')
              return false
            })
          }else{
            let messageApi = new SunshineConversationsClient.MessagesApi()
            // getApiInstance()
            let convBody ={
              "author": {
                "type": "user",
                "userExternalId": payload.conversation.metadata[zdFieldsVars.chat_code]
              },
              "content": {
                "type": "text",
                "htmlText": `<h3 style='color: #ff0044;'>System warning !</h3><code>failed send ${payload.message.content.type} message.. please try again</code>`
              }
            }

            return messageApi.postMessage(suncoConfigVars.app_id, payload.conversation.id, convBody).then(function(message) {
              console.log(baseLog, 'send error message success')
              return true
            }, function(error) {
              console.log(baseLog, 'send error message failed')
              return false
            })
          }
        } else if (error.request) {
            // The request was made but no response was received
            // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
            // http.ClientRequest in node.js
          console.log(baseLog, 'error request', error.request);
        } else {
            // Something happened in setting up the request that triggered an Error
          console.log(baseLog, 'Error', error.message);
        }

        console.log(baseLog, 'error config', error.config)
        return false
      })
    }else{
      // post message as user 
      let messageApi = new SunshineConversationsClient.MessagesApi()
      // getApiInstance()
      let convBody ={
        "author": {
          "type": "user",
          "userExternalId": payload.conversation.metadata[zdFieldsVars.chat_code]
        },
        "content": {
          "type": "text",
          "htmlText": `<h3 style='color: #ff0044;'>System warning !</h3><code>${errorMessage}</code>`
        }
      }

      return messageApi.postMessage(suncoConfigVars.app_id, payload.conversation.id, convBody).then(function(message) {
        console.log(baseLog, 'send error message success')
        return true
      }, function(error) {
        console.log(baseLog, 'send error message failed')
        return false
      })
    }
  }catch(err){
    return false
  }
}

function swPassControl(conversationId, convMetadata) {
  let baseLog = `[routes/bantudagang] swPassControl(${conversationId}) -`
  try{
    convMetadata[zdFieldsVars.conversation_id] = conversationId
    // console.log(baseLog, 'conversation me' JSON.stringify(convMetadata))
    let tags = convMetadata['dataCapture.systemField.tags']?`${convMetadata['dataCapture.systemField.tags']} `:''
    
    if(convMetadata[zdFieldsVars.affiliate] == 0){
      convMetadata['dataCapture.systemField.tags'] = `${tags}non_affiliates`
    }
    
    if(convMetadata[zdFieldsVars.affiliate] == 1){
      convMetadata['dataCapture.systemField.tags'] = `${tags}affiliates`
    }
  }catch(error){
    console.log(baseLog, 'error',error)
  }
  let switchboardActionApi = new SunshineConversationsClient.SwitchboardActionsApi()
  let passControlBody = new SunshineConversationsClient.PassControlBody()
  passControlBody.switchboardIntegration = 'zd-agentWorkspace'
  passControlBody.metadata = convMetadata
  console.log(baseLog, JSON.stringify(passControlBody.metadata))
  
  return switchboardActionApi.passControl(suncoConfigVars.app_id, conversationId, passControlBody).then(function(data) {
    console.log(baseLog, 'success', JSON.stringify(data));
    return data
  }, function(error) {
    console.error(baseLog, 'error', JSON.stringify(error))
    return null
  })
}

function getRefreshToken() {
  let baseLog = '[routes/bantudagang] getRefreshToken() -'
  return axios({
    url: `${bantuDagang.bdData.url}/auth/login`,
    method: 'post',
    data: {
      'email': bantuDagang.bdData.email,
      'password': bantuDagang.bdData.password
    },
    headers: {
      'Content-Type': 'application/json'
    }
    }).then(function(response){
      console.log(baseLog, 'login response success')
      bantuDagang.bdToken = response.data.data.accessToken
      console.log(baseLog, 'new token setup', bantuDagang.bdData)
      return true
    }).catch(function(error){
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.log(baseLog, 'error response', error.response.data)
      } else if (error.request) {
        // The request was made but no response was received
        // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
        // http.ClientRequest in node.js
        console.log(baseLog, 'error request', error.request)
      } else {
        // Something happened in setting up the request that triggered an Error
        console.log(baseLog,'Error', error.message);
      }
      console.log(baseLog, 'error config', error.config)
      return false
    }
  )
}

async function downloadImageToBuffer(url, imageName, imageType) {
  let baseLog = `[routes/bantudagang] downloadImageToBuffer(${url}) -`
  let token = btoa(`${suncoConfigVars.key_id}:${suncoConfigVars.secret}`)
  const response = await axios({
      url,
      method: 'GET',
      responseType: 'arraybuffer',
      headers:{
        'Authorization': `Basic ${token}`
      }
  })

  try{
    const imageBuffer = Buffer.from(response.data);
    const contentType = response.headers["content-type"] || imageType
    const imageBlob = new Blob([imageBuffer], { type: contentType })
    const formData = new FormData()
    formData.append("file", imageBlob,  imageName)
    console.log(baseLog, 'image data downloaded')
    return formData
  }catch(error){
    return null
  }
}

async function uploadImageToBantudagang(formData, storeCode){
  let baseLog = `[routes/bantudagang] uploadImageToBantudagang(${storeCode}) -`
  return axios.post( `${bantuDagang.bdData.url}/chat/upload/shopee?store_code=${storeCode}`, formData,{
    headers: {
      'Content-Type': 'multipart/form-data',
      'Authorization': `Bearer ${bantuDagang.bdData.accessToken}`
    }
  }).then(function(response){
    console.log(baseLog, 'success', JSON.stringify(response.data))
    return response.data
  }).catch(async function(error){
    if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
      console.log(baseLog, 'error response', error.response.data)

      if(error.response.status == 401){
        await getRefreshToken()
        sendMessageToBantudagang(payload)
      }
    } else if (error.request) {
        // The request was made but no response was received
        // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
        // http.ClientRequest in node.js
      console.log(baseLog, 'error request', error.request);
    } else {
        // Something happened in setting up the request that triggered an Error
      console.log(baseLog, 'Error', error.message);
    }
    console.log(baseLog, 'error config', error.config)
    return {message: "FAILED"}
  })
}

async function getProductReview(url){
  let baseLog = '[routes/bantudagang/dev] getProductReview() -'
  console.log(baseLog, url)

  return axios({
    url: url,
    method: 'get',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': zendesk.token
    }
    }).then(function(response){
      // console.log(baseLog, 'get object (product_review) success', JSON.stringify(response.data))
      response.data.custom_object_records.forEach(record => {
        productReview[record.name] = record.custom_object_fields
      })
      
      if(response.data.links.next){
        getProductReview(response.data.links.next)
      }else{
        console.log(baseLog, 'productReview:', JSON.stringify(productReview))
        return true
      }
    }).catch(function(error){
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.log(baseLog, 'error response', error.response.data)

        getProductReview(url)
        return
      } else if (error.request) {
        // The request was made but no response was received
        // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
        // http.ClientRequest in node.js
        console.log(baseLog, 'error request', error.request)
      } else {
        // Something happened in setting up the request that triggered an Error
        console.log(baseLog, 'Error', error.message);
      }
      console.log(baseLog, 'error config', error.config)
      return false
    }
  )
}

module.exports = router;