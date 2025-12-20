// deletePost/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { id } = event // 获取小程序传来的记录ID
  try {
    // 使用服务端权限删除
    return await db.collection('posts').doc(id).remove()
  } catch (e) {
    console.error(e)
    return e
  }
}