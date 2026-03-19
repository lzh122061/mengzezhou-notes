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
    // 【修改】使用新版 API 获取窗口信息（包含状态栏高度）
    const windowInfo = wx.getWindowInfo();
    // 状态栏高度（灵动岛所在区域）
    const statusBarHeight = windowInfo.statusBarHeight;
    
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
      title: '孟沢洲入住须知',
      path: '/pages/notes/index'
    }
  },

  /**
   * 分享到朋友圈
   */
  onShareTimeline: function () {
    return {
      title: '孟沢洲入住须知'
    }
  },

  // ===================================
  // 地图导航逻辑
  // ===================================
  openMap() {
    // ★★★ 请在此处修改为您民宿的真实经纬度 (GCJ02坐标系) ★★★
    // 1. 务必确保是 数字类型 (不要加引号)
    // 2. 纬度(latitude)通常在 25 左右(大理)，经度(longitude)在 100 左右
    const latitude = 25.731285;  
    const longitude = 100.14653;
    
    // 添加日志，请在调试器Console中查看打印出的坐标是否为您修改后的新坐标
    console.log('准备打开地图，目标坐标：', latitude, longitude);

    wx.openLocation({
      latitude: Number(latitude),   // 强制转为数字，防止字符串错误
      longitude: Number(longitude), // 强制转为数字
      name: '孟沢洲三号院', // 地点名称
      address: '云南省大理白族自治州大理市银桥镇五里桥村委会8社1号', // 详细地址
      scale: 18 // 地图缩放级别
    });
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