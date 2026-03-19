const db = wx.cloud.database();
const fs = wx.getFileSystemManager();
// 使用和 home.js 一致的缓存逻辑
const CACHE_KEY = 'img_cache_map_v1'; 

// ★★★ 核心修复1：修正云环境ID (必须和 home.js 一模一样) ★★★
const CLOUD_BASE = 'cloud://cloud1-7gvskpoo2a3897dc.636c-cloud1-7gvskpoo2a3897dc-1392473051';

// --- 1. 本地静态数据 ---
const ROOM_FACILITIES = ['100M独享WiFi', '独立卫浴', '干湿分离', '24h热水', '电热毯', '冷暖空调', '写字桌', '单人沙发2个', '小茶几', '吹风机', '山泉水入户', '电动车'];

const ROOM_DATABASE = {
  // === 客房部分 ===
  '101': {
    picCount: 3,
    tags: ['静谧', '私密', '一楼'],
    facilities: ROOM_FACILITIES,
    desc: '房间面积27㎡，朝南超大开窗，窗外为院内花坛，下午阳光会把树影照进屋内，非常舒服。房间隐私好，阳光好，地基高不潮湿，最安静阳光最好的一个房间'
  },
  '102': {
    picCount: 3,
    tags: ['苍山田园', '景观', '白噪声'],
    facilities: ROOM_FACILITIES,
    desc: '房间面积24㎡，窗户朝向为北，整体较为阴凉（夏天特别舒服）。下午2点后会有阳光直射。窗外可看到苍山，可以听到苍山溪流白噪声。'
  },
  '103': {
    picCount: 3,
    tags: ['舒适套房', '超大空间', '写论文首选'],
    facilities: ROOM_FACILITIES,
    desc: '一室一厅小套房，老房子改造而成，面积30㎡，套房客厅被客人们誉为“最适合写论文”的地方。'
  },
  '201': {
    picCount: 3,
    tags: ['温暖阳光', '全天采光', '看苍山'],
    facilities: ROOM_FACILITIES,
    desc: '房间面积27㎡，有朝南和朝西两个大窗户，全天采光。窗外可以看到苍山。午后的阳光会洒满整个床铺，非常治愈。'
  },
  '202': {
    picCount: 3,
    tags: ['苍山田园', '顶层视野', '开阔'],
    facilities: ROOM_FACILITIES,
    desc: '房间面积24㎡，朝北大开窗，位于102的正上方，看苍山视野更加开阔，田园风光一览无余。'
  },
  '203': {
    picCount: 3,
    tags: ['庭院阳光', '俯瞰内庭', '隐私好'],
    facilities: ROOM_FACILITIES,
    desc: '房间面积27㎡，朝南大开窗，朝北两个单扇窗，面对内部庭院，既有阳光又兼顾隐私。'
  },
  '301': {
    picCount: 3,
    tags: ['顶层', '温暖阳光', '无敌视角'],
    facilities: ROOM_FACILITIES,
    desc: '房间面积24㎡，朝南朝西两个大开窗，位于201的楼上，无敌的阳光 and 看苍山的视角。'
  },
  '302': {
    picCount: 3,
    tags: ['庭院阳光', '顶层', '安静'],
    facilities: ROOM_FACILITIES,
    desc: '房间面积27㎡，朝南大开窗，面对内部庭院，顶层视野与采光的终极选择。'
  },

  // === 公区部分 ===
  'kitchen': {
    name: '共享厨房',
    folder: '共享厨房', 
    picCount: 2,
    tags: ['全套厨具', '自助', '烟火气'],
    facilities: ['双开门冰箱', '微波炉', '中西式调料', '电饭煲', '破壁机', '空气炸锅', '电热水壶', '炒锅', '砂锅'],
    desc: '提供齐全的厨具和基础调料，只需要自行购买食材，即可在大理享受烹饪乐趣。'
  },
  'public': {
    name: '休闲公区',
    folder: '休闲公区',
    picCount: 4,
    tags: ['娱乐', '咖啡', '阅读', '治愈'],
    facilities: ['三只猫管家', '全自动咖啡机', '桌游', '上百本书籍', '黑胶唱片机', '吉他', '尤克里里', '电钢琴', 'switch游戏机', '绘画颜料', '65寸电视', '100寸投影', '射箭'],
    desc: '这是孟沢洲的社交心脏，连接着陌生与相识。提供书籍、黑胶、游戏机等丰富娱乐。'
  }
};

