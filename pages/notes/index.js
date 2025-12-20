Page({

  /**
   * 页面的初始数据
   */
  data: {

  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage: function () {
    return {
      title: '民宿入住须知',
      path: '/pages/notes/index' // 修正路径为 notes
    }
  },

  /**
   * 分享到朋友圈
   */
  onShareTimeline: function () {
    return {
      title: '民宿入住须知'
    }
  },

  // ===================================
  // 底部导航栏跳转逻辑
  // ===================================

  navToHome() {
    wx.reLaunch({
      url: '/pages/home/index'
    });
  },

  navToNotes() {
    // 当前就在入住须知页面，保持不动
  },

  navToMassage() {
    wx.reLaunch({
      url: '/pages/massage/index'
    });
  },

  navToMy() {
    wx.reLaunch({
      url: '/pages/index/index'
    });
  }
})