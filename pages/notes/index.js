Page({

  /**
   * 页面的初始数据
   */
  data: {
    navHeight: 0 // 初始导航栏高度
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    // 获取系统信息以适配灵动岛和胶囊按钮
    const systemInfo = wx.getSystemInfoSync();
    // 状态栏高度（灵动岛所在区域）
    const statusBarHeight = systemInfo.statusBarHeight;
    
    // 获取胶囊按钮的布局位置信息
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect();
    
    /**
     * 计算整体偏移高度：
     * 胶囊按钮距离顶部的距离 (top) + 胶囊按钮自身高度 + 底部间隙
     * 通常为了美观，我们会取 (胶囊顶部距离 - 状态栏高度) * 2 + 胶囊高度 + 状态栏高度
     * 简化常用值：statusBarHeight + 44 是标准自定义导航栏高度
     */
    const navHeight = menuButtonInfo.bottom + (menuButtonInfo.top - statusBarHeight);
    
    this.setData({
      navHeight: navHeight
    });
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