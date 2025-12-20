// cloudfunctions/msgSecCheck/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  try {
    const result = await cloud.openapi.security.msgSecCheck({
      content: event.content,
      version: 2,
      scene: 2,
      openid: cloud.getWXContext().OPENID
    })
    return { code: result.result.suggest === 'pass' ? 200 : 500 }
  } catch (err) {
    return { code: 500, error: err }
  }
}