const db = wx.cloud.database();
const _ = db.command;

Page({
  data: {
    roomId: '',
    roomName: '',
    currentDate: new Date().getTime(),
    navHeight: 0,
    statusBarHeight: 0,
    
    // --- 新增多房态矩阵所需数据 ---
    roomList: ['101', '102', '103', '201', '202', '203', '301', '302'],
    timeline: [],      // 存储横向滚动的时间轴数据
    bookedMatrix: {},  // 存储房态矩阵数据 { '101': { '2025-12-25': true } }
  },

  onLoad(options) {
    // 1. 动态计算导航栏高度
    const windowInfo = wx.getWindowInfo();
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect();
    
    const statusBarHeight = windowInfo.statusBarHeight;
    const navHeight = statusBarHeight + menuButtonInfo.height + (menuButtonInfo.top - statusBarHeight) * 2;

    this.setData({
      roomId: options.id ? String(options.id).trim() : '',
      roomName: options.name || '房态看板',
      navHeight: navHeight,
      statusBarHeight: statusBarHeight
    }, () => {
      wx.setNavigationBarTitle({ title: '全房态预览' });
    });
  },

  // ★ 核心修改：使用 onShow 确保每次进入页面都刷新数据
  onShow() {
    this.initTimeline(); 
    this.fetchBookedDates(); 
  },

  // 初始化时间轴：当前月 + 后 2 个月
  initTimeline() {
    const timeline = [];
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    
    // 生成从今天开始往后 90 天的数据
    for (let i = 0; i < 90; i++) {
      const date = new Date(year, month, now.getDate() + i);
      const fullDate = this.formatDate(date);
      const day = date.getDate();
      const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
      
      timeline.push({
        fullDate: fullDate,
        day: day,
        month: date.getMonth() + 1,
        weekText: weekDays[date.getDay()],
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
        isToday: i === 0,
        isFirstDay: day === 1 || i === 0 // 用于显示月份标签
      });
    }
    this.setData({ timeline });
  },

  // ★ 核心修复：使用 while 循环分页拉取，突破小程序端 20 条限制
  async fetchBookedDates() {
    const now = new Date();
    const startDateStr = this.formatDate(now);
    const futureDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 90);
    const endDateStr = this.formatDate(futureDate);

    console.log('开始拉取房态:', startDateStr, '至', endDateStr);
    
    // 显示加载中，以免用户以为卡死
    wx.showLoading({ title: '同步房态...', mask: true });

    const MAX_LIMIT = 20; // 小程序端强制限制
    let allData = [];
    let page = 0;
    let hasMore = true;

    try {
      // 循环拉取，直到没有更多数据
      while (hasMore) {
        const res = await db.collection('bookings')
          .where({
            status: 'booked',
            date: _.gte(startDateStr).and(_.lte(endDateStr))
          })
          .skip(page * MAX_LIMIT) // 跳过前 n 页
          .limit(MAX_LIMIT)       // 每次取 20 条
          .get();
        
        const list = res.data;
        allData = allData.concat(list);
        
        // 如果本次拉取少于 20 条，说明已经取完了所有数据
        if (list.length < MAX_LIMIT) {
          hasMore = false;
        } else {
          // 还有数据，准备拉下一页
          page++;
        }
      }

      console.log('成功拉取房态数据总条数:', allData.length);
      
      const matrix = {};
      this.data.roomList.forEach(id => {
        matrix[id] = {};
      });

      allData.forEach(item => {
        const rId = String(item.roomId);
        if (matrix[rId]) {
          matrix[rId][item.date] = true;
        }
      });

      this.setData({ bookedMatrix: matrix }, () => {
        wx.hideLoading();
      });

    } catch (err) {
      console.error("前台房态拉取失败:", err);
      wx.hideLoading();
    }
  },

  formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  },

  navToHome() {
    wx.reLaunch({ url: '/pages/home/index' });
  },

  navToDetail() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.reLaunch({ url: '/pages/rooms/index' });
    }
  }
});