Page({
  data: {
    room: {
      images: [] 
    },
    navHeight: 0,
    statusBarHeight: 0,
    currentSwiper: 0,
    currentId: ''
  },

  onLoad(options) {
    try {
      const windowInfo = wx.getWindowInfo();
      const menuButtonInfo = wx.getMenuButtonBoundingClientRect();
      const statusBarHeight = windowInfo.statusBarHeight;
      const navHeight = statusBarHeight + menuButtonInfo.height + (menuButtonInfo.top - statusBarHeight) * 2;

      this.setData({
        statusBarHeight: statusBarHeight,
        navHeight: navHeight
      });
    } catch (e) {
      this.setData({
        statusBarHeight: 20,
        navHeight: 64
      });
    }

    if (options.id) {
      this.setData({
        currentId: options.id
      });
      this.initRoomData(options.id);
    }
  },

  // --- 初始化数据 (参考 home.js 逻辑) ---
  async initRoomData(id) {
    wx.showLoading({
      title: '加载中...'
    });

    // 1. 本地基础数据
    let localInfo = ROOM_DATABASE[id] || ROOM_DATABASE['101'];
    localInfo.id = id;
    if (!localInfo.name) localInfo.name = `孟沢洲·${id}`;

    // 2. 文件夹推断 (用于兜底，确保使用孟沢洲·前缀)
    let folderName = localInfo.folder;
    if (!folderName) {
      folderName = `孟沢洲·${id}`;
    }

    // 3. 构建默认兜底图 (使用修正后的 CLOUD_BASE)
    let defaultImages = [];
    for (let i = 1; i <= (localInfo.picCount || 3); i++) {
      defaultImages.push(`${CLOUD_BASE}/rooms/${folderName}/${i}.jpg`);
    }

    // 先渲染兜底，防止白屏
    this.setData({
        room: { ...localInfo, images: defaultImages }
    });

    try {
        let cloudData = {};
        
        // 4. 读取数据库 (类似 home.js)
        if (id === 'kitchen' || id === 'public') {
             const res = await db.collection('config').limit(1).get();
             if (res.data.length > 0) {
                 const cfg = res.data[0];
                 // 映射字段 (处理数组或单字符串)
                 if (id === 'kitchen') {
                    if (cfg.kitchen_images) cloudData.images = cfg.kitchen_images;
                    else if (cfg.kitchen_img) cloudData.images = [cfg.kitchen_img];
                 } else {
                    if (cfg.public_area_images) cloudData.images = cfg.public_area_images;
                    else if (cfg.public_area_img) cloudData.images = [cfg.public_area_img];
                 }
             }
        } else {
             const res = await db.collection('rooms').where({ id: id }).get();
             if (res.data.length > 0) cloudData = res.data[0];
        }

        // 5. 提取并清洗图片列表 (类似 home.js banners处理)
        let rawList = [];
        if (cloudData.images) {
            if (Array.isArray(cloudData.images)) rawList = cloudData.images;
            else rawList = [cloudData.images];
        } else if (cloudData.cover_image) {
            // 兼容 cover_image 字段
            if (Array.isArray(cloudData.cover_image)) rawList = cloudData.cover_image;
            else rawList = [cloudData.cover_image];
        }

        // 6. 强力过滤: 只保留 cloud:// 开头的有效字符串 (参考 home.js)
        const validList = rawList.filter(u => u && typeof u === 'string' && u.trim().length > 0 && u.startsWith('cloud://'));

        // 7. 决策：数据库优先，否则用兜底
        const finalImgList = validList.length > 0 ? validList : defaultImages;

        // 更新数据
        const newRoomData = { ...localInfo, ...cloudData, images: finalImgList };
        if (!newRoomData.id) newRoomData.id = id;
        this.setData({ room: newRoomData });
        wx.setNavigationBarTitle({ title: newRoomData.name });

        // 8. 并发缓存处理 (完全复用 home.js 的 getLocalImage)
        const cachedImages = await Promise.all(finalImgList.map(url => this.getLocalImage(url)));
        
        this.setData({ 'room.images': cachedImages });

    } catch (err) {
        console.error("加载失败，使用默认图", err);
        // 失败时也尝试缓存默认图
        const cachedDefaults = await Promise.all(defaultImages.map(url => this.getLocalImage(url)));
        this.setData({ 'room.images': cachedDefaults });
    } finally {
        wx.hideLoading();
    }
  },

  // === ★ 终极防爆：图片本地缓存核心函数 (直接复制自 home.js) ===
  async getLocalImage(cloudUrl) {
    // 【第1关】基础空值检查
    if (!cloudUrl) return ''; 
    
    // 【第2关】类型检查
    if (typeof cloudUrl !== 'string') return '';

    // 【第3关】内容检查 (去掉空格后必须有内容)
    if (cloudUrl.trim() === '') return '';

    // 【第4关】协议检查 (非cloud://开头的，不走下载，直接返回原链接)
    if (!cloudUrl.startsWith('cloud://')) return cloudUrl;

    // 1. 读取缓存映射表
    let cacheMap = wx.getStorageSync(CACHE_KEY) || {};
    const localPath = cacheMap[cloudUrl];

    // 2. 检查缓存是否有效
    if (localPath) {
      try {
        fs.accessSync(localPath);
        return localPath; // 命中缓存
      } catch (e) {
        delete cacheMap[cloudUrl];
        wx.setStorageSync(CACHE_KEY, cacheMap);
      }
    }

    // 3. 缓存未命中，执行下载
    try {
      // 再次确认 fileID 存在
      if (!cloudUrl) throw new Error('Empty URL');

      const res = await wx.cloud.downloadFile({ fileID: cloudUrl });
      const tempPath = res.tempFilePath;

      // 4. 永久保存文件
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

      // 5. 更新缓存映射表
      cacheMap = wx.getStorageSync(CACHE_KEY) || {}; 
      cacheMap[cloudUrl] = savedPath;
      wx.setStorageSync(CACHE_KEY, cacheMap);

      return savedPath;
    } catch (err) {
      // 捕获错误但不抛出，防止页面崩溃，返回原链接兜底
      console.log('图片缓存下载跳过:', err.errMsg || err);
      return cloudUrl; 
    }
  },

  navToCalendar() {
    let targetId = this.data.currentId || this.data.room.id || this.data.room._id;
    if (!targetId) return;
    wx.navigateTo({
      url: `/pages/calendar/index?id=${targetId}&name=${this.data.room.name || ''}`
    });
  },

  onSwiperChange(e) {
    this.setData({
      currentSwiper: e.detail.current
    });
  },

  goBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.reLaunch({
        url: '/pages/home/index',
      });
    }
  },

  // === 优化后的分享给朋友 ===
  onShareAppMessage: function() {
    const roomName = this.data.room.name || '房间介绍';
    const roomId = this.data.currentId || this.data.room.id || '101';
    const finalTitle = roomName.startsWith('孟沢洲') ? roomName : `孟沢洲·${roomName}`;
    
    // ★ 动态获取当前正在查看的轮播图作为封面
    const currentIdx = this.data.currentSwiper || 0;
    const images = this.data.room.images || [];
    const currentImageUrl = images.length > currentIdx ? images[currentIdx] : '';

    return {
      title: finalTitle, // 显示为：孟沢洲·102
      path: `/pages/detail/index?id=${roomId}`,
      imageUrl: currentImageUrl // ★ 指定封面图，不再截长屏
    }
  },

  // === 优化后的分享到朋友圈 ===
  onShareTimeline: function() {
    const roomName = this.data.room.name || '房间介绍';
    const roomId = this.data.currentId || this.data.room.id || '101';
    const finalTitle = roomName.startsWith('孟沢洲') ? roomName : `孟沢洲·${roomName}`;
    
    // ★ 动态获取当前正在查看的轮播图作为封面
    const currentIdx = this.data.currentSwiper || 0;
    const images = this.data.room.images || [];
    const currentImageUrl = images.length > currentIdx ? images[currentIdx] : '';
    
    return {
      title: finalTitle,
      query: `id=${roomId}`,
      imageUrl: currentImageUrl // ★ 指定封面图
    }
  }
});