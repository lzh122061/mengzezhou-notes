// cloudfunctions/manageBookings/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { action, roomId, dates = [] } = event
  const safeRoomId = String(roomId) // 强制转字符串，防止查不到

  try {
    // 1. 先清理：不管锁定还是解锁，先把涉及日期的旧数据删干净
    // 这一步能彻底解决“权限不足”和“重复数据”问题
    if (dates.length > 0) {
      await db.collection('bookings').where({
        roomId: safeRoomId,
        date: _.in(dates)
      }).remove()
    }

    // 2. 如果是锁定，再写入新数据
    if (action === 'lock' && dates.length > 0) {
      const tasks = dates.map(d => {
        return db.collection('bookings').add({
          data: { 
            roomId: safeRoomId, 
            date: d, 
            status: 'booked', 
            createTime: db.serverDate() 
          }
        })
      })
      await Promise.all(tasks)
    }
    
    return { success: true }
  } catch (err) {
    console.error(err)
    return { success: false, errMsg: err.message }
  }
}