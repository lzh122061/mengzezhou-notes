const db = wx.cloud.database();
// 引入文件管理器，用于缓存
const fs = wx.getFileSystemManager();
const CACHE_KEY = 'img_cache_map_v1'; // 缓存映射表的key

// 基础地址 (用于兜底默认图)
const CLOUD_BASE = 'cloud://cloud1-7gvskpoo2a3897dc.636c-cloud1-7gvskpoo2a3897dc-1392473051';

// 和风天气 API 配置
const WEATHER_API_KEY = '8f626237e3444b588565679093953c0a';
const DALI_LOCATION_ID = '101290201'; // 云南大理的城市代码
// ★ 核心修复：使用你提供的专属 API Host
const WEATHER_HOST = 'mv5n8n5xjc.re.qweatherapi.com';

const ROOM_META = {
  '101': { type: '客房', tag: '静谧空间 · 阳光充足' },
  '102': { type: '客房', tag: '苍山田园 · 景观大窗' },
  '103': { type: '客房', tag: '舒适套房 · 适合办公' },
  '201': { type: '客房', tag: '温暖采光 · 视野极佳' },
  '202': { type: '客房', tag: '苍山田园 · 顶层视野' },
  '203': { type: '客房', tag: '庭院阳光 · 俯瞰内庭' },
  '301': { type: '客房', tag: '顶层静谧 · 绝佳阳光' },
  '302': { type: '客房', tag: '视野开阔 · 顶层首选' }
};

