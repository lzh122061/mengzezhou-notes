// cloudfunctions/handleLike/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  // 获取当前操作用户的 openid
  const { OPENID } = cloud.getWXContext()
  // 获取前端传来的 帖子ID
  const { postId } = event

  try {
    // 1. 先查询这个帖子，看看目前的点赞列表里有没有这个人
    const postRes = await db.collection('posts').doc(postId).get()
    const post = postRes.data
    const likes = post.likes || []
    
    // 判断是否已点赞
    let isLiked = likes.includes(OPENID)
    let updateOp = null

    if (isLiked) {
      // 如果已经点赞了，操作是：移除 (pull)
      updateOp = _.pull(OPENID)
    } else {
      // 如果没点赞，操作是：添加 (addToSet，保证不重复)
      updateOp = _.addToSet(OPENID)
    }

    // 2. 执行更新
    await db.collection('posts').doc(postId).update({
      data: {
        likes: updateOp
      }
    })

    // 3. 返回最新状态给前端
    return {
      success: true,
      // 告诉前端现在的状态是“已赞”还是“未赞”
      isLiked: !isLiked, 
      msg: isLiked ? '取消点赞' : '点赞成功'
    }

  } catch (err) {
    console.error(err)
    return {
      success: false,
      errMsg: err
    }
  }
}