Page({
  data: {
    navHeight: 0,
    banners: [],   // 轮播图数据
    topPoster: '', // 兼容字段
    roomList: [],
    // 天气与心情数据
    weather: {
      temp: '--',
      text: '获取中...',
      advice: '正在为您获取最新天气与穿衣建议...',
      uv: '获取中...', // 紫外线初始状态
      tempRange: '--', // 全天温度区间初始状态
      date: `${new Date().getMonth() + 1}月${new Date().getDate()}日` // 自动获取今天的月和日
    },
    todayMood: '' // 主理人心情
  },

  onLoad() {
    // 适配最新微信 API，获取状态栏高度
    const sys = wx.getWindowInfo();
    this.setData({ navHeight: sys.statusBarHeight });
    this.loadData();
    this.fetchWeather();
  },

  onShow() {
    this.loadData();
  },

  // 获取实时天气与穿衣指数
  fetchWeather() {
    const that = this;
    
    // 1. 获取实时天气 (温度和天气状况)
    wx.request({
      url: `https://${WEATHER_HOST}/v7/weather/now?location=${DALI_LOCATION_ID}&key=${WEATHER_API_KEY}`,
      success: (res) => {
        const data = res.data;
        if (typeof data === 'object' && data.code === '200') {
          const now = data.now;
          that.setData({
            'weather.temp': now.temp,
            'weather.text': now.text
          });
        } else {
          console.error('天气接口异常，返回内容:', data);
          that.setData({
            'weather.text': '获取失败',
            'weather.temp': '-'
          });
        }
      },
      fail: (err) => {
        console.error('天气网络请求失败:', err);
      }
    });

    // 2. 获取生活指数 (type=3,5 一次性获取穿衣和紫外线指数)
    wx.request({
      url: `https://${WEATHER_HOST}/v7/indices/1d?type=3,5&location=${DALI_LOCATION_ID}&key=${WEATHER_API_KEY}`,
      success: (res) => {
        const data = res.data;
        if (typeof data === 'object' && data.code === '200') {
          const daily = data.daily;
          if (daily && daily.length > 0) {
            let adviceText = '暂无建议';
            let uvText = '--';

            daily.forEach(item => {
              if (item.type === '3') adviceText = item.text; // 穿衣提示具体文案
              if (item.type === '5') uvText = item.category; // 紫外线强度级别
            });

            that.setData({
              'weather.advice': adviceText,
              'weather.uv': uvText
            });
          }
        } else {
          console.error('生活指数接口异常:', data);
          that.setData({ 'weather.advice': '请确认专属 Host 已在微信后台配置并生效' });
        }
      }
    });

    // 3. 获取今天全天温度区间
    wx.request({
      url: `https://${WEATHER_HOST}/v7/weather/3d?location=${DALI_LOCATION_ID}&key=${WEATHER_API_KEY}`,
      success: (res) => {
        const data = res.data;
        if (typeof data === 'object' && data.code === '200') {
          const today = data.daily[0]; 
          if (today) {
            that.setData({
              'weather.tempRange': `${today.tempMin}~${today.tempMax}°` // 格式化为 5~20°
            });
          }
        } else {
          console.error('全天温度获取异常:', data);
        }
      }
    });
  },

  async loadData() {
    try {
      const [configRes, roomsRes] = await Promise.all([
        db.collection('config').limit(1).get(),
        db.collection('rooms').orderBy('id', 'asc').get()
      ]);

      let config = {};
      let moodStr = '';
      
      if (configRes.data.length > 0) {
        config = configRes.data[0];
        if (config.today_mood && typeof config.today_mood === 'string') {
          moodStr = config.today_mood.trim();
        }
      }

      let banners = [];
      if (config.home_banner) {
        if (Array.isArray(config.home_banner)) {
          banners = config.home_banner;
        } else {
          banners = [config.home_banner];
        }
      }
      
      if (!banners || banners.length === 0) {
        banners = [`${CLOUD_BASE}/home/poster.jpg`];
      }

      const validBanners = banners.filter(url =>
        url && typeof url === 'string' && url.trim().length > 0
      );

      const cachedBanners = await Promise.all(validBanners.map(url => this.getLocalImage(url)));
      const topPoster = cachedBanners.length > 0 ? cachedBanners[0] : '';

      const dbRooms = roomsRes.data;
      
      let newRoomList = await Promise.all(dbRooms.map(async item => {
        const meta = ROOM_META[item.id] || { type: '客房', tag: '' };
        
        let imgUrl = '';
        if (item.cover_image) {
             if (Array.isArray(item.cover_image)) {
                imgUrl = item.cover_image[0];
             } else {
                imgUrl = item.cover_image;
             }
        }

        if (!imgUrl || typeof imgUrl !== 'string' || imgUrl.trim() === '') {
          imgUrl = `${CLOUD_BASE}/rooms/${item.id}/cover.jpg`;
        }

        const cachedImgUrl = await this.getLocalImage(imgUrl);

        return {
          id: item.id,
          name: item.name,
          type: meta.type,
          tag: meta.tag,
          img: cachedImgUrl
        };
      }));

      let kitchenUrl = '';
      if (config.kitchen_img) {
          if (Array.isArray(config.kitchen_img)) kitchenUrl = config.kitchen_img[0];
          else kitchenUrl = config.kitchen_img;
      }
      if (!kitchenUrl || typeof kitchenUrl !== 'string' || kitchenUrl.trim() === '') {
          kitchenUrl = `${CLOUD_BASE}/rooms/kitchen/cover.jpg`;
      }

      let publicUrl = '';
      if (config.public_area_img) {
          if (Array.isArray(config.public_area_img)) publicUrl = config.public_area_img[0];
          else publicUrl = config.public_area_img;
      }
      if (!publicUrl || typeof publicUrl !== 'string' || publicUrl.trim() === '') {
          publicUrl = `${CLOUD_BASE}/rooms/public/cover.jpg`;
      }

      const [cachedKitchen, cachedPublic] = await Promise.all([
        this.getLocalImage(kitchenUrl),
        this.getLocalImage(publicUrl)
      ]);

      newRoomList.push({
        id: 'kitchen',
        name: '共享厨房',
        type: '公区',
        tag: '全套厨具 · 烟火气息',
        img: cachedKitchen
      });

      newRoomList.push({
        id: 'public',
        name: '休闲公区',
        type: '公区',
        tag: '阅读娱乐 · 社交中心',
        img: cachedPublic
      });

      this.setData({
        banners: cachedBanners,
        topPoster,
        roomList: newRoomList,
        todayMood: moodStr
      });

    } catch (err) {
      console.error('首页加载数据失败', err);
    }
  },

  async getLocalImage(cloudUrl) {
    if (!cloudUrl) return '';
    if (typeof cloudUrl !== 'string') return '';
    if (cloudUrl.trim() === '') return '';
    if (!cloudUrl.startsWith('cloud://')) return cloudUrl;

    let cacheMap = wx.getStorageSync(CACHE_KEY) || {};
    const localPath = cacheMap[cloudUrl];

    if (localPath) {
      try {
        fs.accessSync(localPath);
        return localPath;
      } catch (e) {
        delete cacheMap[cloudUrl];
        wx.setStorageSync(CACHE_KEY, cacheMap);
      }
    }

    try {
      if (!cloudUrl) throw new Error('Empty URL');

      const res = await wx.cloud.downloadFile({ fileID: cloudUrl });
      const tempPath = res.tempFilePath;

      const fileName = tempPath.substring(tempPath.lastIndexOf('/') + 1);
      const savedPath = `${wx.env.USER_DATA_PATH}/${fileName}`;

      await new Promise((resolve, reject) => {
        fs.saveFile({
          tempFilePath: tempPath,
          filePath: savedPath,
          success: resolve,
          fail: reject
        });
      });

      cacheMap = wx.getStorageSync(CACHE_KEY) || {};
      cacheMap[cloudUrl] = savedPath;
      wx.setStorageSync(CACHE_KEY, cacheMap);

      return savedPath;
    } catch (err) {
      console.log('图片缓存下载跳过:', err.errMsg || err);
      return cloudUrl;
    }
  },

  copyWechat() {
    wx.setClipboardData({
      data: 'mzz1806',
      success: function () {
        wx.showToast({
          title: '已复制',
          icon: 'success',
          duration: 2000
        });
      }
    });
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/detail/index?id=${id}`
    });
  },

  navToMassage() {
    wx.reLaunch({ url: '/pages/massage/index' });
  },

  navToNotes() {
    wx.reLaunch({ url: '/pages/notes/index' });
  },

  navToMy() {
    wx.reLaunch({ url: '/pages/index/index' });
  },

  onShareAppMessage: function () {
    return {
      title: '孟沢洲三号院',
      path: '/pages/notes/index'
    }
  },

  onShareTimeline: function () {
    return {
      title: '孟沢洲三号院'
    }
  }
});